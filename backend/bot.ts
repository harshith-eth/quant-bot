import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction,
  getAccount,
  getAssociatedTokenAddress,
  RawAccount,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { Liquidity, LiquidityPoolKeysV4, LiquidityStateV4, Percent, Token, TokenAmount } from '@raydium-io/raydium-sdk';
import { MarketCache, PoolCache, SnipeListCache } from './cache';
import { PoolFilters } from './filters';
import { TransactionExecutor } from './transactions';
import { createPoolKeys, logger, NETWORK, sleep } from './helpers';
import { Mutex } from 'async-mutex';
import BN from 'bn.js';
import { WarpTransactionExecutor } from './transactions/warp-transaction-executor';
import { JitoTransactionExecutor } from './transactions/jito-rpc-transaction-executor';

// Import the trade logging function
let addTradeLog: ((type: 'buy' | 'sell' | 'info' | 'error', message: string, mint?: string, signature?: string) => void) | null = null;

// Dynamically import the logging function to avoid circular dependencies
async function getTradeLogger() {
  if (!addTradeLog) {
    try {
      const serverModule = await import('./server');
      addTradeLog = serverModule.addTradeLog;
    } catch (error) {
      // Fallback if server module is not available
      addTradeLog = () => {};
    }
  }
  return addTradeLog;
}

export interface BotConfig {
  wallet: Keypair;
  checkRenounced: boolean;
  checkFreezable: boolean;
  checkBurned: boolean;
  minPoolSize: TokenAmount;
  maxPoolSize: TokenAmount;
  quoteToken: Token;
  quoteAmount: TokenAmount;
  quoteAta: PublicKey;
  oneTokenAtATime: boolean;
  useSnipeList: boolean;
  autoSell: boolean;
  autoBuyDelay: number;
  autoSellDelay: number;
  maxBuyRetries: number;
  maxSellRetries: number;
  unitLimit: number;
  unitPrice: number;
  takeProfit: number;
  stopLoss: number;
  buySlippage: number;
  sellSlippage: number;
  priceCheckInterval: number;
  priceCheckDuration: number;
  filterCheckInterval: number;
  filterCheckDuration: number;
  consecutiveMatchCount: number;
}

export class Bot {
  private readonly poolFilters: PoolFilters;

  // snipe list
  private readonly snipeListCache?: SnipeListCache;

  // one token at the time
  private readonly mutex: Mutex;
  private sellExecutionCount = 0;
  public readonly isWarp: boolean = false;
  public readonly isJito: boolean = false;

  constructor(
    private readonly connection: Connection,
    private readonly marketStorage: MarketCache,
    private readonly poolStorage: PoolCache,
    private readonly txExecutor: TransactionExecutor,
    readonly config: BotConfig,
  ) {
    this.isWarp = txExecutor instanceof WarpTransactionExecutor;
    this.isJito = txExecutor instanceof JitoTransactionExecutor;

    this.mutex = new Mutex();
    this.poolFilters = new PoolFilters(connection, {
      quoteToken: this.config.quoteToken,
      minPoolSize: this.config.minPoolSize,
      maxPoolSize: this.config.maxPoolSize,
    });

    if (this.config.useSnipeList) {
      this.snipeListCache = new SnipeListCache();
      this.snipeListCache.init();
    }
  }

  async validate() {
    try {
      logger.info(`🔍 Validating bot configuration...`);
      logger.info(`Quote token symbol: "${this.config.quoteToken.symbol}"`);
      logger.info(`Quote token mint: ${this.config.quoteToken.mint.toString()}`);
      logger.info(`Quote amount: ${this.config.quoteAmount.toFixed()}`);
      
      // For WSOL (Wrapped SOL), check if we have SOL balance instead of WSOL ATA
      // Check both symbol and mint address for WSOL
      const isWSol = this.config.quoteToken.symbol === 'WSOL' || 
                    this.config.quoteToken.mint.toString() === 'So11111111111111111111111111111111111111112';
      
      if (isWSol) {
        logger.info(`🔍 Detected WSOL token, checking SOL balance...`);
        const balance = await this.connection.getBalance(this.config.wallet.publicKey);
        const requiredLamports = this.config.quoteAmount.raw.toNumber();
        
        logger.info(`SOL balance: ${balance / 1e9} SOL (${balance} lamports)`);
        logger.info(`Required: ${requiredLamports / 1e9} SOL (${requiredLamports} lamports)`);
        
        if (balance < requiredLamports) {
          logger.error(
            `Insufficient SOL balance. Required: ${requiredLamports / 1e9} SOL, Available: ${balance / 1e9} SOL`,
          );
          return false;
        }
        logger.info(`✅ SOL balance validation passed: ${balance / 1e9} SOL available`);
        return true;
      }
      
      // For other tokens, check the ATA exists
      logger.info(`🔍 Checking token account for ${this.config.quoteToken.symbol}...`);
      await getAccount(this.connection, this.config.quoteAta, this.connection.commitment);
      logger.info(`✅ ${this.config.quoteToken.symbol} token account validation passed`);
    } catch (error) {
      logger.error(
        `❌ ${this.config.quoteToken.symbol} token account not found in wallet: ${this.config.wallet.publicKey.toString()}`,
      );
      logger.error(`Validation error:`, error);
      return false;
    }

    return true;
  }

  public async buy(accountId: PublicKey, poolState: LiquidityStateV4) {
    const tradeLogger = await getTradeLogger();
    
    logger.trace({ mint: poolState.baseMint }, `Processing new pool...`);
    tradeLogger('info', `🔍 Analyzing new pool: ${poolState.baseMint.toString()}`, poolState.baseMint.toString());

    try {
      const [market, mintAta] = await Promise.all([
        this.marketStorage.get(poolState.marketId.toString()),
        getAssociatedTokenAddress(poolState.baseMint, this.config.wallet.publicKey),
      ]);

      if (!market) {
        logger.error({ mint: poolState.baseMint.toString() }, `Market data not found for ${poolState.marketId.toString()}`);
        tradeLogger('error', `Market data not found`, poolState.baseMint.toString());
        return;
      }

      const poolKeys: LiquidityPoolKeysV4 = createPoolKeys(accountId, poolState, market);
      
      // Apply configured filters
      const passesFilters = await this.filterMatch(poolKeys);
      
      if (!passesFilters) {
        logger.info({ mint: poolState.baseMint.toString() }, `Token did not pass filters, skipping buy`);
        tradeLogger('info', `Token did not pass filters, skipping buy`, poolState.baseMint.toString());
        return;
      }
      
      tradeLogger('info', `✅ Token passed filters, proceeding with buy`, poolState.baseMint.toString());

      for (let i = 0; i < this.config.maxBuyRetries; i++) {
        try {
          logger.info(
            { mint: poolState.baseMint.toString() },
            `🔄 Buy attempt: ${i + 1}/${this.config.maxBuyRetries}`,
          );
          tradeLogger('buy', `🔄 Buy attempt ${i + 1}/${this.config.maxBuyRetries}`, poolState.baseMint.toString());
          
          const tokenOut = new Token(TOKEN_PROGRAM_ID, poolKeys.baseMint, poolKeys.baseDecimals);
          const result = await this.swap(
            poolKeys,
            this.config.quoteAta,
            mintAta,
            this.config.quoteToken,
            tokenOut,
            this.config.quoteAmount,
            this.config.buySlippage,
            this.config.wallet,
            'buy',
          );

          if (result.confirmed) {
            logger.info(
              {
                mint: poolState.baseMint.toString(),
                signature: result.signature,
                url: `https://solscan.io/tx/${result.signature}?cluster=${NETWORK}`,
              },
              `✅ Buy transaction confirmed!`,
            );
            tradeLogger('buy', `✅ Buy confirmed! - ${this.config.quoteAmount.toFixed()} ${this.config.quoteToken.symbol} spent`, poolState.baseMint.toString(), result.signature);
            
            // Store pool data for future selling
            try {
              await this.poolStorage.save(poolState.baseMint.toString(), {
                accountId: accountId.toString(),
                state: poolState,
              });
              logger.info({ mint: poolState.baseMint.toString() }, `✅ Pool data stored for future selling`);
              tradeLogger('info', `✅ Pool data stored for future selling`, poolState.baseMint.toString());
            } catch (error) {
              logger.error({ mint: poolState.baseMint.toString(), error }, `Failed to store pool data`);
              tradeLogger('error', `Failed to store pool data: ${error instanceof Error ? error.message : 'Unknown error'}`, poolState.baseMint.toString());
            }
            
            break;
          }

          logger.info(
            {
              mint: poolState.baseMint.toString(),
              signature: result.signature,
              error: result.error,
            },
            `Error confirming buy tx`,
          );
          tradeLogger('error', `Buy confirmation failed: ${result.error}`, poolState.baseMint.toString(), result.signature);
        } catch (error) {
          logger.debug({ mint: poolState.baseMint.toString(), error }, `Error confirming buy transaction`);
          tradeLogger('error', `Buy transaction error: ${error instanceof Error ? error.message : 'Unknown error'}`, poolState.baseMint.toString());
        }
      }
    } catch (error) {
      logger.error({ mint: poolState.baseMint.toString(), error }, `Failed to buy token`);
      tradeLogger('error', `Failed to buy token: ${error instanceof Error ? error.message : 'Unknown error'}`, poolState.baseMint.toString());
    }
  }

  public async sell(accountId: PublicKey, rawAccount: RawAccount) {
    const tradeLogger = await getTradeLogger();
    
    try {
      logger.trace({ mint: rawAccount.mint }, `Processing token for sell...`);
      tradeLogger('info', `🔍 Analyzing token for sell operation`, rawAccount.mint.toString());

      const poolData = await this.poolStorage.get(rawAccount.mint.toString());

      if (!poolData) {
        logger.trace({ mint: rawAccount.mint.toString() }, `Token pool data is not found, can't sell`);
        tradeLogger('info', `Token pool data not found - can't sell`, rawAccount.mint.toString());
        return;
      }

      const tokenIn = new Token(TOKEN_PROGRAM_ID, poolData.state.baseMint, poolData.state.baseDecimal.toNumber());
      const tokenAmountIn = new TokenAmount(tokenIn, rawAccount.amount, true);

      if (tokenAmountIn.isZero()) {
        logger.info({ mint: rawAccount.mint.toString() }, `Empty balance, can't sell`);
        tradeLogger('info', `Empty balance - can't sell`, rawAccount.mint.toString());
        return;
      }

      // Get token price data for information
      try {
        const poolInfo = await Liquidity.fetchInfo({
          connection: this.connection,
          poolKeys: createPoolKeys(new PublicKey(poolData.accountId), poolData.state, await this.marketStorage.get(poolData.state.marketId.toString()) || undefined),
        });
        
        const slippage = new Percent(this.config.sellSlippage, 100);
        const currentValue = Liquidity.computeAmountOut({
          poolKeys: createPoolKeys(new PublicKey(poolData.accountId), poolData.state, await this.marketStorage.get(poolData.state.marketId.toString()) || undefined),
          poolInfo,
          amountIn: tokenAmountIn,
          currencyOut: this.config.quoteToken,
          slippage,
        }).amountOut;
        
        tradeLogger('info', `Current token value: ${currentValue.toFixed()} ${this.config.quoteToken.symbol}`, rawAccount.mint.toString());
      } catch (valueError) {
        logger.warn({ mint: rawAccount.mint.toString(), error: valueError }, `Could not determine token value`);
        tradeLogger('info', `Could not determine token value`, rawAccount.mint.toString());
      }

      const market = await this.marketStorage.get(poolData.state.marketId.toString());

      if (!market) {
        logger.error({ mint: rawAccount.mint.toString() }, `Market data not found for ${poolData.state.marketId.toString()}`);
        tradeLogger('error', `Market data not found for sell`, rawAccount.mint.toString());
        return;
      }

      const poolKeys: LiquidityPoolKeysV4 = createPoolKeys(new PublicKey(poolData.accountId), poolData.state, market);

      for (let i = 0; i < this.config.maxSellRetries; i++) {
        try {
          logger.info(
            { mint: rawAccount.mint },
            `🔄 Sell attempt: ${i + 1}/${this.config.maxSellRetries}`,
          );
          tradeLogger('sell', `🔄 Sell attempt ${i + 1}/${this.config.maxSellRetries}`, rawAccount.mint.toString());

          const result = await this.swap(
            poolKeys,
            accountId,
            this.config.quoteAta,
            tokenIn,
            this.config.quoteToken,
            tokenAmountIn,
            this.config.sellSlippage,
            this.config.wallet,
            'sell',
          );

          if (result.confirmed) {
            logger.info(
              {
                dex: `https://dexscreener.com/solana/${rawAccount.mint.toString()}?maker=${this.config.wallet.publicKey}`,
                mint: rawAccount.mint.toString(),
                signature: result.signature,
                url: `https://solscan.io/tx/${result.signature}?cluster=${NETWORK}`,
              },
              `✅ Sell transaction confirmed!`,
            );
            tradeLogger('sell', `✅ Sell confirmed! - ${tokenAmountIn.toFixed()} tokens sold`, rawAccount.mint.toString(), result.signature);
            break;
          }

          logger.info(
            {
              mint: rawAccount.mint.toString(),
              signature: result.signature,
              error: result.error,
            },
            `Error confirming sell tx`,
          );
          tradeLogger('error', `Sell confirmation failed: ${result.error}`, rawAccount.mint.toString(), result.signature);
        } catch (error) {
          logger.debug({ mint: rawAccount.mint.toString(), error }, `Error confirming sell transaction`);
          tradeLogger('error', `Sell transaction error: ${error instanceof Error ? error.message : 'Unknown error'}`, rawAccount.mint.toString());
        }
      }
    } catch (error) {
      logger.error({ mint: rawAccount.mint.toString(), error }, `Failed to sell token`);
      tradeLogger('error', `Failed to sell token: ${error instanceof Error ? error.message : 'Unknown error'}`, rawAccount.mint.toString());
    }
  }

  // noinspection JSUnusedLocalSymbols
  private async swap(
    poolKeys: LiquidityPoolKeysV4,
    ataIn: PublicKey,
    ataOut: PublicKey,
    tokenIn: Token,
    tokenOut: Token,
    amountIn: TokenAmount,
    slippage: number,
    wallet: Keypair,
    direction: 'buy' | 'sell',
  ) {
    const slippagePercent = new Percent(slippage, 100);
    const poolInfo = await Liquidity.fetchInfo({
      connection: this.connection,
      poolKeys,
    });

    const computedAmountOut = Liquidity.computeAmountOut({
      poolKeys,
      poolInfo,
      amountIn,
      currencyOut: tokenOut,
      slippage: slippagePercent,
    });

    const latestBlockhash = await this.connection.getLatestBlockhash();
    const { innerTransaction } = Liquidity.makeSwapFixedInInstruction(
      {
        poolKeys: poolKeys,
        userKeys: {
          tokenAccountIn: ataIn,
          tokenAccountOut: ataOut,
          owner: wallet.publicKey,
        },
        amountIn: amountIn.raw,
        minAmountOut: computedAmountOut.minAmountOut.raw,
      },
      poolKeys.version,
    );

    const messageV0 = new TransactionMessage({
      payerKey: wallet.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [
        ...(this.isWarp || this.isJito
          ? []
          : [
              ComputeBudgetProgram.setComputeUnitPrice({ microLamports: this.config.unitPrice }),
              ComputeBudgetProgram.setComputeUnitLimit({ units: this.config.unitLimit }),
            ]),
        ...(direction === 'buy'
          ? [
              createAssociatedTokenAccountIdempotentInstruction(
                wallet.publicKey,
                ataOut,
                wallet.publicKey,
                tokenOut.mint,
              ),
            ]
          : []),
        ...innerTransaction.instructions,
        ...(direction === 'sell' ? [createCloseAccountInstruction(ataIn, wallet.publicKey, wallet.publicKey)] : []),
      ],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);
    transaction.sign([wallet, ...innerTransaction.signers]);

    return this.txExecutor.executeAndConfirm(transaction, wallet, latestBlockhash);
  }

  private async filterMatch(poolKeys: LiquidityPoolKeysV4) {
    const tradeLogger = await getTradeLogger();
    
    // Check if we should use filters
    if (this.config.filterCheckInterval === 0 || this.config.filterCheckDuration === 0) {
      logger.debug(
        { mint: poolKeys.baseMint.toString() },
        `Filter checks disabled in config, proceeding with trade`,
      );
      tradeLogger('info', `Filter checks disabled in config, proceeding with trade`, poolKeys.baseMint.toString());
      return true;
    }

    // Real filter logic based on actual configuration
    const timesToCheck = this.config.filterCheckDuration / this.config.filterCheckInterval;
    let timesChecked = 0;
    let matchCount = 0;

    logger.debug(
      { mint: poolKeys.baseMint.toString() },
      `Starting filter checks: ${this.config.consecutiveMatchCount} consecutive matches required`,
    );
    tradeLogger('info', `Starting filter checks (need ${this.config.consecutiveMatchCount} consecutive matches)`, poolKeys.baseMint.toString());

    do {
      try {
        const shouldBuy = await this.poolFilters.execute(poolKeys);

        if (shouldBuy) {
          matchCount++;
          logger.debug(
            { mint: poolKeys.baseMint.toString() },
            `Filter match ${matchCount}/${this.config.consecutiveMatchCount}`,
          );
          tradeLogger('info', `Filter match ${matchCount}/${this.config.consecutiveMatchCount}`, poolKeys.baseMint.toString());

          if (this.config.consecutiveMatchCount <= matchCount) {
            logger.debug(
              { mint: poolKeys.baseMint.toString() },
              `✅ Filter criteria met: ${matchCount}/${this.config.consecutiveMatchCount} matches`,
            );
            tradeLogger('info', `✅ Filter criteria met: ${matchCount}/${this.config.consecutiveMatchCount} matches`, poolKeys.baseMint.toString());
            return true;
          }
        } else {
          // Reset match count if we get a non-match
          if (matchCount > 0) {
            logger.debug(
              { mint: poolKeys.baseMint.toString() },
              `❌ Filter match reset: ${matchCount} -> 0`,
            );
            tradeLogger('info', `❌ Filter match reset: ${matchCount} -> 0`, poolKeys.baseMint.toString());
          }
          matchCount = 0;
        }

        await sleep(this.config.filterCheckInterval);
      } catch (error) {
        logger.error(
          { mint: poolKeys.baseMint.toString(), error },
          `Error during filter check`,
        );
        tradeLogger('error', `Filter check error: ${error instanceof Error ? error.message : 'Unknown error'}`, poolKeys.baseMint.toString());
      } finally {
        timesChecked++;
      }
    } while (timesChecked < timesToCheck);

    logger.debug(
      { mint: poolKeys.baseMint.toString() },
      `❌ Filter criteria not met: ${matchCount}/${this.config.consecutiveMatchCount} matches after ${timesChecked} checks`,
    );
    tradeLogger('info', `❌ Filter criteria not met after ${timesChecked} checks`, poolKeys.baseMint.toString());
    return false;
  }

  private async priceMatch(amountIn: TokenAmount, poolKeys: LiquidityPoolKeysV4) {
    const tradeLogger = await getTradeLogger();
    
    if (this.config.priceCheckDuration === 0 || this.config.priceCheckInterval === 0) {
      return;
    }

    const timesToCheck = this.config.priceCheckDuration / this.config.priceCheckInterval;
    const profitFraction = this.config.quoteAmount.mul(this.config.takeProfit).numerator.div(new BN(100));
    const profitAmount = new TokenAmount(this.config.quoteToken, profitFraction, true);
    const takeProfit = this.config.quoteAmount.add(profitAmount);

    const lossFraction = this.config.quoteAmount.mul(this.config.stopLoss).numerator.div(new BN(100));
    const lossAmount = new TokenAmount(this.config.quoteToken, lossFraction, true);
    const stopLoss = this.config.quoteAmount.subtract(lossAmount);
    const slippage = new Percent(this.config.sellSlippage, 100);
    let timesChecked = 0;

    tradeLogger('info', `Price monitoring started - TP: ${takeProfit.toFixed()} | SL: ${stopLoss.toFixed()}`, poolKeys.baseMint.toString());

    do {
      try {
        const poolInfo = await Liquidity.fetchInfo({
          connection: this.connection,
          poolKeys,
        });

        const amountOut = Liquidity.computeAmountOut({
          poolKeys,
          poolInfo,
          amountIn: amountIn,
          currencyOut: this.config.quoteToken,
          slippage,
        }).amountOut;

        logger.debug(
          { mint: poolKeys.baseMint.toString() },
          `Take profit: ${takeProfit.toFixed()} | Stop loss: ${stopLoss.toFixed()} | Current: ${amountOut.toFixed()}`,
        );

        if (amountOut.lt(stopLoss)) {
          tradeLogger('info', `🔴 Stop loss triggered at ${amountOut.toFixed()}`, poolKeys.baseMint.toString());
          break;
        }

        if (amountOut.gt(takeProfit)) {
          tradeLogger('info', `🟢 Take profit triggered at ${amountOut.toFixed()}`, poolKeys.baseMint.toString());
          break;
        }

        await sleep(this.config.priceCheckInterval);
      } catch (e) {
        logger.trace({ mint: poolKeys.baseMint.toString(), e }, `Failed to check token price`);
        tradeLogger('error', `Price check failed: ${e instanceof Error ? e.message : 'Unknown error'}`, poolKeys.baseMint.toString());
      } finally {
        timesChecked++;
      }
    } while (timesChecked < timesToCheck);
  }
}
