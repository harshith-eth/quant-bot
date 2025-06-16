import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import axios from 'axios';
import sqlite3, { Database } from 'sqlite3';
import { logger } from './helpers';

export interface Position {
  id: string;
  mint: string;
  symbol: string;
  amount: number;
  entryPrice: number;
  currentPrice: number;
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

        logger.info(`Adding position for ${this.getTokenSymbol(token.mint)}: Entry=$${entryPrice}, Current=$${currentPrice}, P&L=${unrealizedPnlPercent.toFixed(2)}%`);

        positions.push({
          id: token.mint,
          mint: token.mint,
          symbol: this.getTokenSymbol(token.mint),
          amount: token.actualAmount,
          entryPrice: Number(entryPrice),
          currentPrice: Number(currentPrice),
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
    const now = Date.now();
    if (this.metricsCache.data && (now - this.metricsCache.timestamp) < this.CACHE_DURATION) {
      logger.info('Returning cached portfolio metrics');
      return this.metricsCache.data;
    }

    try {
      logger.info('Starting portfolio metrics calculation...');
      const solBalance = await this.getWalletBalance();
      logger.info(`SOL balance: ${solBalance}`);
      
      const tokenBalances = await this.getTokenBalances();
      logger.info(`Token balances count: ${tokenBalances.length}`);
      
      // Get token prices for all held tokens (including SOL)
      const mints = tokenBalances.map(token => token.mint);
      // Add SOL mint for price fetching
      const allMints = ['So11111111111111111111111111111111111111112', ...mints];
      const prices = await this.getTokenPrices(allMints);
      logger.info(`Fetched prices for ${Object.keys(prices).length} tokens`);
    
    // Get SOL price
    const solPrice = prices['So11111111111111111111111111111111111111112'] || await this.getSolPrice();
    logger.info(`SOL price: ${solPrice}`);
    
    // Calculate total token value in USD (excluding SOL)
    let totalTokenValue = 0;
    const tokenDetails = [];
    
    logger.info('Processing token balances...');
    for (const token of tokenBalances) {
      const price = prices[token.mint] || 0;
      const tokenValueUSD = token.actualAmount * price;
      totalTokenValue += tokenValueUSD;
      logger.info(`Token ${token.mint.slice(0, 8)}...: ${token.actualAmount} * ${price} = ${tokenValueUSD}`);
      
      tokenDetails.push({
        mint: token.mint,
        amount: token.actualAmount,
        decimals: token.decimals,
        price: price,
        valueUSD: tokenValueUSD
      });
      
      logger.info(`Token ${token.mint.slice(0, 8)}...: ${token.actualAmount.toFixed(6)} tokens @ $${price.toFixed(6)} = $${tokenValueUSD.toFixed(2)}`);
    }
    
    // SOL value in USD
    const solValueUSD = solBalance * solPrice;
    
    // Total portfolio value in USD (SOL + all tokens)
    const totalPortfolioValue = solValueUSD + totalTokenValue;
    
    logger.info(`Portfolio breakdown:`);
    logger.info(`- SOL: ${solBalance.toFixed(4)} SOL @ $${solPrice.toFixed(2)} = $${solValueUSD.toFixed(2)}`);
    logger.info(`- Tokens: $${totalTokenValue.toFixed(2)}`);
    logger.info(`- Total: $${totalPortfolioValue.toFixed(2)}`);
    
    // Calculate metrics from trade history
    logger.info('Calculating trade stats...');
    const tradeStats = await this.calculateTradeStats();
    logger.info('Trade stats calculated successfully:', tradeStats);
    
    // Get initial balance for gain/loss calculations
    logger.info('Getting initial balance...');
    let initialBalance = await this.getInitialBalance();
    logger.info(`Initial balance: ${initialBalance}`);
    
    let totalGainPercent = 0;
    let totalGain = 0;
    
    if (initialBalance && initialBalance > 0) {
      totalGain = totalPortfolioValue - initialBalance;
      totalGainPercent = (totalGain / initialBalance) * 100;
    }
    
    const metrics = {
      totalBalance: totalPortfolioValue, // Total value in USD (SOL + tokens)
      availableBalance: solValueUSD, // SOL balance in USD (available for trading)
      inTrades: totalTokenValue, // Token holdings in USD (considered "in trades")
      totalGain: totalGain,
      totalGainPercent: totalGainPercent,
      dayProfit: tradeStats.dayProfit,
      dayProfitPercent: tradeStats.dayProfitPercent,
      winRate: tradeStats.winRate,
      avgWin: tradeStats.avgWin,
      totalTrades: tradeStats.totalTrades,
      winningTrades: tradeStats.winningTrades,
      solBalance: solBalance, // SOL balance in SOL
      solPrice: solPrice // Current SOL price in USD
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
      const solBalance = await this.getWalletBalance().catch(() => 0);
      const solPrice = await this.getSolPrice().catch(() => 240);
      const solValueUSD = solBalance * solPrice;
      
      return {
        totalBalance: solValueUSD,
        availableBalance: solValueUSD,
        inTrades: 0,
        totalGain: 0,
        totalGainPercent: 0,
        dayProfit: 0,
        dayProfitPercent: 0,
        winRate: 0,
        avgWin: 0,
        totalTrades: 0,
        winningTrades: 0,
        solBalance: solBalance,
        solPrice: solPrice
      };
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

  close() {
    this.db.close();
  }
} 