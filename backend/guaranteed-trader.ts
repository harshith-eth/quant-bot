import { Connection, PublicKey, Keypair, VersionedTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { Liquidity, LiquidityPoolKeysV4, Token, TokenAmount, Percent } from '@raydium-io/raydium-sdk';
import { logger } from './helpers';
import { TransactionExecutor } from './transactions';
import axios from 'axios';

// Popular Solana meme tokens that have good liquidity on Jupiter
const GUARANTEED_TOKENS = [
  {
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // Bonk
    symbol: 'BONK',
    decimals: 5
  },
  {
    mint: 'WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk', // WEN
    symbol: 'WEN',
    decimals: 5
  },
  {
    mint: 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82', // Bome
    symbol: 'BOME',
    decimals: 6
  },
  {
    mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', // Jupiter
    symbol: 'JUP',
    decimals: 6
  }
];

export class GuaranteedTrader {
  constructor(
    private connection: Connection,
    private wallet: Keypair,
    private quoteToken: Token,
    private quoteAmount: TokenAmount,
    private txExecutor: TransactionExecutor,
    private addTradeLog: (type: 'buy' | 'sell' | 'info' | 'error', message: string, mint?: string, signature?: string) => void
  ) {}

  async executeGuaranteedTrade(): Promise<boolean> {
    this.addTradeLog('info', '🎯 GUARANTEED REAL TRADE - Using MEME SCANNER data!');
    logger.info('🎯 GUARANTEED REAL TRADE MODE ACTIVATED - USING MEME SCANNER');

    // Get REAL trending tokens from MEME SCANNER instead of hardcoded list
    const trendingToken = await this.getBestMemeScannerToken();
    
    if (!trendingToken) {
      this.addTradeLog('error', 'No trending tokens found from MEME SCANNER - falling back to guaranteed list');
      const fallbackToken = GUARANTEED_TOKENS[Math.floor(Math.random() * GUARANTEED_TOKENS.length)];
      this.addTradeLog('buy', `🚀 BUYING ${fallbackToken.symbol} WITH REAL SOL (FALLBACK)`, fallbackToken.mint);
      const success = await this.executeRealJupiterSwap(fallbackToken);
      return success;
    }
    
    this.addTradeLog('buy', `🚀 BUYING ${trendingToken.symbol} WITH REAL SOL (FROM MEME SCANNER)`, trendingToken.mint);
    logger.info(`Executing REAL guaranteed trade for ${trendingToken.symbol} (${trendingToken.mint})`);

    try {
      const success = await this.executeRealJupiterSwap(trendingToken);
      
      if (success) {
        this.addTradeLog('buy', `✅ REAL TRADE SUCCESSFUL! Bought ${trendingToken.symbol}`, trendingToken.mint);
        logger.info(`✅ Real guaranteed trade completed: ${trendingToken.symbol}`);
        return true;
      } else {
        this.addTradeLog('error', `Failed to execute real trade for ${trendingToken.symbol}`, trendingToken.mint);
        return false;
      }

    } catch (error) {
      logger.error(`Error in guaranteed trade for ${trendingToken.symbol}:`, error);
      this.addTradeLog('error', `Guaranteed trade failed for ${trendingToken.symbol}: ${error}`, trendingToken.mint);
      return false;
    }
  }

  private async executeRealJupiterSwap(token: any): Promise<boolean> {
    try {
      this.addTradeLog('buy', `💰 EXECUTING REAL JUPITER SWAP: ${token.symbol}`, token.mint);
      
      // Use Jupiter API to get swap transaction
      const WSOL_MINT = 'So11111111111111111111111111111111111111112'; // Wrapped SOL
      const inputMint = WSOL_MINT; // We're buying with SOL
      const outputMint = token.mint; // We're buying this token
      const amount = 400000; // 0.0004 SOL in lamports (about $0.10) - ULTRA SMALL AMOUNT
      const slippageBps = 1000; // 10% slippage
      
      this.addTradeLog('info', `Getting Jupiter quote for ${token.symbol}...`, token.mint);
      
      // Get quote from Jupiter
      const quoteResponse = await axios.get(`https://quote-api.jup.ag/v6/quote`, {
        params: {
          inputMint,
          outputMint,
          amount,
          slippageBps,
          onlyDirectRoutes: false,
          asLegacyTransaction: false
        },
        timeout: 10000
      });

      if (!quoteResponse.data) {
        this.addTradeLog('error', `No Jupiter quote available for ${token.symbol}`, token.mint);
        return false;
      }

      this.addTradeLog('info', `Quote received! Expected ${token.symbol}: ${quoteResponse.data.outAmount}`, token.mint);

      // Get swap transaction
      const swapResponse = await axios.post('https://quote-api.jup.ag/v6/swap', {
        quoteResponse: quoteResponse.data,
        userPublicKey: this.wallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 100000 // 0.0001 SOL priority fee
      }, {
        timeout: 10000
      });

      if (!swapResponse.data?.swapTransaction) {
        this.addTradeLog('error', `Failed to get Jupiter swap transaction for ${token.symbol}`, token.mint);
        return false;
      }

      this.addTradeLog('buy', `🚀 SENDING REAL TRANSACTION: ${token.symbol}`, token.mint);

      // Deserialize and sign the transaction
      const swapTransactionBuf = Buffer.from(swapResponse.data.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      
      // Sign the transaction
      transaction.sign([this.wallet]);

      // Send the transaction
      const signature = await this.connection.sendTransaction(transaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3
      });

      this.addTradeLog('buy', `📡 REAL Transaction sent! Signature: ${signature}`, token.mint, signature);

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        this.addTradeLog('error', `Transaction failed: ${confirmation.value.err}`, token.mint, signature);
        return false;
      }

      this.addTradeLog('buy', `✅ REAL TRADE CONFIRMED! Bought ${token.symbol}`, token.mint, signature);
      this.addTradeLog('info', `Check your wallet for ${token.symbol} tokens!`, token.mint, signature);
      logger.info(`✅ Successfully bought ${token.symbol} - Signature: ${signature}`);
      
      return true;
      
    } catch (error) {
      logger.error(`Error executing real Jupiter swap for ${token.symbol}:`, error);
      this.addTradeLog('error', `Real Jupiter swap failed for ${token.symbol}: ${error}`, token.mint);
      return false;
    }
  }

  private async getBestMemeScannerToken(): Promise<any | null> {
    try {
      // Get trending tokens from MEME SCANNER API
      const response = await axios.get('http://localhost:8000/api/meme-scanner/opportunities', {
        timeout: 5000
      });

      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        this.addTradeLog('info', 'No opportunities found from MEME SCANNER');
        return null;
      }

      // Get the best opportunity (highest scoring token)
      const bestOpportunity = response.data[0];
      
      this.addTradeLog('info', `🎯 MEME SCANNER found: ${bestOpportunity.symbol} (Score: ${bestOpportunity.score})`, bestOpportunity.mint);
      
      return {
        mint: bestOpportunity.mint,
        symbol: bestOpportunity.symbol,
        decimals: 6 // Most meme tokens use 6 decimals
      };
      
    } catch (error) {
      logger.error('Error fetching from MEME SCANNER:', error);
      this.addTradeLog('error', `Failed to get MEME SCANNER data: ${error}`);
      return null;
    }
  }

} 