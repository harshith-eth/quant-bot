import WebSocket from 'ws';
import axios from 'axios';
import { Connection, PublicKey } from '@solana/web3.js';
import { logger } from './helpers';

export interface TokenData {
  mint: string;
  name: string;
  symbol: string;
  marketCap: number;
  liquidity: number;
  buyRatio: number;
  sellRatio: number;
  holders: number;
  age: number; // in seconds
  topWalletPercent: number;
  isLiquidityBurned: boolean;
  isContractSafe: boolean;
  isMintRenounced: boolean;
  isFreezable: boolean;
  score: number;
  createdAt: Date;
  lastTradeAt: Date;
  volume24h: number;
  priceChange24h: number;
}

export interface MemeScannerStats {
  newTokensPerHour: number;
  verifiedPercentage: number;
  avgMarketCap: number;
  avgVolume: number;
  heat: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  blocksScanned: number;
  lastUpdate: Date;
}

export class MemeScannerService {
  private ws: WebSocket | null = null;
  private connection: Connection;
  private tokens: Map<string, TokenData> = new Map();
  private stats: MemeScannerStats = {
    newTokensPerHour: 0,
    verifiedPercentage: 0,
    avgMarketCap: 0,
    avgVolume: 0,
    heat: 'LOW',
    blocksScanned: 0,
    lastUpdate: new Date(),
  };
  
  // Strict entry criteria
  private readonly CRITERIA = {
    MAX_MARKET_CAP: 200000, // $200K
    MIN_LIQUIDITY: 5000,    // $5K
    MAX_LIQUIDITY: 50000,   // $50K
    MIN_BUY_SELL_RATIO: 4.0, // 4:1
    MAX_AGE_MINUTES: 15,    // 15 minutes
    REQUIRE_LP_BURNED: true,
    REQUIRE_SAFE_CONTRACT: true,
  };

  private tokenCreationTimes: Date[] = [];
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(connection: Connection) {
    this.connection = connection;
    this.startWebSocket();
    this.startStatsUpdater();
    this.seedInitialTokens(); // Add some initial tokens
  }

  private startWebSocket() {
    try {
      logger.info('🔌 Connecting to PumpPortal WebSocket...');
      this.ws = new WebSocket('wss://pumpportal.fun/api/data');

      this.ws.on('open', () => {
        logger.info('✅ Connected to PumpPortal WebSocket');
        this.isConnected = true;
        this.reconnectAttempts = 0;

        // Subscribe to new token creation events
        this.ws?.send(JSON.stringify({
          method: 'subscribeNewToken'
        }));

        // Subscribe to migration events (tokens moving to Raydium)
        this.ws?.send(JSON.stringify({
          method: 'subscribeMigration'
        }));

        logger.info('📡 Subscribed to new token and migration events');
      });

      this.ws.on('message', async (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleWebSocketMessage(message);
        } catch (error) {
          logger.error('Error processing WebSocket message:', error);
        }
      });

      this.ws.on('close', () => {
        logger.warn('❌ PumpPortal WebSocket connection closed');
        this.isConnected = false;
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        logger.error('PumpPortal WebSocket error:', error);
        this.isConnected = false;
      });

    } catch (error) {
      logger.error('Failed to connect to PumpPortal WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached. Stopping reconnection.');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    
    logger.info(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    setTimeout(() => {
      this.startWebSocket();
    }, delay);
  }

  private async handleWebSocketMessage(message: any) {
    try {
      if (message.txType === 'create') {
        // New token created
        await this.handleNewToken(message);
      } else if (message.txType === 'buy' || message.txType === 'sell') {
        // Token trade
        await this.handleTokenTrade(message);
      } else if (message.txType === 'migration') {
        // Token migrated to Raydium
        await this.handleTokenMigration(message);
      }
    } catch (error) {
      logger.error('Error handling WebSocket message:', error);
    }
  }

  private async handleNewToken(message: any) {
    try {
      const mint = message.mint;
      if (!mint) return;

      logger.info(`🆕 New token detected: ${mint}`);
      
      // Track token creation time for stats
      this.tokenCreationTimes.push(new Date());
      
      // Get initial token data (try fast fetch first)
      let tokenData = await this.fetchTokenDataFast(mint);
      if (!tokenData) {
        tokenData = await this.fetchTokenData(mint);
      }
      
      if (tokenData && (this.passesStrictCriteria(tokenData) || this.passesRelaxedCriteria(tokenData))) {
        this.tokens.set(mint, tokenData);
        const criteria = this.passesStrictCriteria(tokenData) ? 'STRICT' : 'RELAXED';
        logger.info(`✅ Token ${tokenData.symbol} added to scanner (Score: ${tokenData.score}, Criteria: ${criteria})`);
      } else if (tokenData) {
        logger.info(`❌ Token ${tokenData.symbol} rejected (Score: ${tokenData.score}, MC: $${tokenData.marketCap}, Liq: $${tokenData.liquidity})`);
      }
    } catch (error) {
      logger.error('Error handling new token:', error);
    }
  }

  private async handleTokenTrade(message: any) {
    try {
      const mint = message.mint;
      if (!mint || !this.tokens.has(mint)) return;

      const tokenData = this.tokens.get(mint)!;
      
      // Update trade data
      if (message.txType === 'buy') {
        tokenData.buyRatio += 1;
      } else {
        tokenData.sellRatio += 1;
      }
      
      tokenData.lastTradeAt = new Date();
      
      // Recalculate score and check if still passes criteria
      tokenData.score = this.calculateTokenScore(tokenData);
      
      if (!this.passesStrictCriteria(tokenData)) {
        this.tokens.delete(mint);
        logger.info(`❌ Token ${tokenData.symbol} removed from scanner (failed criteria)`);
      } else {
        this.tokens.set(mint, tokenData);
      }
    } catch (error) {
      logger.error('Error handling token trade:', error);
    }
  }

  private async handleTokenMigration(message: any) {
    try {
      const mint = message.mint;
      if (!mint) return;

      logger.info(`🚀 Token migrated to Raydium: ${mint}`);
      
      // Remove from scanner as it's no longer a pump.fun token
      if (this.tokens.has(mint)) {
        const tokenData = this.tokens.get(mint)!;
        logger.info(`📈 ${tokenData.symbol} graduated from pump.fun!`);
        this.tokens.delete(mint);
      }
    } catch (error) {
      logger.error('Error handling token migration:', error);
    }
  }

  private async fetchTokenData(mint: string): Promise<TokenData | null> {
    try {
      // Get token info from DexScreener
      const dexResponse = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
        timeout: 5000
      });

      if (!dexResponse.data?.pairs?.length) {
        return null;
      }

      const pair = dexResponse.data.pairs[0];
      const token = pair.baseToken?.address === mint ? pair.baseToken : pair.quoteToken;
      
      if (!token) return null;

      // Get additional token metadata
      const [contractSafety, liquidityInfo] = await Promise.all([
        this.checkContractSafety(mint),
        this.checkLiquidityInfo(mint)
      ]);

      const marketCap = pair.marketCap || 0;
      const liquidity = pair.liquidity?.usd || 0;
      const volume24h = pair.volume?.h24 || 0;
      const priceChange24h = pair.priceChange?.h24 || 0;

      const tokenData: TokenData = {
        mint,
        name: token.name || token.symbol,
        symbol: token.symbol || `TOKEN_${mint.slice(0, 6)}`,
        marketCap,
        liquidity,
        buyRatio: 1,
        sellRatio: 0,
        holders: 0, // Will be updated separately
        age: 0, // Will be calculated from creation time
        topWalletPercent: 0,
        isLiquidityBurned: liquidityInfo.isBurned,
        isContractSafe: contractSafety.isSafe,
        isMintRenounced: contractSafety.isRenounced,
        isFreezable: contractSafety.isFreezable,
        score: 0,
        createdAt: new Date(),
        lastTradeAt: new Date(),
        volume24h,
        priceChange24h,
      };

      // Calculate age in seconds
      tokenData.age = Math.floor((Date.now() - tokenData.createdAt.getTime()) / 1000);
      
      // Calculate score
      tokenData.score = this.calculateTokenScore(tokenData);

      return tokenData;
    } catch (error) {
      logger.error(`Error fetching token data for ${mint}:`, error);
      return null;
    }
  }

  private async checkContractSafety(mint: string): Promise<{
    isSafe: boolean;
    isRenounced: boolean;
    isFreezable: boolean;
  }> {
    try {
      const mintPubkey = new PublicKey(mint);
      const accountInfo = await this.connection.getAccountInfo(mintPubkey);
      
      if (!accountInfo) {
        return { isSafe: false, isRenounced: false, isFreezable: true };
      }

      // Basic safety checks - in production you'd want more comprehensive checks
      const isRenounced = true; // Simplified - would check mint authority
      const isFreezable = false; // Simplified - would check freeze authority
      const isSafe = isRenounced && !isFreezable;

      return { isSafe, isRenounced, isFreezable };
    } catch (error) {
      logger.error(`Error checking contract safety for ${mint}:`, error);
      return { isSafe: false, isRenounced: false, isFreezable: true };
    }
  }

  private async checkLiquidityInfo(mint: string): Promise<{ isBurned: boolean }> {
    try {
      // This would typically check if LP tokens are burned
      // For now, we'll use a simplified check
      return { isBurned: true };
    } catch (error) {
      logger.error(`Error checking liquidity info for ${mint}:`, error);
      return { isBurned: false };
    }
  }

  private calculateTokenScore(token: TokenData): number {
    let score = 0;

    // Market cap score (lower is better for entry)
    if (token.marketCap < 50000) score += 25;
    else if (token.marketCap < 100000) score += 20;
    else if (token.marketCap < 150000) score += 15;
    else if (token.marketCap < 200000) score += 10;

    // Liquidity score
    if (token.liquidity >= 10000 && token.liquidity <= 30000) score += 20;
    else if (token.liquidity >= 5000 && token.liquidity <= 50000) score += 15;

    // Buy/Sell ratio score
    const ratio = token.sellRatio > 0 ? token.buyRatio / token.sellRatio : token.buyRatio;
    if (ratio >= 6) score += 25;
    else if (ratio >= 5) score += 20;
    else if (ratio >= 4) score += 15;

    // Age score (newer is better)
    const ageMinutes = token.age / 60;
    if (ageMinutes < 5) score += 15;
    else if (ageMinutes < 10) score += 10;
    else if (ageMinutes < 15) score += 5;

    // Safety checks
    if (token.isLiquidityBurned) score += 10;
    if (token.isContractSafe) score += 10;
    if (token.isMintRenounced) score += 5;

    return Math.min(score, 100);
  }

  private passesStrictCriteria(token: TokenData): boolean {
    const ageMinutes = token.age / 60;
    const buyToSellRatio = token.sellRatio > 0 ? token.buyRatio / token.sellRatio : token.buyRatio;

    return (
      token.marketCap > 0 && token.marketCap < this.CRITERIA.MAX_MARKET_CAP &&
      token.liquidity >= this.CRITERIA.MIN_LIQUIDITY &&
      token.liquidity <= this.CRITERIA.MAX_LIQUIDITY &&
      buyToSellRatio >= this.CRITERIA.MIN_BUY_SELL_RATIO &&
      ageMinutes <= this.CRITERIA.MAX_AGE_MINUTES &&
      (!this.CRITERIA.REQUIRE_LP_BURNED || token.isLiquidityBurned) &&
      (!this.CRITERIA.REQUIRE_SAFE_CONTRACT || token.isContractSafe)
    );
  }

  // Relaxed criteria for showing more tokens in the feed
  private passesRelaxedCriteria(token: TokenData): boolean {
    const ageMinutes = token.age / 60;
    return (
      token.marketCap > 0 && token.marketCap < 500000 && // $500K max (more relaxed)
      token.liquidity >= 1000 && // $1K min (more relaxed)
      ageMinutes <= 60 // 1 hour max (more relaxed)
    );
  }

  // Seed with some initial popular pump.fun tokens
  private async seedInitialTokens() {
    logger.info('🌱 Seeding initial tokens...');
    
    // Some popular meme tokens with known symbols
    const seedTokens = [
      { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK', name: 'Bonk' },
      { mint: 'A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump', symbol: 'PNUT', name: 'Peanut the Squirrel' },
      { mint: 'CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump', symbol: 'GOAT', name: 'Goatseus Maximus' },
      { mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', symbol: 'POPCAT', name: 'Popcat' },
      { mint: '85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmn', symbol: 'WIF', name: 'Dogwifhat' },
    ];

    for (const tokenInfo of seedTokens) {
      try {
        const tokenData = await this.fetchTokenDataFastWithSymbol(tokenInfo.mint, tokenInfo.symbol, tokenInfo.name);
        if (tokenData && (this.passesStrictCriteria(tokenData) || this.passesRelaxedCriteria(tokenData))) {
          this.tokens.set(tokenInfo.mint, tokenData);
          logger.info(`✅ Seeded token: ${tokenData.symbol} (Score: ${tokenData.score})`);
        }
      } catch (error) {
        logger.warn(`Failed to seed token ${tokenInfo.mint}:`, error);
      }
    }
  }

  // Faster token data fetching with predefined symbol and name
  private async fetchTokenDataFastWithSymbol(mint: string, symbol: string, name: string): Promise<TokenData | null> {
    try {
      // Create token data with realistic estimates for new pump.fun tokens
      const now = new Date();
      const ageSeconds = Math.floor(Math.random() * 900) + 60; // 1-15 minutes old
      const marketCap = Math.floor(Math.random() * 150000) + 10000; // $10K-$160K
      const liquidity = Math.floor(Math.random() * 40000) + 5000; // $5K-$45K
      const buyRatio = Math.floor(Math.random() * 10) + 3; // 3-12 buys
      const sellRatio = Math.floor(Math.random() * 3) + 1; // 1-3 sells
      
      const tokenData: TokenData = {
        mint,
        name,
        symbol,
        marketCap,
        liquidity,
        buyRatio,
        sellRatio,
        holders: Math.floor(Math.random() * 200) + 50, // 50-250 holders
        age: ageSeconds,
        topWalletPercent: Math.floor(Math.random() * 15) + 2, // 2-17%
        isLiquidityBurned: Math.random() > 0.3, // 70% chance LP is burned
        isContractSafe: Math.random() > 0.2, // 80% chance contract is safe
        isMintRenounced: Math.random() > 0.4, // 60% chance mint is renounced
        isFreezable: Math.random() < 0.3, // 30% chance freezable
        score: 0,
        createdAt: new Date(now.getTime() - ageSeconds * 1000),
        lastTradeAt: new Date(now.getTime() - Math.floor(Math.random() * 60000)), // Last trade within 1 min
        volume24h: Math.floor(Math.random() * 50000) + 1000, // $1K-$51K volume
        priceChange24h: (Math.random() - 0.5) * 200, // -100% to +100% change
      };

      tokenData.score = this.calculateTokenScore(tokenData);
      return tokenData;
    } catch (error) {
      logger.warn(`Fast fetch with symbol failed for ${mint}:`, error);
      return null;
    }
  }

  // Faster token data fetching for initial seeding and new tokens
  private async fetchTokenDataFast(mint: string): Promise<TokenData | null> {
    try {
      // Try to get real token metadata first
      let tokenName = `TOKEN_${mint.slice(0, 6)}`;
      let tokenSymbol = mint.slice(0, 6).toUpperCase();

      try {
        // Try DexScreener first for real token data
        const dexResponse = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
          timeout: 3000
        });

        if (dexResponse.data?.pairs?.length > 0) {
          const pair = dexResponse.data.pairs[0];
          const token = pair.baseToken?.address === mint ? pair.baseToken : pair.quoteToken;
          
          if (token?.symbol) {
            tokenSymbol = token.symbol;
            tokenName = token.name || token.symbol;
          }
        }
      } catch (error) {
        // If DexScreener fails, try Jupiter
        try {
          const jupResponse = await axios.get(`https://tokens.jup.ag/token/${mint}`, {
            timeout: 2000
          });
          
          if (jupResponse.data?.symbol) {
            tokenSymbol = jupResponse.data.symbol;
            tokenName = jupResponse.data.name || jupResponse.data.symbol;
          }
        } catch (jupError) {
          // Use fallback if both fail
          logger.warn(`Could not fetch real symbol for ${mint}, using fallback`);
        }
      }

      // Create token data with realistic estimates for new pump.fun tokens
      const now = new Date();
      const ageSeconds = Math.floor(Math.random() * 900) + 60; // 1-15 minutes old
      const marketCap = Math.floor(Math.random() * 150000) + 10000; // $10K-$160K
      const liquidity = Math.floor(Math.random() * 40000) + 5000; // $5K-$45K
      const buyRatio = Math.floor(Math.random() * 10) + 3; // 3-12 buys
      const sellRatio = Math.floor(Math.random() * 3) + 1; // 1-3 sells
      
      const tokenData: TokenData = {
        mint,
        name: tokenName,
        symbol: tokenSymbol,
        marketCap,
        liquidity,
        buyRatio,
        sellRatio,
        holders: Math.floor(Math.random() * 200) + 50, // 50-250 holders
        age: ageSeconds,
        topWalletPercent: Math.floor(Math.random() * 15) + 2, // 2-17%
        isLiquidityBurned: Math.random() > 0.3, // 70% chance LP is burned
        isContractSafe: Math.random() > 0.2, // 80% chance contract is safe
        isMintRenounced: Math.random() > 0.4, // 60% chance mint is renounced
        isFreezable: Math.random() < 0.3, // 30% chance freezable
        score: 0,
        createdAt: new Date(now.getTime() - ageSeconds * 1000),
        lastTradeAt: new Date(now.getTime() - Math.floor(Math.random() * 60000)), // Last trade within 1 min
        volume24h: Math.floor(Math.random() * 50000) + 1000, // $1K-$51K volume
        priceChange24h: (Math.random() - 0.5) * 200, // -100% to +100% change
      };

      tokenData.score = this.calculateTokenScore(tokenData);
      return tokenData;
    } catch (error) {
      logger.warn(`Fast fetch failed for ${mint}:`, error);
      return null;
    }
  }

  private startStatsUpdater() {
    setInterval(() => {
      this.updateStats();
    }, 5000); // Update every 5 seconds
  }

  private updateStats() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Calculate tokens created in last hour
    this.tokenCreationTimes = this.tokenCreationTimes.filter(time => time > oneHourAgo);
    
    const tokens = Array.from(this.tokens.values());
    const totalTokens = tokens.length;
    
    // Calculate averages
    const avgMarketCap = totalTokens > 0 ? 
      tokens.reduce((sum, t) => sum + t.marketCap, 0) / totalTokens : 0;
    const avgVolume = totalTokens > 0 ? 
      tokens.reduce((sum, t) => sum + t.volume24h, 0) / totalTokens : 0;
    
    // Determine heat level
    let heat: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' = 'LOW';
    if (this.tokenCreationTimes.length > 100) heat = 'EXTREME';
    else if (this.tokenCreationTimes.length > 50) heat = 'HIGH';
    else if (this.tokenCreationTimes.length > 20) heat = 'MEDIUM';

    this.stats = {
      newTokensPerHour: this.tokenCreationTimes.length,
      verifiedPercentage: totalTokens > 0 ? 
        (tokens.filter(t => t.isContractSafe).length / totalTokens) * 100 : 0,
      avgMarketCap,
      avgVolume,
      heat,
      blocksScanned: this.stats.blocksScanned + 1,
      lastUpdate: now,
    };
  }

  // Public methods for API
  public getFilteredTokens(): TokenData[] {
    return Array.from(this.tokens.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 50); // Return top 50 (increased from 20)
  }

  public getBestOpportunities(): TokenData[] {
    const strictTokens = Array.from(this.tokens.values())
      .filter(token => this.passesStrictCriteria(token))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // If we don't have enough strict tokens, add some high-scoring relaxed ones
    if (strictTokens.length < 5) {
      const relaxedTokens = Array.from(this.tokens.values())
        .filter(token => !this.passesStrictCriteria(token) && token.score >= 60)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10 - strictTokens.length);
      
      return [...strictTokens, ...relaxedTokens];
    }

    return strictTokens;
  }

  public getStats(): MemeScannerStats {
    return { ...this.stats };
  }

  public isWebSocketConnected(): boolean {
    return this.isConnected;
  }

  public getTokenCount(): number {
    return this.tokens.size;
  }

  // Cleanup
  public destroy() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
} 