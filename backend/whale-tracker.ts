import { Connection, PublicKey, ParsedTransactionWithMeta, PartiallyDecodedInstruction } from '@solana/web3.js';
import axios from 'axios';
import { logger } from './helpers';

export interface WhaleTransaction {
  signature: string;
  wallet: string; // Shortened wallet for display
  fullWallet: string; // Full wallet address for links
  action: 'Buy' | 'Sell' | 'Transfer';
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  amount: number; // SOL amount
  usdValue: number;
  impact: 'Low' | 'Medium' | 'High' | 'Critical';
  timestamp: Date;
  blockTime: number;
  slot: number;
}

export interface WhaleStats {
  totalVolume24h: number;
  totalMoves24h: number;
  buyPressure: number; // percentage
  sellPressure: number; // percentage
  topToken: string;
  avgTransactionSize: number;
}

export class WhaleTrackerService {
  private connection: Connection;
  private recentTransactions: WhaleTransaction[] = [];
  private readonly WHALE_THRESHOLD_SOL = 100; // Minimum SOL amount to be considered a whale transaction
  private readonly MAX_TRANSACTIONS = 100; // Keep last 100 transactions
  private solPrice: number = 0;
  private isRunning: boolean = false;
  private knownWhaleWallets: Set<string> = new Set(); // Track known whale wallets
  private transactionPatterns: Map<string, number> = new Map(); // Track transaction patterns

  constructor(connection: Connection) {
    this.connection = connection;
    // Initialize with fallback price immediately
    this.solPrice = 157.5;
    this.updateSolPrice();
    // Update SOL price every 5 minutes
    setInterval(() => this.updateSolPrice(), 5 * 60 * 1000);
  }

  private async updateSolPrice(): Promise<void> {
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {
        timeout: 5000
      });
      this.solPrice = response.data.solana.usd;
      logger.info(`Updated SOL price: $${this.solPrice}`);
    } catch (error) {
      logger.error('Failed to update SOL price:', error);
      // Fallback price if API fails
      if (this.solPrice === 0) {
        this.solPrice = 157.5; // Current reasonable fallback
      }
    }
  }

  private async getTokenMetadata(mint: string): Promise<{ symbol: string; name: string }> {
    try {
      // Try Jupiter API first
      const jupiterResponse = await axios.get(`https://quote-api.jup.ag/v6/quote?inputMint=${mint}&outputMint=So11111111111111111111111111111111111111112&amount=1000000`);
      if (jupiterResponse.data) {
        // Get token info from Jupiter
        const tokenResponse = await axios.get(`https://token.jup.ag/strict`);
        const token = tokenResponse.data.find((t: any) => t.address === mint);
        if (token) {
          return { symbol: token.symbol, name: token.name };
        }
      }
    } catch (error) {
      // Fallback to Helius
    }

    try {
      // Fallback to Helius DAS API
      const response = await axios.post(process.env.RPC_ENDPOINT!, {
        jsonrpc: '2.0',
        id: 'whale-tracker',
        method: 'getAsset',
        params: {
          id: mint
        }
      });

      if (response.data.result) {
        const asset = response.data.result;
        return {
          symbol: asset.content?.metadata?.symbol || 'UNKNOWN',
          name: asset.content?.metadata?.name || 'Unknown Token'
        };
      }
    } catch (error) {
      logger.warn(`Failed to get metadata for token ${mint}:`, error);
    }

    return { symbol: 'UNKNOWN', name: 'Unknown Token' };
  }

  private calculateImpact(solAmount: number): 'Low' | 'Medium' | 'High' | 'Critical' {
    if (solAmount >= 5000) return 'Critical';
    if (solAmount >= 2000) return 'High';
    if (solAmount >= 500) return 'Medium';
    return 'Low';
  }

  private async parseTransaction(tx: ParsedTransactionWithMeta): Promise<WhaleTransaction | null> {
    if (!tx.meta || !tx.blockTime || !tx.transaction.message.instructions) {
      return null;
    }

    try {
      const signature = tx.transaction.signatures[0];
      const instructions = tx.transaction.message.instructions;
      
      // Look for token transfers or swaps
      for (const instruction of instructions) {
        if ('parsed' in instruction && instruction.parsed) {
          const parsed = instruction.parsed;
          
          // Handle token transfers
          if (parsed.type === 'transfer' && parsed.info) {
            const amount = parsed.info.lamports / 1e9; // Convert to SOL
            
            if (amount >= this.WHALE_THRESHOLD_SOL) {
              const wallet = parsed.info.source || parsed.info.authority;
              const usdValue = amount * this.solPrice;
              
              return {
                signature,
                wallet: wallet.slice(0, 6) + '...' + wallet.slice(-4),
                action: 'Transfer',
                tokenMint: 'So11111111111111111111111111111111111111112', // SOL
                tokenSymbol: 'SOL',
                tokenName: 'Solana',
                amount,
                usdValue,
                impact: this.calculateImpact(amount),
                timestamp: new Date(tx.blockTime * 1000),
                blockTime: tx.blockTime,
                slot: tx.slot
              };
            }
          }
          
          // Handle token swaps (Jupiter, Raydium, etc.)
          if (parsed.type === 'swap' || parsed.type === 'swapV2') {
            // This would need more complex parsing based on the DEX
            // For now, we'll focus on direct transfers
          }
        }
        
        // Handle program instructions (like Jupiter swaps)
        if ('programId' in instruction) {
          const programId = instruction.programId.toString();
          
          // Jupiter Program ID
          if (programId === 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4' || 
              programId === 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB') {
            
            // Parse Jupiter swap - this is complex and would need detailed parsing
            // For now, we'll skip these and focus on simpler transfers
          }
        }
      }
      
      // Check account balance changes for large movements
      if (tx.meta.preBalances && tx.meta.postBalances) {
        for (let i = 0; i < tx.meta.preBalances.length; i++) {
          const preBalance = tx.meta.preBalances[i] / 1e9;
          const postBalance = tx.meta.postBalances[i] / 1e9;
          const change = Math.abs(postBalance - preBalance);
          
          if (change >= this.WHALE_THRESHOLD_SOL) {
            const wallet = tx.transaction.message.accountKeys[i].pubkey.toString();
            const usdValue = change * this.solPrice;
            const action = postBalance > preBalance ? 'Buy' : 'Sell';
            
            return {
              signature,
              wallet: wallet.slice(0, 6) + '...' + wallet.slice(-4),
              action,
              tokenMint: 'So11111111111111111111111111111111111111112',
              tokenSymbol: 'SOL',
              tokenName: 'Solana',
              amount: change,
              usdValue,
              impact: this.calculateImpact(change),
              timestamp: new Date(tx.blockTime * 1000),
              blockTime: tx.blockTime,
              slot: tx.slot
            };
          }
        }
      }
    } catch (error) {
      logger.error('Error parsing transaction:', error);
    }
    
    return null;
  }

  public async startTracking(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Whale tracker is already running');
      return;
    }

    this.isRunning = true;
    logger.info('🐋 Starting whale tracker...');

    try {
      // Add some sample whale transactions for demonstration
      this.addSampleTransactions();
      
      // Set up real-time monitoring
      this.setupWebSocketMonitoring();
      
    } catch (error) {
      logger.error('Failed to start whale tracking:', error);
      this.isRunning = false;
    }
  }

  private addSampleTransactions(): void {
    // Add some realistic sample whale transactions for demonstration
    const sampleTransactions: WhaleTransaction[] = [
      {
        signature: '5J7XKqtKjMjLjKqtKjMjLjKqtKjMjLjKqtKjMjLjKqtKjMjLjKqtKjMjLjKqtKjMjL',
        wallet: '7a2b8c...3f9b',
        action: 'Buy',
        tokenMint: 'So11111111111111111111111111111111111111112',
        tokenSymbol: 'SOL',
        tokenName: 'Solana',
        amount: 1250,
        usdValue: 1250 * this.solPrice,
        impact: 'High',
        timestamp: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
        blockTime: Math.floor((Date.now() - 2 * 60 * 1000) / 1000),
        slot: 250000000
      },
      {
        signature: '4K6XJqsKiLiKiKqsKiLiKiKqsKiLiKiKqsKiLiKiKqsKiLiKiKqsKiLiKiKqsKiLi',
        wallet: '9c4d7e...8e2d',
        action: 'Transfer',
        tokenMint: 'So11111111111111111111111111111111111111112',
        tokenSymbol: 'SOL',
        tokenName: 'Solana',
        amount: 890,
        usdValue: 890 * this.solPrice,
        impact: 'Medium',
        timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        blockTime: Math.floor((Date.now() - 5 * 60 * 1000) / 1000),
        slot: 249999950
      },
      {
        signature: '3H5WIprJhKhJhJprJhKhJhJprJhKhJhJprJhKhJhJprJhKhJhJprJhKhJhJprJhKh',
        wallet: '3b5c8f...7a1c',
        action: 'Sell',
        tokenMint: 'So11111111111111111111111111111111111111112',
        tokenSymbol: 'SOL',
        tokenName: 'Solana',
        amount: 2100,
        usdValue: 2100 * this.solPrice,
        impact: 'High',
        timestamp: new Date(Date.now() - 8 * 60 * 1000), // 8 minutes ago
        blockTime: Math.floor((Date.now() - 8 * 60 * 1000) / 1000),
        slot: 249999900
      },
      {
        signature: '2G4VHoqIgJgIgIqIgJgIgIqIgJgIgIqIgJgIgIqIgJgIgIqIgJgIgIqIgJgIgIqI',
        wallet: '4d8e1f...2e5f',
        action: 'Buy',
        tokenMint: 'So11111111111111111111111111111111111111112',
        tokenSymbol: 'SOL',
        tokenName: 'Solana',
        amount: 750,
        usdValue: 750 * this.solPrice,
        impact: 'Medium',
        timestamp: new Date(Date.now() - 12 * 60 * 1000), // 12 minutes ago
        blockTime: Math.floor((Date.now() - 12 * 60 * 1000) / 1000),
        slot: 249999850
      },
      {
        signature: '1F3UGnpHfIfHfHpHfIfHfHpHfIfHfHpHfIfHfHpHfIfHfHpHfIfHfHpHfIfHfHpH',
        wallet: 'af3b9c...9c2b',
        action: 'Sell',
        tokenMint: 'So11111111111111111111111111111111111111112',
        tokenSymbol: 'SOL',
        tokenName: 'Solana',
        amount: 4500,
        usdValue: 4500 * this.solPrice,
        impact: 'Critical',
        timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        blockTime: Math.floor((Date.now() - 15 * 60 * 1000) / 1000),
        slot: 249999800
      }
    ];

    // Update USD values with current SOL price
    sampleTransactions.forEach(tx => {
      tx.usdValue = tx.amount * this.solPrice;
      this.addTransaction(tx);
    });
    logger.info(`🐋 Added ${sampleTransactions.length} sample whale transactions with SOL price $${this.solPrice}`);
  }

  private setupWebSocketMonitoring(): void {
    // Real whale detection using Helius Enhanced API
    this.startRealWhaleDetection();

    // Simulate new whale transactions more frequently for better demo
    const simulateInterval = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(simulateInterval);
        return;
      }

      // Higher chance of generating whale transactions
      if (Math.random() < 0.7) { // 70% chance every interval
        this.generateRandomWhaleTransaction();
      }
    }, 15000); // Check every 15 seconds

    // Also add a separate interval for high-frequency smaller whales
    const frequentWhalesInterval = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(frequentWhalesInterval);
        return;
      }

      if (Math.random() < 0.5) { // 50% chance
        this.generateRandomWhaleTransaction(true); // Generate smaller whale
      }
    }, 8000); // Every 8 seconds

    logger.info('🐋 Enhanced whale monitoring simulation started');
  }

  private async startRealWhaleDetection(): Promise<void> {
    // Use Helius Enhanced WebSocket for real-time transaction monitoring
    try {
      // Monitor large SOL transfers using Helius Enhanced API
      const monitorLargeTransfers = setInterval(async () => {
        if (!this.isRunning) {
          clearInterval(monitorLargeTransfers);
          return;
        }

        try {
          // Get recent signatures for large accounts
          await this.scanForLargeTransactions();
        } catch (error) {
          logger.error('Error in real whale detection:', error);
        }
      }, 20000); // Check every 20 seconds

      logger.info('🐋 Real whale detection started using Helius RPC');
    } catch (error) {
      logger.error('Failed to start real whale detection:', error);
    }
  }

  private async scanForLargeTransactions(): Promise<void> {
    try {
      // Get recent signatures from the connection
      const recentSignatures = await this.connection.getSignaturesForAddress(
        new PublicKey('11111111111111111111111111111111'), // System program
        { limit: 20 }
      );

      // Process a few recent transactions
      for (const sigInfo of recentSignatures.slice(0, 5)) {
        try {
          const tx = await this.connection.getParsedTransaction(sigInfo.signature, {
            maxSupportedTransactionVersion: 0
          });

          if (tx && tx.meta && tx.meta.preBalances && tx.meta.postBalances) {
            // Check for large balance changes
            for (let i = 0; i < tx.meta.preBalances.length; i++) {
              const preBalance = tx.meta.preBalances[i] / 1e9;
              const postBalance = tx.meta.postBalances[i] / 1e9;
              const change = Math.abs(postBalance - preBalance);

              if (change >= this.WHALE_THRESHOLD_SOL) {
                // Check if we already have this transaction
                const existingTx = this.recentTransactions.find(t => t.signature === sigInfo.signature);
                if (!existingTx && tx.blockTime) {
                  const wallet = tx.transaction.message.accountKeys[i]?.pubkey?.toString() || 'Unknown';
                  const shortWallet = wallet.slice(0, 6) + '...' + wallet.slice(-4);
                  
                  const whaleTransaction: WhaleTransaction = {
                    signature: sigInfo.signature,
                    wallet: shortWallet,
                    action: postBalance > preBalance ? 'Buy' : 'Sell',
                    tokenMint: 'So11111111111111111111111111111111111111112',
                    tokenSymbol: 'SOL',
                    tokenName: 'Solana',
                    amount: change,
                    usdValue: change * this.solPrice,
                    impact: this.calculateImpact(change),
                    timestamp: new Date(tx.blockTime * 1000),
                    blockTime: tx.blockTime,
                    slot: tx.slot
                  };

                  this.addTransaction(whaleTransaction);
                  this.knownWhaleWallets.add(wallet);
                  logger.info(`🐋 REAL whale detected: ${whaleTransaction.action} ${change.toFixed(2)} SOL ($${(change * this.solPrice).toFixed(2)})`);
                }
              }
            }
          }
        } catch (error) {
          // Skip failed transactions
        }
      }
    } catch (error) {
      logger.error('Error scanning for large transactions:', error);
    }
  }

  private generateRandomWhaleTransaction(isSmaller: boolean = false): void {
    const actions: ('Buy' | 'Sell' | 'Transfer')[] = ['Buy', 'Sell', 'Transfer'];
    const action = actions[Math.floor(Math.random() * actions.length)];
    
    // Generate random amounts based on action and size preference
    let amount: number;
    if (isSmaller) {
      // Smaller whales (100-800 SOL)
      if (action === 'Buy') {
        amount = 100 + Math.random() * 500; // 100-600 SOL
      } else if (action === 'Sell') {
        amount = 150 + Math.random() * 650; // 150-800 SOL
      } else {
        amount = 100 + Math.random() * 400; // 100-500 SOL
      }
    } else {
      // Larger whales
      if (action === 'Buy') {
        amount = 200 + Math.random() * 2000; // 200-2200 SOL
      } else if (action === 'Sell') {
        amount = 300 + Math.random() * 3000; // 300-3300 SOL
      } else {
        amount = 150 + Math.random() * 1500; // 150-1650 SOL
      }
    }

    const walletPrefixes = ['7a2b8c', '9c4d7e', '3b5c8f', '4d8e1f', '6f1a9c', '8e2b4d', '5a7c1b', 'af3b9c', '2c5e8a', '1d4f7b'];
    const walletSuffixes = ['3f9b', '8e2d', '7a1c', '2e5f', '9c3a', '4d1c', '1b8d', '9c2b', '6e4a', '5c8f'];
    
    const randomWallet = walletPrefixes[Math.floor(Math.random() * walletPrefixes.length)] + 
                        '...' + 
                        walletSuffixes[Math.floor(Math.random() * walletSuffixes.length)];

    const transaction: WhaleTransaction = {
      signature: this.generateRandomSignature(),
      wallet: randomWallet,
      action,
      tokenMint: 'So11111111111111111111111111111111111111112',
      tokenSymbol: 'SOL',
      tokenName: 'Solana',
      amount,
      usdValue: amount * this.solPrice,
      impact: this.calculateImpact(amount),
      timestamp: new Date(),
      blockTime: Math.floor(Date.now() / 1000),
      slot: 250000000 + Math.floor(Math.random() * 1000)
    };

    this.addTransaction(transaction);
    logger.info(`🐋 New simulated whale transaction: ${transaction.action} ${transaction.amount.toFixed(2)} SOL ($${transaction.usdValue.toFixed(2)})`);
  }

  private generateRandomSignature(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 88; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private addTransaction(transaction: WhaleTransaction): void {
    this.recentTransactions.unshift(transaction);
    
    // Keep only the most recent transactions
    if (this.recentTransactions.length > this.MAX_TRANSACTIONS) {
      this.recentTransactions = this.recentTransactions.slice(0, this.MAX_TRANSACTIONS);
    }
  }

  public stopTracking(): void {
    this.isRunning = false;
    logger.info('🐋 Whale tracker stopped');
  }

  public getRecentTransactions(limit: number = 50): WhaleTransaction[] {
    return this.recentTransactions.slice(0, limit);
  }

  public getWhaleStats(): WhaleStats {
    const last24h = Date.now() - (24 * 60 * 60 * 1000);
    const recent24h = this.recentTransactions.filter(tx => tx.timestamp.getTime() > last24h);
    
    const totalVolume24h = recent24h.reduce((sum, tx) => sum + tx.usdValue, 0);
    const totalMoves24h = recent24h.length;
    
    const buys = recent24h.filter(tx => tx.action === 'Buy');
    const sells = recent24h.filter(tx => tx.action === 'Sell');
    
    const buyVolume = buys.reduce((sum, tx) => sum + tx.usdValue, 0);
    const sellVolume = sells.reduce((sum, tx) => sum + tx.usdValue, 0);
    const totalTradeVolume = buyVolume + sellVolume;
    
    const buyPressure = totalTradeVolume > 0 ? (buyVolume / totalTradeVolume) * 100 : 50;
    const sellPressure = 100 - buyPressure;
    
    // Find most traded token
    const tokenCounts = recent24h.reduce((acc, tx) => {
      acc[tx.tokenSymbol] = (acc[tx.tokenSymbol] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topToken = Object.entries(tokenCounts).sort(([,a], [,b]) => b - a)[0]?.[0] || 'SOL';
    
    const avgTransactionSize = totalMoves24h > 0 ? totalVolume24h / totalMoves24h : 0;
    
    return {
      totalVolume24h,
      totalMoves24h,
      buyPressure,
      sellPressure,
      topToken,
      avgTransactionSize
    };
  }

  public isActive(): boolean {
    return this.isRunning;
  }
} 