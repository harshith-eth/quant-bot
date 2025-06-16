import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { Bot } from './bot';
import { logger } from './helpers';
import axios from 'axios';

export interface ImmediateTradingOpportunity {
  mint: string;
  symbol: string;
  name: string;
  poolAddress: string;
  marketCap: number;
  liquidity: number;
  volume24h: number;
  priceChange24h: number;
  score: number;
}

export class ImmediateTrader {
  constructor(
    private connection: Connection,
    private bot: Bot | null,
    private addTradeLog: (type: 'buy' | 'sell' | 'info' | 'error', message: string, mint?: string, signature?: string) => void
  ) {}

  async findAndExecuteTrade(): Promise<boolean> {
    try {
      this.addTradeLog('info', '🔍 Scanning for immediate trading opportunities...');
      
      // Get trending tokens from DexScreener
      const opportunities = await this.getTrendingTokens();
      
      if (opportunities.length === 0) {
        this.addTradeLog('info', 'No suitable trading opportunities found');
        return false;
      }

      // Sort by score and take the best one
      const bestOpportunity = opportunities.sort((a, b) => b.score - a.score)[0];
      
      this.addTradeLog('buy', `🎯 EXECUTING REAL TRADE: ${bestOpportunity.symbol}`, bestOpportunity.mint);
      logger.info(`Trading ${bestOpportunity.symbol} - MC: $${bestOpportunity.marketCap.toLocaleString()}, Vol: $${bestOpportunity.volume24h.toLocaleString()}`);
      
      // Execute the REAL trade using Jupiter
      const success = await this.executeRealTrade(bestOpportunity);
      
      return success;
    } catch (error) {
      logger.error('Error in immediate trading:', error);
      this.addTradeLog('error', `Immediate trading failed: ${error}`);
      return false;
    }
  }

  private async getTrendingTokens(): Promise<ImmediateTradingOpportunity[]> {
    try {
      // Get trending tokens from DexScreener Solana pairs
      const response = await axios.get('https://api.dexscreener.com/latest/dex/pairs/solana', {
        timeout: 10000
      });

      if (!response.data?.pairs) {
        return [];
      }

      const opportunities: ImmediateTradingOpportunity[] = [];

      for (const pair of response.data.pairs.slice(0, 50)) { // Check top 50 pairs
        try {
          // Filter for opportunities - VERY RELAXED FILTERS
          if (
            pair.baseToken?.address &&
            pair.baseToken?.symbol &&
            pair.fdv && pair.fdv > 1000 && pair.fdv < 10000000 && // Market cap between $1K-$10M (much wider range)
            pair.liquidity?.usd && pair.liquidity.usd > 500 && // At least $500 liquidity (much lower)
            pair.volume?.h24 && pair.volume.h24 > 100 && // At least $100 volume (much lower)
            pair.pairAddress
          ) {
            const score = this.calculateOpportunityScore(pair);
            
            if (score > 30) { // Accept lower-scoring opportunities
              opportunities.push({
                mint: pair.baseToken.address,
                symbol: pair.baseToken.symbol,
                name: pair.baseToken.name || pair.baseToken.symbol,
                poolAddress: pair.pairAddress,
                marketCap: pair.fdv,
                liquidity: pair.liquidity.usd,
                volume24h: pair.volume.h24,
                priceChange24h: pair.priceChange.h24,
                score
              });
            }
          }
        } catch (error) {
          // Skip this pair if there's an error
          continue;
        }
      }

      logger.info(`Found ${opportunities.length} immediate trading opportunities`);
      return opportunities;
    } catch (error) {
      logger.error('Error fetching trending tokens:', error);
      return [];
    }
  }

  private calculateOpportunityScore(pair: any): number {
    let score = 50; // Base score

    // Market cap scoring (sweet spot around $50K-$200K)
    const mcap = pair.fdv;
    if (mcap >= 50000 && mcap <= 200000) score += 20;
    else if (mcap >= 20000 && mcap <= 300000) score += 10;
    else if (mcap < 10000 || mcap > 500000) score -= 20;

    // Liquidity scoring
    const liquidity = pair.liquidity?.usd || 0;
    if (liquidity >= 10000 && liquidity <= 50000) score += 15;
    else if (liquidity >= 5000 && liquidity <= 80000) score += 10;
    else if (liquidity < 3000) score -= 15;

    // Volume scoring
    const volume = pair.volume?.h24 || 0;
    if (volume >= 5000) score += 15;
    else if (volume >= 2000) score += 10;
    else if (volume >= 1000) score += 5;
    else score -= 10;

    // Price change scoring (prefer moderate positive movement)
    const priceChange = pair.priceChange?.h24 || 0;
    if (priceChange >= 5 && priceChange <= 25) score += 15;
    else if (priceChange >= 0 && priceChange <= 40) score += 10;
    else if (priceChange < -20 || priceChange > 50) score -= 20;

    // Age scoring (prefer newer tokens but not too new)
    const createdAt = pair.pairCreatedAt;
    if (createdAt) {
      const ageHours = (Date.now() - createdAt) / (1000 * 60 * 60);
      if (ageHours >= 1 && ageHours <= 24) score += 10;
      else if (ageHours <= 72) score += 5;
      else if (ageHours > 168) score -= 5; // Older than a week
    }

    return Math.max(0, Math.min(100, score));
  }

  private async executeRealTrade(opportunity: ImmediateTradingOpportunity): Promise<boolean> {
    try {
      this.addTradeLog('buy', `💰 EXECUTING REAL SWAP: ${opportunity.symbol}`, opportunity.mint);
      
      // Use Jupiter API to get swap transaction
      const WSOL_MINT = 'So11111111111111111111111111111111111111112'; // Wrapped SOL
      const inputMint = WSOL_MINT; // We're buying with SOL
      const outputMint = opportunity.mint; // We're buying this token
      const amount = 400000; // 0.0004 SOL in lamports (ultra small amount)
      const slippageBps = 1000; // 10% slippage
      
      this.addTradeLog('info', `Getting quote for ${opportunity.symbol}...`, opportunity.mint);
      
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
        this.addTradeLog('error', `No quote available for ${opportunity.symbol}`, opportunity.mint);
        return false;
      }

      this.addTradeLog('info', `Quote received! Expected output: ${quoteResponse.data.outAmount} tokens`, opportunity.mint);

      // Get wallet from environment for manual trading
      const { getWallet, PRIVATE_KEY } = await import('./helpers');
      const wallet = getWallet(PRIVATE_KEY.trim());

      // Get swap transaction
      const swapResponse = await axios.post('https://quote-api.jup.ag/v6/swap', {
        quoteResponse: quoteResponse.data,
        userPublicKey: wallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 100000 // 0.0001 SOL priority fee
      }, {
        timeout: 10000
      });

      if (!swapResponse.data?.swapTransaction) {
        this.addTradeLog('error', `Failed to get swap transaction for ${opportunity.symbol}`, opportunity.mint);
        return false;
      }

      this.addTradeLog('buy', `🚀 SENDING TRANSACTION: ${opportunity.symbol}`, opportunity.mint);

      // Deserialize and sign the transaction
      const swapTransactionBuf = Buffer.from(swapResponse.data.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      
      // Sign the transaction
      transaction.sign([wallet]);

      // Send the transaction
      const signature = await this.connection.sendTransaction(transaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3
      });

      this.addTradeLog('buy', `📡 Transaction sent! Signature: ${signature}`, opportunity.mint, signature);

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        this.addTradeLog('error', `Transaction failed: ${confirmation.value.err}`, opportunity.mint, signature);
        return false;
      }

      this.addTradeLog('buy', `✅ TRADE SUCCESSFUL! Bought ${opportunity.symbol}`, opportunity.mint, signature);
      logger.info(`✅ Successfully bought ${opportunity.symbol} - Signature: ${signature}`);
      
      return true;
      
    } catch (error) {
      logger.error(`Error executing real trade for ${opportunity.symbol}:`, error);
      this.addTradeLog('error', `Real trade execution failed for ${opportunity.symbol}: ${error}`, opportunity.mint);
      return false;
    }
  }
} 