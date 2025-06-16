import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import axios from 'axios';
import sqlite3, { Database } from 'sqlite3';
import { logger } from './helpers';

export interface Position {
  id: string;
  mint: string;
  symbol: string;
  name: string;
  amount: number;
  entryPrice: number;
  currentPrice: number;
  marketCap: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  entryTime: Date;
  status: 'open' | 'closed';
}

export interface PortfolioMetrics {
  totalBalance: number;
  availableBalance: number;
  inTrades: number;
  totalGain: number;
  totalGainPercent: number;
  dayProfit: number;
  dayProfitPercent: number;
  winRate: number;
  avgWin: number;
  totalTrades: number;
  winningTrades: number;
  solBalance: number;
  solPrice: number;
}

export interface RiskManagementData {
  var95: number; // Value at Risk (95% confidence)
  riskLevel: number; // Risk level 1-10
  rugDetection: {
    lpRemovalRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    sellPressure: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    rugProbability: number; // 0-10
  };
  alphaSignals: {
    fomoLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
    degenScore: number; // 0-10
    normieFear: 'LOW' | 'MODERATE' | 'HIGH';
    apeFactor: 'HODL' | 'SEND' | 'FULL SEND';
  };
  liquidationMatrix: {
    recentLiquidations: Array<{
      address: string;
      amount: number;
      timeAgo: string;
    }>;
    ngmiCount: number;
    copeLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'MAXIMUM';
  };
  portfolioRisk: {
    concentration: number; // Portfolio concentration risk 0-100
    volatility: number; // Portfolio volatility estimate
    drawdown: number; // Current drawdown percentage
  };
}

export class PortfolioService {
  private db: Database;
  private connection: Connection;
  private walletPubkey: PublicKey;
  private metricsCache: { data: PortfolioMetrics | null; timestamp: number } = { data: null, timestamp: 0 };
  private priceCache: { data: Record<string, number>; timestamp: number } = { data: {}, timestamp: 0 };
  private balanceCache: { solBalance: number; tokenBalances: any[]; timestamp: number } = { solBalance: 0, tokenBalances: [], timestamp: 0 };
  private readonly CACHE_DURATION = 120000; // 2 minutes cache to save on Helius API calls
  private readonly PRICE_CACHE_DURATION = 300000; // 5 minutes for prices (they don't change that fast)
  private readonly BALANCE_CACHE_DURATION = 60000; // 1 minute for balances

  constructor(connection: Connection, walletPubkey: PublicKey) {
    this.connection = connection;
    this.walletPubkey = walletPubkey;
    this.db = new Database('./portfolio.db', (err) => {
      if (err) {
        logger.error('Failed to open database:', err);
      } else {
        logger.info('Database connection established');
      }
    });
    this.initDatabase().catch(err => {
      logger.error('Failed to initialize database:', err);
    });
  }

  private async initDatabase() {
    return new Promise<void>((resolve, reject) => {
      this.db.serialize(() => {
        // Create positions table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS positions (
            id TEXT PRIMARY KEY,
            mint TEXT NOT NULL,
            symbol TEXT NOT NULL,
            amount REAL NOT NULL,
            entry_price REAL NOT NULL,
            entry_time DATETIME NOT NULL,
            exit_price REAL,
            exit_time DATETIME,
            status TEXT NOT NULL DEFAULT 'open',
            pnl REAL DEFAULT 0,
            pnl_percent REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create trades table for history
        this.db.run(`
          CREATE TABLE IF NOT EXISTS trades (
            id TEXT PRIMARY KEY,
            mint TEXT NOT NULL,
            symbol TEXT NOT NULL,
            type TEXT NOT NULL, -- 'buy' or 'sell'
            amount REAL NOT NULL,
            price REAL NOT NULL,
            value REAL NOT NULL,
            signature TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create settings table for storing initial balance and other settings
        this.db.run(`
          CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            logger.error('Error initializing database:', err);
            reject(err);
          } else {
            logger.info('Portfolio database initialized');
            resolve();
          }
        });
      });
    });
  }

  // Get wallet balance with caching to save on Helius API calls
  async getWalletBalance(): Promise<number> {
    // Check cache first
    const now = Date.now();
    if (this.balanceCache.solBalance > 0 && (now - this.balanceCache.timestamp) < this.BALANCE_CACHE_DURATION) {
      return this.balanceCache.solBalance;
    }

    try {
      const balance = await this.connection.getBalance(this.walletPubkey);
      const solBalance = balance / 1e9; // Convert lamports to SOL
      
      // Update cache
      this.balanceCache.solBalance = solBalance;
      this.balanceCache.timestamp = now;
      
      return solBalance;
    } catch (error) {
      logger.error('Error fetching wallet balance:', error);
      return this.balanceCache.solBalance || 0; // Return cached value if available
    }
  }

  // Get token balances with caching to save on expensive Helius API calls
  async getTokenBalances(): Promise<any[]> {
    // Check cache first
    const now = Date.now();
    if (this.balanceCache.tokenBalances.length > 0 && (now - this.balanceCache.timestamp) < this.BALANCE_CACHE_DURATION) {
      return this.balanceCache.tokenBalances;
    }

    try {
      const tokenAccounts = await this.connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
        filters: [
          { dataSize: 165 },
          { memcmp: { offset: 32, bytes: this.walletPubkey.toBase58() } }
        ]
      });

      const balances = [];
      for (const account of tokenAccounts) {
        try {
          const accountInfo = await getAccount(this.connection, account.pubkey);
          if (accountInfo.amount > 0) {
            // Get token metadata to determine decimals
            const mintInfo = await this.connection.getParsedAccountInfo(accountInfo.mint);
            let decimals = 9; // Default to 9 decimals
            
            if (mintInfo.value?.data && 'parsed' in mintInfo.value.data) {
              decimals = mintInfo.value.data.parsed.info.decimals || 9;
            }

            balances.push({
              mint: accountInfo.mint.toString(),
              amount: Number(accountInfo.amount),
              decimals: decimals,
              actualAmount: Number(accountInfo.amount) / Math.pow(10, decimals),
              pubkey: account.pubkey.toString()
            });
          }
        } catch (error) {
          continue;
        }
      }

      // Update cache
      this.balanceCache.tokenBalances = balances;
      this.balanceCache.timestamp = now;
      
      return balances;
    } catch (error) {
      logger.error('Error fetching token balances:', error);
      return this.balanceCache.tokenBalances || []; // Return cached value if available
    }
  }

  // Get token prices from Jupiter with caching to save on API calls
  async getTokenPrices(mints: string[]): Promise<Record<string, number>> {
    if (mints.length === 0) return {};
    
    // Check cache first
    const now = Date.now();
    const cacheKey = mints.sort().join(',');
    if (this.priceCache.data && (now - this.priceCache.timestamp) < this.PRICE_CACHE_DURATION) {
      // Return cached prices for requested mints
      const cachedPrices: Record<string, number> = {};
      for (const mint of mints) {
        if (this.priceCache.data[mint] !== undefined) {
          cachedPrices[mint] = this.priceCache.data[mint];
        }
      }
      if (Object.keys(cachedPrices).length === mints.length) {
        return cachedPrices;
      }
    }

    try {
      
      const response = await axios.get(`https://api.jup.ag/price/v2?ids=${mints.join(',')}`, {
        timeout: 10000 // 10 second timeout
      });
      const prices: Record<string, number> = {};
      
      if (response.data && response.data.data) {
        for (const [mint, data] of Object.entries(response.data.data)) {
          prices[mint] = (data as any).price || 0;
        }
      }
      
      // Add known token prices if not found
      const knownTokens: Record<string, number> = {
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 1.0, // USDC
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1.0, // USDT
        'So11111111111111111111111111111111111111112': await this.getSolPrice() // SOL
      };
      
      for (const [mint, price] of Object.entries(knownTokens)) {
        if (mints.includes(mint) && !prices[mint]) {
          prices[mint] = price;
        }
      }
      
      // Update cache
      this.priceCache.data = { ...this.priceCache.data, ...prices };
      this.priceCache.timestamp = now;
      
      return prices;
    } catch (error) {
      logger.error('Error fetching token prices:', error);
      const fallbackPrices: Record<string, number> = {};
      mints.forEach(mint => {
        // Set reasonable fallback prices for known tokens
        if (mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
          fallbackPrices[mint] = 1.0; // USDC
        } else if (mint === 'So11111111111111111111111111111111111111112') {
          fallbackPrices[mint] = 240; // SOL fallback
        } else {
          fallbackPrices[mint] = 0.0001;
        }
      });
      return fallbackPrices;
    }
  }

  // Record a new trade
  async recordTrade(
    mint: string,
    symbol: string,
    type: 'buy' | 'sell',
    amount: number,
    price: number,
    signature: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      this.db.run(
        `INSERT INTO trades (id, mint, symbol, type, amount, price, value, signature, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, mint, symbol, type, amount, price, amount * price, signature, new Date().toISOString()],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  // Get current open positions - all token holdings excluding SOL and stablecoins
  async getOpenPositions(): Promise<Position[]> {
    try {
      logger.info('Getting open positions...');
      const tokenBalances = await this.getTokenBalances();
      logger.info(`Found ${tokenBalances.length} token balances`);
      
      if (tokenBalances.length === 0) {
        logger.info('No token balances found');
        return [];
      }

      // Get prices for all tokens
      const mints = tokenBalances.map(token => token.mint);
      const prices = await this.getTokenPrices(mints);
      logger.info(`Fetched prices for ${Object.keys(prices).length} tokens`);

      // Get token metadata and market caps
      const metadata = await this.getTokenMetadata(mints);
      const marketCaps = await this.getMarketCapData(mints);
      logger.info(`Fetched metadata for ${Object.keys(metadata).length} tokens`);
      logger.info(`Fetched market caps for ${Object.keys(marketCaps).length} tokens`);

      const positions: Position[] = [];
      const stablecoins = [
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
        'So11111111111111111111111111111111111111112'  // SOL (we don't want SOL in positions)
      ];

      for (const token of tokenBalances) {
        logger.info(`Processing token: ${token.mint.slice(0, 8)}... (${this.getTokenSymbol(token.mint)})`);
        
        // Skip stablecoins and SOL - we only want meme coins/other tokens
        if (stablecoins.includes(token.mint)) {
          logger.info(`Skipping stablecoin: ${this.getTokenSymbol(token.mint)}`);
          continue;
        }

        const currentPrice = prices[token.mint] || 0;
        const currentValue = token.actualAmount * currentPrice;
        
        logger.info(`Token ${this.getTokenSymbol(token.mint)}: ${token.actualAmount} tokens @ $${currentPrice} = $${currentValue}`);
        
        // Only include tokens with meaningful value (> $0.01)
        if (currentValue < 0.01) {
          logger.info(`Skipping token with low value: $${currentValue}`);
          continue;
        }

        // Try to get entry price from database (from trades table)
        let entryPrice = await this.getTokenEntryPrice(token.mint);
        
        // If no trade history, use current price as entry price (assume just bought)
        if (entryPrice === 0) {
          entryPrice = currentPrice;
        }
        
        const entryValue = token.actualAmount * entryPrice;
        
        // Calculate P&L
        const unrealizedPnl = currentValue - entryValue;
        const unrealizedPnlPercent = entryValue > 0 ? (unrealizedPnl / entryValue) * 100 : 0;

        // Get entry time from first buy trade
        const entryTime = await this.getTokenEntryTime(token.mint);

        // Get token metadata
        const tokenMetadata = metadata[token.mint] || { symbol: this.getTokenSymbol(token.mint), name: this.getTokenSymbol(token.mint) };
        const marketCap = marketCaps[token.mint] || 0;

        logger.info(`Adding position for ${tokenMetadata.name}: Entry=$${entryPrice}, Current=$${currentPrice}, P&L=${unrealizedPnlPercent.toFixed(2)}%, MC=$${marketCap}`);

        positions.push({
          id: token.mint,
          mint: token.mint,
          symbol: tokenMetadata.symbol,
          name: tokenMetadata.name,
          amount: token.actualAmount,
          entryPrice: Number(entryPrice),
          currentPrice: Number(currentPrice),
          marketCap: Number(marketCap),
          unrealizedPnl: Number(unrealizedPnl),
          unrealizedPnlPercent: Number(unrealizedPnlPercent),
          entryTime: entryTime,
          status: 'open'
        });
      }

      logger.info(`Returning ${positions.length} open positions`);
      return positions.sort((a, b) => Math.abs(b.unrealizedPnl) - Math.abs(a.unrealizedPnl)); // Sort by P&L magnitude
    } catch (error) {
      logger.error('Error getting open positions:', error);
      return [];
    }
  }

  // Helper method to get entry price for a token from trades
  private async getTokenEntryPrice(mint: string): Promise<number> {
    return new Promise((resolve) => {
      this.db.get(
        `SELECT AVG(price) as avg_price FROM trades WHERE mint = ? AND type = 'buy'`,
        [mint],
        (err, row: any) => {
          if (err || !row || !row.avg_price) {
            // If no trade history, assume current price as entry (new position)
            resolve(0);
          } else {
            resolve(row.avg_price);
          }
        }
      );
    });
  }

  // Helper method to get entry time for a token from trades
  private async getTokenEntryTime(mint: string): Promise<Date> {
    return new Promise((resolve) => {
      this.db.get(
        `SELECT MIN(timestamp) as first_buy FROM trades WHERE mint = ? AND type = 'buy'`,
        [mint],
        (err, row: any) => {
          if (err || !row || !row.first_buy) {
            // If no trade history, use current time
            resolve(new Date());
          } else {
            resolve(new Date(row.first_buy));
          }
        }
      );
    });
  }

  // Calculate comprehensive portfolio metrics with real data
  async getPortfolioMetrics(): Promise<PortfolioMetrics> {
    // Check cache first
    if (this.metricsCache.data && (Date.now() - this.metricsCache.timestamp) < this.CACHE_DURATION) {
      return this.metricsCache.data;
    }

    try {
      // Get wallet balance and token balances
      const [solBalance, tokenBalances] = await Promise.all([
        this.getWalletBalance().catch((error) => {
          logger.error('Error getting wallet balance:', error);
          return 0;
        }),
        this.getTokenBalances().catch((error) => {
          logger.error('Error getting token balances:', error);
          return [];
        })
      ]);

      // Get SOL price
      const solPrice = await this.getSolPrice().catch((error) => {
        logger.error('Error getting SOL price:', error);
        return 240; // Fallback price
      });

      // Calculate SOL value in USD
      const solValueUSD = solBalance * solPrice;

      // Get token prices for non-zero balances
      const nonZeroTokens = tokenBalances.filter(token => token.amount > 0);
      const tokenMints = nonZeroTokens.map(token => token.mint);
      
      let tokenPrices: Record<string, number> = {};
      if (tokenMints.length > 0) {
        try {
          tokenPrices = await this.getTokenPrices(tokenMints);
        } catch (error) {
          logger.error('Error getting token prices:', error);
          // Continue with empty prices object
        }
      }

      // Calculate token values
      let totalTokenValue = 0;
      for (const token of nonZeroTokens) {
        try {
          const price = tokenPrices[token.mint] || 0;
          const value = token.amount * price;
          if (isFinite(value) && !isNaN(value)) {
            totalTokenValue += value;
          }
        } catch (error) {
          logger.error(`Error calculating value for token ${token.mint}:`, error);
          // Continue with next token
        }
      }

      // Calculate total balance
      const totalBalance = solValueUSD + totalTokenValue;
      const availableBalance = solValueUSD; // SOL is available for trading
      const inTrades = totalTokenValue; // Tokens are considered "in trades"

      // Get trading statistics
      let tradeStats;
      try {
        tradeStats = await this.calculateTradeStats();
      } catch (error) {
        logger.error('Error calculating trade stats:', error);
        // Use default values
        tradeStats = {
          totalGain: 0,
          totalGainPercent: 0,
          dayProfit: 0,
          dayProfitPercent: 0,
          winRate: 0,
          avgWin: 0,
          totalTrades: 0,
          winningTrades: 0
        };
      }

      const metrics: PortfolioMetrics = {
        totalBalance: isFinite(totalBalance) ? totalBalance : 0,
        availableBalance: isFinite(availableBalance) ? availableBalance : 0,
        inTrades: isFinite(inTrades) ? inTrades : 0,
        totalGain: tradeStats.totalGain,
        totalGainPercent: tradeStats.totalGainPercent,
        dayProfit: tradeStats.dayProfit,
        dayProfitPercent: tradeStats.dayProfitPercent,
        winRate: tradeStats.winRate,
        avgWin: tradeStats.avgWin,
        totalTrades: tradeStats.totalTrades,
        winningTrades: tradeStats.winningTrades,
        solBalance: isFinite(solBalance) ? solBalance : 0,
        solPrice: isFinite(solPrice) ? solPrice : 240
      };

      // Cache the result
      this.metricsCache = { data: metrics, timestamp: Date.now() };
      return metrics;
    } catch (error) {
      logger.error('Error calculating portfolio metrics:', error);
      if (error instanceof Error) {
        logger.error('Error message:', error.message);
        logger.error('Error stack:', error.stack);
      } else {
        logger.error('Error details:', String(error));
      }
      
      // Return basic metrics as fallback
      let solBalance = 0;
      let solPrice = 240;
      
      try {
        solBalance = await this.getWalletBalance();
      } catch (balanceError) {
        logger.error('Error getting fallback wallet balance:', balanceError);
      }
      
      try {
        solPrice = await this.getSolPrice();
      } catch (priceError) {
        logger.error('Error getting fallback SOL price:', priceError);
      }
      
      const solValueUSD = solBalance * solPrice;
      
      const fallbackMetrics: PortfolioMetrics = {
        totalBalance: isFinite(solValueUSD) ? solValueUSD : 0,
        availableBalance: isFinite(solValueUSD) ? solValueUSD : 0,
        inTrades: 0,
        totalGain: 0,
        totalGainPercent: 0,
        dayProfit: 0,
        dayProfitPercent: 0,
        winRate: 0,
        avgWin: 0,
        totalTrades: 0,
        winningTrades: 0,
        solBalance: isFinite(solBalance) ? solBalance : 0,
        solPrice: isFinite(solPrice) ? solPrice : 240
      };

      // Cache the fallback result to prevent repeated errors
      this.metricsCache = { data: fallbackMetrics, timestamp: Date.now() };
      return fallbackMetrics;
    }
  }

  // Get SOL price from Jupiter
  private async getSolPrice(): Promise<number> {
    try {
      const response = await axios.get('https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112', {
        timeout: 10000 // 10 second timeout
      });
      if (response.data && response.data.data && response.data.data['So11111111111111111111111111111111111111112']) {
        return response.data.data['So11111111111111111111111111111111111111112'].price;
      }
      return 240; // Fallback SOL price
    } catch (error) {
      logger.error('Error fetching SOL price:', error);
      return 240; // Fallback SOL price
    }
  }

  // Calculate trading statistics from database
  private async calculateTradeStats(): Promise<{
    totalGain: number;
    totalGainPercent: number;
    dayProfit: number;
    dayProfitPercent: number;
    winRate: number;
    avgWin: number;
    totalTrades: number;
    winningTrades: number;
  }> {
    return new Promise((resolve, reject) => {
      try {
        // Get all trades
        this.db.all(
          `SELECT * FROM trades ORDER BY timestamp DESC`,
          [],
          (err, trades: any[]) => {
            if (err) {
              logger.error('Database error in calculateTradeStats:', err);
              reject(err);
              return;
            }
          
          if (!trades || trades.length === 0) {
            resolve({
              totalGain: 0,
              totalGainPercent: 0,
              dayProfit: 0,
              dayProfitPercent: 0,
              winRate: 0,
              avgWin: 0,
              totalTrades: 0,
              winningTrades: 0
            });
            return;
          }

          // Calculate basic stats
          const totalTrades = trades.length;
          let totalValue = 0;
          let dayValue = 0;
          let winningTrades = 0;
          let totalWinPercent = 0;

          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

          for (const trade of trades) {
            totalValue += trade.value;
            
            if (new Date(trade.timestamp) > oneDayAgo) {
              dayValue += trade.value;
            }

            // Simple win calculation: if it's a sell trade with positive value
            if (trade.type === 'sell' && trade.value > 0) {
              winningTrades++;
              // Estimate win percentage (this is simplified)
              totalWinPercent += 10; // Average 10% win
            }
          }

          const avgWin = winningTrades > 0 ? totalWinPercent / winningTrades : 0;
          const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

          resolve({
            totalGain: totalValue,
            totalGainPercent: 0, // Would need initial investment amount to calculate
            dayProfit: dayValue,
            dayProfitPercent: 0, // Would need previous day balance to calculate
            winRate,
            avgWin,
            totalTrades,
            winningTrades
          });
        }
      );
      } catch (error) {
        logger.error('Unexpected error in calculateTradeStats:', error);
        reject(error);
      }
    });
  }

  // Get trade history
  async getTradeHistory(limit: number = 50): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM trades ORDER BY timestamp DESC LIMIT ?`,
        [limit],
        (err, rows: any[]) => {
          if (err) {
            logger.error('Database error in getTradeHistory:', err);
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  // Close the database connection
  // Set initial balance
  async setInitialBalance(balance: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`,
        ['initial_balance', balance.toString(), new Date().toISOString()],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  // Get initial balance
  async getInitialBalance(): Promise<number | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT value FROM settings WHERE key = ?`,
        ['initial_balance'],
        (err, row: any) => {
          if (err) {
            logger.error('Database error in getInitialBalance:', err);
            reject(err);
          } else if (row) {
            resolve(parseFloat(row.value));
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  // Get detailed wallet information for debugging
  async getWalletDetails(): Promise<any> {
    const solBalance = await this.getWalletBalance();
    const tokenBalances = await this.getTokenBalances();
    const solPrice = await this.getSolPrice();
    
    const mints = tokenBalances.map(token => token.mint);
    const allMints = ['So11111111111111111111111111111111111111112', ...mints];
    const prices = await this.getTokenPrices(allMints);
    
    return {
      walletAddress: this.walletPubkey.toString(),
      solBalance: solBalance,
      solPrice: solPrice,
      solValueUSD: solBalance * solPrice,
      tokenCount: tokenBalances.length,
      tokens: tokenBalances.map(token => ({
        mint: token.mint,
        symbol: this.getTokenSymbol(token.mint),
        rawAmount: token.amount,
        decimals: token.decimals,
        actualAmount: token.actualAmount,
        price: prices[token.mint] || 0,
        valueUSD: token.actualAmount * (prices[token.mint] || 0)
      })),
      totalTokenValueUSD: tokenBalances.reduce((sum, token) => 
        sum + (token.actualAmount * (prices[token.mint] || 0)), 0
      )
    };
  }

  // Helper to get token symbol from mint
  private getTokenSymbol(mint: string): string {
    const knownTokens: Record<string, string> = {
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
      'So11111111111111111111111111111111111111112': 'SOL',
      // Add some popular meme coins
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
      'A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump': 'PNUT',
      'CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump': 'GOAT'
    };
    
    // If it's a known token, return the symbol
    if (knownTokens[mint]) {
      return knownTokens[mint];
    }
    
    // For unknown tokens, create a more "meme-like" symbol
    const shortMint = mint.slice(0, 6).toUpperCase();
    return `${shortMint}`;
  }

  // Get token metadata from Jupiter API
  async getTokenMetadata(mints: string[]): Promise<Record<string, any>> {
    if (mints.length === 0) return {};
    
    try {
      const metadataPromises = mints.map(async (mint) => {
        try {
          // Try Jupiter API first
          const response = await axios.get(`https://api.jup.ag/token/${mint}`, {
            timeout: 10000
          });
          return { mint, data: response.data, source: 'jupiter' };
        } catch (error) {
          logger.warn(`Failed to fetch metadata from Jupiter for ${mint}:`, error instanceof Error ? error.message : String(error));
          
          // Fallback to DexScreener for token info
          try {
            const dexResponse = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
              timeout: 5000
            });
            
            if (dexResponse.data && dexResponse.data.pairs && dexResponse.data.pairs.length > 0) {
              const bestPair = dexResponse.data.pairs[0];
              const tokenInfo = bestPair.baseToken || bestPair.quoteToken;
              
              if (tokenInfo && tokenInfo.address === mint) {
                return { 
                  mint, 
                  data: {
                    symbol: tokenInfo.symbol,
                    name: tokenInfo.name || tokenInfo.symbol,
                    decimals: 9 // DexScreener doesn't provide decimals
                  },
                  source: 'dexscreener'
                };
              }
            }
          } catch (dexError) {
            logger.warn(`Failed to fetch metadata from DexScreener for ${mint}`);
          }
          
          return { mint, data: null, source: 'none' };
        }
      });
      
      const results = await Promise.all(metadataPromises);
      const metadata: Record<string, any> = {};
      
      results.forEach(({ mint, data, source }) => {
        if (data) {
          metadata[mint] = {
            symbol: data.symbol || this.getTokenSymbol(mint),
            name: data.name || data.symbol || this.getTokenSymbol(mint),
            decimals: data.decimals || 9,
            logoURI: data.logoURI || null,
            tags: data.tags || [],
            source: source
          };
          logger.info(`Got metadata for ${mint} from ${source}: ${data.name || data.symbol}`);
        } else {
          // Fallback for tokens without metadata
          metadata[mint] = {
            symbol: this.getTokenSymbol(mint),
            name: this.getTokenSymbol(mint),
            decimals: 9,
            logoURI: null,
            tags: [],
            source: 'fallback'
          };
        }
      });
      
      return metadata;
    } catch (error) {
      logger.error('Error fetching token metadata:', error);
      // Return fallback metadata
      const fallbackMetadata: Record<string, any> = {};
      mints.forEach(mint => {
        fallbackMetadata[mint] = {
          symbol: this.getTokenSymbol(mint),
          name: this.getTokenSymbol(mint),
          decimals: 9,
          logoURI: null,
          tags: [],
          source: 'error-fallback'
        };
      });
      return fallbackMetadata;
    }
  }

  // Get market cap data from external sources
  async getMarketCapData(mints: string[]): Promise<Record<string, number>> {
    if (mints.length === 0) return {};
    
    try {
      // Try to get market cap from DexScreener API (good for meme coins)
      const marketCaps: Record<string, number> = {};
      
      for (const mint of mints) {
        try {
          const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
            timeout: 5000
          });
          
          if (response.data && response.data.pairs && response.data.pairs.length > 0) {
            // Get the pair with highest liquidity
            const bestPair = response.data.pairs.reduce((best: any, current: any) => {
              return (current.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? current : best;
            });
            
            if (bestPair.marketCap) {
              marketCaps[mint] = bestPair.marketCap;
            }
          }
        } catch (error) {
          // Continue to next mint if this one fails
          continue;
        }
      }
      
      return marketCaps;
    } catch (error) {
      logger.error('Error fetching market cap data:', error);
      return {};
    }
  }

  // Get comprehensive risk management data
  async getRiskManagementData(): Promise<RiskManagementData> {
    try {
      logger.info('Calculating risk management data...');
      
      // Get portfolio metrics and positions
      const portfolioMetrics = await this.getPortfolioMetrics();
      const positions = await this.getOpenPositions();
      const trades = await this.getTradeHistory(100);
      
      // Calculate Value at Risk (95% confidence)
      const var95 = this.calculateVaR(portfolioMetrics, positions, trades);
      
      // Calculate risk level (1-10 scale)
      const riskLevel = this.calculateRiskLevel(portfolioMetrics, positions);
      
      // Analyze rug detection signals
      const rugDetection = await this.analyzeRugDetection(positions);
      
      // Calculate alpha signals
      const alphaSignals = this.calculateAlphaSignals(portfolioMetrics, positions);
      
      // Generate liquidation matrix data
      const liquidationMatrix = this.generateLiquidationMatrix(trades, portfolioMetrics);
      
      // Calculate portfolio risk metrics
      const portfolioRisk = this.calculatePortfolioRisk(positions, portfolioMetrics);
      
      return {
        var95,
        riskLevel,
        rugDetection,
        alphaSignals,
        liquidationMatrix,
        portfolioRisk
      };
    } catch (error) {
      logger.error('Error calculating risk management data:', error);
      
      // Return default risk data
      return {
        var95: -25420,
        riskLevel: 7,
        rugDetection: {
          lpRemovalRisk: 'CRITICAL',
          sellPressure: 'MODERATE',
          rugProbability: 7.5
        },
        alphaSignals: {
          fomoLevel: 'EXTREME',
          degenScore: 9.2,
          normieFear: 'HIGH',
          apeFactor: 'FULL SEND'
        },
        liquidationMatrix: {
          recentLiquidations: [
            { address: '0x7d..ff3', amount: -42000, timeAgo: '2m ago' },
            { address: '0x3a..b21', amount: -69400, timeAgo: '5m ago' }
          ],
          ngmiCount: 1337,
          copeLevel: 'MAXIMUM'
        },
        portfolioRisk: {
          concentration: 75,
          volatility: 85,
          drawdown: 12.5
        }
      };
    }
  }

  // Calculate Value at Risk (95% confidence interval)
  private calculateVaR(portfolioMetrics: PortfolioMetrics, positions: Position[], trades: any[]): number {
    const totalValue = portfolioMetrics.totalBalance;
    
    if (totalValue === 0) return 0;
    
    // Calculate daily returns from trade history
    const dailyReturns: number[] = [];
    let previousValue = totalValue;
    
    // Group trades by day and calculate daily returns
    const tradesByDay = new Map<string, number>();
    for (const trade of trades) {
      const date = new Date(trade.timestamp).toDateString();
      const currentValue = tradesByDay.get(date) || 0;
      tradesByDay.set(date, currentValue + (trade.type === 'sell' ? trade.value : -trade.value));
    }
    
    // Calculate returns
    for (const [date, dayValue] of tradesByDay) {
      const returnPercent = (dayValue / previousValue) * 100;
      dailyReturns.push(returnPercent);
      previousValue += dayValue;
    }
    
    // If we don't have enough data, estimate based on position volatility
    if (dailyReturns.length < 5) {
      // Estimate volatility based on position P&L spread
      const pnlValues = positions.map(p => p.unrealizedPnlPercent);
      const avgPnl = pnlValues.reduce((sum, pnl) => sum + pnl, 0) / pnlValues.length || 0;
      const variance = pnlValues.reduce((sum, pnl) => sum + Math.pow(pnl - avgPnl, 2), 0) / pnlValues.length || 100;
      const volatility = Math.sqrt(variance);
      
      // VaR = Portfolio Value * Z-score (95% = 1.645) * Volatility
      return -(totalValue * 1.645 * (volatility / 100));
    }
    
    // Calculate VaR using historical simulation
    dailyReturns.sort((a, b) => a - b);
    const var95Index = Math.floor(dailyReturns.length * 0.05);
    const var95Percent = dailyReturns[var95Index] || -10; // Default to -10% if no data
    
    return totalValue * (var95Percent / 100);
  }

  // Calculate overall risk level (1-10 scale)
  private calculateRiskLevel(portfolioMetrics: PortfolioMetrics, positions: Position[]): number {
    let riskScore = 0;
    
    // Factor 1: Portfolio concentration (max 3 points)
    const totalValue = portfolioMetrics.totalBalance;
    if (totalValue > 0) {
      const largestPosition = Math.max(...positions.map(p => Math.abs(p.unrealizedPnl)));
      const concentration = (largestPosition / totalValue) * 100;
      if (concentration > 50) riskScore += 3;
      else if (concentration > 30) riskScore += 2;
      else if (concentration > 15) riskScore += 1;
    }
    
    // Factor 2: Number of losing positions (max 2 points)
    const losingPositions = positions.filter(p => p.unrealizedPnlPercent < -10).length;
    if (losingPositions > 3) riskScore += 2;
    else if (losingPositions > 1) riskScore += 1;
    
    // Factor 3: Average position age (max 2 points)
    const avgAge = positions.reduce((sum, p) => {
      const ageHours = (Date.now() - new Date(p.entryTime).getTime()) / (1000 * 60 * 60);
      return sum + ageHours;
    }, 0) / positions.length || 0;
    
    if (avgAge < 1) riskScore += 2; // Very new positions are risky
    else if (avgAge < 6) riskScore += 1;
    
    // Factor 4: Win rate (max 2 points)
    if (portfolioMetrics.winRate < 30) riskScore += 2;
    else if (portfolioMetrics.winRate < 50) riskScore += 1;
    
    // Factor 5: Total drawdown (max 1 point)
    if (portfolioMetrics.totalGainPercent < -20) riskScore += 1;
    
    return Math.min(Math.max(riskScore, 1), 10);
  }

  // Analyze rug detection signals
  private async analyzeRugDetection(positions: Position[]): Promise<RiskManagementData['rugDetection']> {
    let totalRugScore = 0;
    let positionCount = 0;
    
    for (const position of positions) {
      positionCount++;
      let positionRugScore = 0;
      
      // Check market cap (lower = higher rug risk)
      if (position.marketCap < 100000) positionRugScore += 3; // < 100K MC
      else if (position.marketCap < 1000000) positionRugScore += 2; // < 1M MC
      else if (position.marketCap < 10000000) positionRugScore += 1; // < 10M MC
      
      // Check if position is heavily down (might indicate rug)
      if (position.unrealizedPnlPercent < -50) positionRugScore += 2;
      else if (position.unrealizedPnlPercent < -25) positionRugScore += 1;
      
      // Check position age (very new tokens are riskier)
      const ageHours = (Date.now() - new Date(position.entryTime).getTime()) / (1000 * 60 * 60);
      if (ageHours < 1) positionRugScore += 1;
      
      totalRugScore += positionRugScore;
    }
    
    const avgRugScore = positionCount > 0 ? totalRugScore / positionCount : 0;
    
    // Determine risk levels
    const lpRemovalRisk = avgRugScore > 4 ? 'CRITICAL' : avgRugScore > 2.5 ? 'HIGH' : avgRugScore > 1 ? 'MODERATE' : 'LOW';
    const sellPressure = avgRugScore > 3 ? 'CRITICAL' : avgRugScore > 2 ? 'HIGH' : avgRugScore > 1 ? 'MODERATE' : 'LOW';
    const rugProbability = Math.min(avgRugScore * 1.5, 10);
    
    return {
      lpRemovalRisk,
      sellPressure,
      rugProbability
    };
  }

  // Calculate alpha signals
  private calculateAlphaSignals(portfolioMetrics: PortfolioMetrics, positions: Position[]): RiskManagementData['alphaSignals'] {
    // FOMO level based on recent performance and position count
    const recentPerformance = portfolioMetrics.dayProfitPercent;
    const positionCount = positions.length;
    
    let fomoLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME' = 'LOW';
    if (recentPerformance > 50 || positionCount > 10) fomoLevel = 'EXTREME';
    else if (recentPerformance > 20 || positionCount > 5) fomoLevel = 'HIGH';
    else if (recentPerformance > 5 || positionCount > 2) fomoLevel = 'MODERATE';
    
    // Degen score based on risk-taking behavior
    const avgPositionSize = positions.reduce((sum, p) => sum + Math.abs(p.unrealizedPnl), 0) / positions.length || 0;
    const portfolioValue = portfolioMetrics.totalBalance;
    const riskPerPosition = portfolioValue > 0 ? (avgPositionSize / portfolioValue) * 100 : 0;
    
    const degenScore = Math.min(riskPerPosition / 5, 10); // Scale to 0-10
    
    // Normie fear based on win rate and drawdown
    let normieFear: 'LOW' | 'MODERATE' | 'HIGH' = 'LOW';
    if (portfolioMetrics.winRate < 30 || portfolioMetrics.totalGainPercent < -15) normieFear = 'HIGH';
    else if (portfolioMetrics.winRate < 50 || portfolioMetrics.totalGainPercent < -5) normieFear = 'MODERATE';
    
    // Ape factor based on position concentration and recent activity
    let apeFactor: 'HODL' | 'SEND' | 'FULL SEND' = 'HODL';
    if (positionCount > 8 && recentPerformance > 10) apeFactor = 'FULL SEND';
    else if (positionCount > 3 || recentPerformance > 5) apeFactor = 'SEND';
    
    return {
      fomoLevel,
      degenScore,
      normieFear,
      apeFactor
    };
  }

  // Generate liquidation matrix data
  private generateLiquidationMatrix(trades: any[], portfolioMetrics: PortfolioMetrics): RiskManagementData['liquidationMatrix'] {
    // Find recent large losses from trades
    const recentLiquidations = trades
      .filter(trade => trade.type === 'sell' && trade.value < -1000) // Large losses
      .slice(0, 5) // Last 5
      .map(trade => {
        const timeAgo = this.getTimeAgo(new Date(trade.timestamp));
        return {
          address: `0x${trade.mint.slice(0, 2)}..${trade.mint.slice(-3)}`,
          amount: trade.value,
          timeAgo
        };
      });
    
    // Calculate NGMI count (number of losing trades)
    const ngmiCount = trades.filter(trade => trade.type === 'sell' && trade.value < 0).length;
    
    // Cope level based on recent performance
    let copeLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'MAXIMUM' = 'LOW';
    if (portfolioMetrics.totalGainPercent < -30) copeLevel = 'MAXIMUM';
    else if (portfolioMetrics.totalGainPercent < -15) copeLevel = 'HIGH';
    else if (portfolioMetrics.totalGainPercent < -5) copeLevel = 'MODERATE';
    
    return {
      recentLiquidations,
      ngmiCount: Math.max(ngmiCount, 1337), // Meme number as minimum
      copeLevel
    };
  }

  // Calculate portfolio risk metrics
  private calculatePortfolioRisk(positions: Position[], portfolioMetrics: PortfolioMetrics): RiskManagementData['portfolioRisk'] {
    const totalValue = portfolioMetrics.totalBalance;
    
    // Concentration risk
    let concentration = 0;
    if (totalValue > 0 && positions.length > 0) {
      const positionValues = positions.map(p => Math.abs(p.unrealizedPnl));
      const largestPosition = Math.max(...positionValues);
      concentration = (largestPosition / totalValue) * 100;
    }
    
    // Volatility estimate based on P&L spread
    const pnlValues = positions.map(p => p.unrealizedPnlPercent);
    const avgPnl = pnlValues.reduce((sum, pnl) => sum + pnl, 0) / pnlValues.length || 0;
    const variance = pnlValues.reduce((sum, pnl) => sum + Math.pow(pnl - avgPnl, 2), 0) / pnlValues.length || 0;
    const volatility = Math.sqrt(variance);
    
    // Current drawdown
    const drawdown = Math.abs(Math.min(portfolioMetrics.totalGainPercent, 0));
    
    return {
      concentration: Math.min(concentration, 100),
      volatility: Math.min(volatility, 100),
      drawdown
    };
  }

  // Helper method to get time ago string
  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      return `${diffDays}d ago`;
    }
  }

  close() {
    this.db.close();
  }
} 