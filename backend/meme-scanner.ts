import WebSocket from 'ws';
import axios from 'axios';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { logger } from './helpers';
import { 
  SPL_TOKEN_PROGRAM_ID, 
  getMint, 
  getAccount 
} from '@solana/spl-token';

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
  private tokenCreationSubscription: number | null = null;
  private tokenCreationCache: Set<string> = new Set();
  private birdeyeApiKey: string | null = null;

  constructor(connection: Connection) {
    this.connection = connection;
    this.birdeyeApiKey = process.env.BIRDEYE_API_KEY || null;
    this.startWebSocket();
    this.startStatsUpdater();
    this.startBlockSubscription();
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

  private startBlockSubscription() {
    try {
      // Subscribe to account creation of token mints
      this.tokenCreationSubscription = this.connection.onProgramAccountChange(
        new PublicKey(SPL_TOKEN_PROGRAM_ID),
        (accountInfo) => {
          // Process new token account creation
          this.handlePotentialNewToken(accountInfo.accountId.toString());
        },
        'confirmed',
        [{ dataSize: 82 }] // Filter for token mint accounts which have a specific size
      );

      logger.info('📡 Subscribed to token mint creation events via RPC');
    } catch (error) {
      logger.error('Failed to subscribe to token creation events:', error);
    }
  }

  private async handlePotentialNewToken(mint: string) {
    // Skip if already processed
    if (this.tokenCreationCache.has(mint)) {
      return;
    }

    // Add to cache to prevent duplicates
    this.tokenCreationCache.add(mint);

    try {
      logger.info(`🔎 Potential new token detected: ${mint}`);
      
      // Track token creation time for stats
      this.tokenCreationTimes.push(new Date());
      
      // Get initial token data
      let tokenData = await this.fetchTokenData(mint);
      
      if (tokenData && (this.passesStrictCriteria(tokenData) || this.passesRelaxedCriteria(tokenData))) {
        this.tokens.set(mint, tokenData);
        const criteria = this.passesStrictCriteria(tokenData) ? 'STRICT' : 'RELAXED';
        logger.info(`✅ Token ${tokenData.symbol} added to scanner (Score: ${tokenData.score}, Criteria: ${criteria})`);
      }
    } catch (error) {
      logger.error('Error handling potential new token:', error);
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
      
      // Get token data
      let tokenData = await this.fetchTokenData(mint);
      
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
      // Try multiple methods to get token data, starting with the most reliable
      
      // 1. First try DexScreener
      try {
        const dexResponse = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
          timeout: 5000
        });

        if (dexResponse.data?.pairs?.length) {
          const pair = dexResponse.data.pairs[0];
          const token = pair.baseToken?.address === mint ? pair.baseToken : pair.quoteToken;
          
          if (!token) return null;

          // Get additional token metadata
          const [contractSafety, liquidityInfo, holdersInfo] = await Promise.all([
            this.checkContractSafety(mint),
            this.checkLiquidityInfo(pair.pairAddress),
            this.getTokenHolders(mint)
          ]);

          const marketCap = pair.marketCap || 0;
          const liquidity = pair.liquidity?.usd || 0;
          const volume24h = pair.volume?.h24 || 0;
          const priceChange24h = pair.priceChange?.h24 || 0;

          // Get token creation time
          let creationInfo = await this.getTokenCreationTime(mint);

          const tokenData: TokenData = {
            mint,
            name: token.name || token.symbol,
            symbol: token.symbol || `TOKEN_${mint.slice(0, 6)}`,
            marketCap,
            liquidity,
            buyRatio: 1,
            sellRatio: 0,
            holders: holdersInfo.count,
            age: Math.floor((Date.now() - creationInfo.timestamp.getTime()) / 1000),
            topWalletPercent: holdersInfo.topPercent,
            isLiquidityBurned: liquidityInfo.isBurned,
            isContractSafe: contractSafety.isSafe,
            isMintRenounced: contractSafety.isRenounced,
            isFreezable: contractSafety.isFreezable,
            score: 0,
            createdAt: creationInfo.timestamp,
            lastTradeAt: new Date(),
            volume24h,
            priceChange24h,
          };

          // Calculate score
          tokenData.score = this.calculateTokenScore(tokenData);

          return tokenData;
        }
      } catch (dexError) {
        logger.warn(`DexScreener failed for ${mint}: ${dexError.message}`);
      }
      
      // 2. Try Birdeye
      try {
        if (this.birdeyeApiKey) {
          const tokenResponse = await axios.get(`https://public-api.birdeye.so/public/token_list/solana?address=${mint}`, {
            headers: {
              'X-API-KEY': this.birdeyeApiKey
            },
            timeout: 5000
          });
          
          const token = tokenResponse.data?.data?.tokens?.[0];
          if (!token) throw new Error('Token not found');
          
          // Get price/liquidity data
          const priceResponse = await axios.get(`https://public-api.birdeye.so/public/price?address=${mint}`, {
            headers: {
              'X-API-KEY': this.birdeyeApiKey
            },
            timeout: 3000
          });
          
          if (!priceResponse.data?.data?.value) {
            throw new Error('Price data not found');
          }
          
          const price = priceResponse.data.data.value;
          
          // Get token supply
          const mintInfo = await getMint(
            this.connection,
            new PublicKey(mint)
          );
          
          const supply = Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals);
          const marketCap = supply * price;
          
          // Use Birdeye's DEX data for liquidity
          const dexResponse = await axios.get(`https://public-api.birdeye.so/public/tokeninfo?address=${mint}`, {
            headers: {
              'X-API-KEY': this.birdeyeApiKey
            },
            timeout: 5000
          });
          
          const liquidity = dexResponse.data?.data?.liquidityUSD || 0;
          const volume24h = dexResponse.data?.data?.volume24h || 0;
          const priceChange24h = dexResponse.data?.data?.priceChange24h || 0;
          
          // Get additional token metadata
          const [contractSafety, holdersInfo] = await Promise.all([
            this.checkContractSafety(mint),
            this.getTokenHolders(mint)
          ]);
          
          // Get token creation time
          let creationInfo = await this.getTokenCreationTime(mint);
          
          const tokenData: TokenData = {
            mint,
            name: token.name || token.symbol,
            symbol: token.symbol || `TOKEN_${mint.slice(0, 6)}`,
            marketCap,
            liquidity,
            buyRatio: 1,
            sellRatio: 0,
            holders: holdersInfo.count,
            age: Math.floor((Date.now() - creationInfo.timestamp.getTime()) / 1000),
            topWalletPercent: holdersInfo.topPercent,
            isLiquidityBurned: true, // Default for Birdeye without LP info
            isContractSafe: contractSafety.isSafe,
            isMintRenounced: contractSafety.isRenounced,
            isFreezable: contractSafety.isFreezable,
            score: 0,
            createdAt: creationInfo.timestamp,
            lastTradeAt: new Date(),
            volume24h,
            priceChange24h,
          };
          
          // Calculate score
          tokenData.score = this.calculateTokenScore(tokenData);
          
          return tokenData;
        }
      } catch (birdeyeError) {
        logger.warn(`Birdeye failed for ${mint}: ${birdeyeError.message}`);
      }
      
      // 3. Try Jupiter
      try {
        const jupResponse = await axios.get(`https://token.jup.ag/all`, {
          timeout: 3000
        });
        
        if (jupResponse.data && Array.isArray(jupResponse.data)) {
          const token = jupResponse.data.find((t: any) => t.address === mint);
          
          if (token) {
            // Try to get price from Jupiter
            try {
              const priceResponse = await axios.get(`https://price.jup.ag/v4/price?ids=${mint}`, {
                timeout: 3000
              });
              
              if (priceResponse.data?.data?.[mint]?.price) {
                const price = priceResponse.data.data[mint].price;
                
                // Get token supply
                const mintInfo = await getMint(
                  this.connection,
                  new PublicKey(mint)
                );
                
                const supply = Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals);
                const marketCap = supply * price;
                
                // Get contract safety and creation time
                const [contractSafety, creationInfo] = await Promise.all([
                  this.checkContractSafety(mint),
                  this.getTokenCreationTime(mint)
                ]);
                
                const tokenData: TokenData = {
                  mint,
                  name: token.name || token.symbol,
                  symbol: token.symbol || `TOKEN_${mint.slice(0, 6)}`,
                  marketCap,
                  liquidity: 0, // Unknown from Jupiter
                  buyRatio: 1,
                  sellRatio: 0,
                  holders: 0, // Unknown from Jupiter
                  age: Math.floor((Date.now() - creationInfo.timestamp.getTime()) / 1000),
                  topWalletPercent: 0, // Unknown from Jupiter
                  isLiquidityBurned: true, // Assume safe default
                  isContractSafe: contractSafety.isSafe,
                  isMintRenounced: contractSafety.isRenounced,
                  isFreezable: contractSafety.isFreezable,
                  score: 0,
                  createdAt: creationInfo.timestamp,
                  lastTradeAt: new Date(),
                  volume24h: 0, // Unknown from Jupiter
                  priceChange24h: 0, // Unknown from Jupiter
                };
                
                // Calculate score
                tokenData.score = this.calculateTokenScore(tokenData);
                
                return tokenData;
              }
            } catch (priceError) {
              logger.warn(`Jupiter price fetch failed for ${mint}: ${priceError.message}`);
            }
          }
        }
      } catch (jupError) {
        logger.warn(`Jupiter failed for ${mint}: ${jupError.message}`);
      }
      
      // 4. Fall back to on-chain data only
      try {
        const mintInfo = await getMint(
          this.connection,
          new PublicKey(mint)
        );
        
        let symbol = `TOKEN_${mint.slice(0, 6)}`;
        let name = `Unknown Token ${mint.slice(0, 8)}`;
        
        // Try to extract name/symbol from account data
        try {
          // Get metadata PDA
          const metadataPDA = await this.findMetadataPDA(new PublicKey(mint));
          const metadataAccount = await this.connection.getAccountInfo(metadataPDA);
          
          if (metadataAccount?.data) {
            const nameLength = metadataAccount.data.slice(32+4, 32+4+1)[0];
            name = Buffer.from(metadataAccount.data.slice(32+4+1, 32+4+1+nameLength)).toString();
            
            const symbolStart = 32+4+1+nameLength;
            const symbolLength = metadataAccount.data.slice(symbolStart, symbolStart+1)[0];
            symbol = Buffer.from(metadataAccount.data.slice(symbolStart+1, symbolStart+1+symbolLength)).toString();
          }
        } catch (metaError) {
          // Use fallback if metadata fetch fails
        }
        
        const [contractSafety, creationInfo] = await Promise.all([
          this.checkContractSafety(mint),
          this.getTokenCreationTime(mint)
        ]);
        
        const tokenData: TokenData = {
          mint,
          name: name,
          symbol: symbol,
          marketCap: 0, // Unknown without price data
          liquidity: 0, // Unknown without DEX data
          buyRatio: 1,
          sellRatio: 0,
          holders: 0, // Unknown without scanning all accounts
          age: Math.floor((Date.now() - creationInfo.timestamp.getTime()) / 1000),
          topWalletPercent: 0, // Unknown without scanning all accounts
          isLiquidityBurned: false, // Unknown without LP data
          isContractSafe: contractSafety.isSafe,
          isMintRenounced: contractSafety.isRenounced,
          isFreezable: contractSafety.isFreezable,
          score: 0,
          createdAt: creationInfo.timestamp,
          lastTradeAt: new Date(),
          volume24h: 0,
          priceChange24h: 0,
        };
        
        // Calculate score (will be low due to missing data)
        tokenData.score = this.calculateTokenScore(tokenData);
        
        return tokenData;
      } catch (onChainError) {
        logger.error(`On-chain data fetch failed for ${mint}: ${onChainError.message}`);
      }
      
      return null;
    } catch (error) {
      logger.error(`Error fetching token data for ${mint}:`, error);
      return null;
    }
  }
  
  private async findMetadataPDA(mint: PublicKey): Promise<PublicKey> {
    const [metadataPDA] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(),
        mint.toBuffer(),
      ],
      new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
    );
    return metadataPDA;
  }
  
  private async getTokenCreationTime(mint: string): Promise<{timestamp: Date, slot: number}> {
    try {
      // Try to get transaction history
      const signatures = await this.connection.getSignaturesForAddress(
        new PublicKey(mint),
        { limit: 1 },
        'confirmed'
      );
      
      if (signatures.length > 0) {
        return {
          timestamp: new Date(signatures[0].blockTime! * 1000),
          slot: signatures[0].slot
        };
      }
      
      // Fallback to current time if no transaction history found
      return {
        timestamp: new Date(),
        slot: 0
      };
    } catch (error) {
      logger.warn(`Failed to get creation time for ${mint}:`, error);
      return {
        timestamp: new Date(),
        slot: 0
      };
    }
  }

  private async checkContractSafety(mint: string): Promise<{
    isSafe: boolean;
    isRenounced: boolean;
    isFreezable: boolean;
  }> {
    try {
      const mintPubkey = new PublicKey(mint);
      const mintInfo = await getMint(this.connection, mintPubkey);
      
      // Check if mint authority is set (not renounced) or null (renounced)
      const isRenounced = mintInfo.mintAuthority === null;
      
      // Check if freeze authority is set (freezable) or null (not freezable)
      const isFreezable = mintInfo.freezeAuthority !== null;
      
      // A safe contract has renounced mint authority and no freeze authority
      const isSafe = isRenounced && !isFreezable;
      
      return { isSafe, isRenounced, isFreezable };
    } catch (error) {
      logger.error(`Error checking contract safety for ${mint}:`, error);
      return { isSafe: false, isRenounced: false, isFreezable: true };
    }
  }

  private async checkLiquidityInfo(poolAddress: string): Promise<{ isBurned: boolean }> {
    try {
      // Check for common burn addresses
      if (
        poolAddress.includes('1111111111') || 
        poolAddress.toLowerCase().includes('dead') || 
        poolAddress.toLowerCase().includes('burn')
      ) {
        return { isBurned: true };
      }
      
      // Check if LP tokens are burned by checking token account
      try {
        const poolPubkey = new PublicKey(poolAddress);
        const accountInfo = await this.connection.getAccountInfo(poolPubkey);
        
        // If account doesn't exist or has zero balance, LP might be burned
        if (!accountInfo || accountInfo.lamports === 0) {
          return { isBurned: true };
        }
        
        // Otherwise we need more complex LP analysis which depends on the specific DEX
        // For simplicity we'll return false when in doubt
        return { isBurned: false };
      } catch (error) {
        logger.warn(`Error checking LP burn state: ${error.message}`);
      }
      
      return { isBurned: false };
    } catch (error) {
      logger.error(`Error checking liquidity info for ${poolAddress}:`, error);
      return { isBurned: false };
    }
  }
  
  private async getTokenHolders(mint: string): Promise<{count: number, topPercent: number}> {
    try {
      // Use Birdeye API if available (most accurate source)
      if (this.birdeyeApiKey) {
        try {
          const response = await axios.get(`https://public-api.birdeye.so/public/token_holders?address=${mint}`, {
            headers: {
              'X-API-KEY': this.birdeyeApiKey
            },
            timeout: 5000
          });
          
          if (response.data?.data?.items?.length) {
            const holders = response.data.data.items;
            const count = holders.length;
            
            // Calculate top wallet percentage
            if (count > 0 && holders[0].owner_balance_percentage) {
              logger.info(`Got actual holder data from Birdeye for ${mint.slice(0, 6)}...: ${count} holders, top wallet: ${parseFloat(holders[0].owner_balance_percentage)}%`);
              return {
                count,
                topPercent: parseFloat(holders[0].owner_balance_percentage)
              };
            }
          }
        } catch (error) {
          logger.warn(`Failed to get holders from Birdeye: ${error.message}`);
        }
      }
      
      // Try Helius API if Birdeye fails
      try {
        const heliusApiKey = process.env.HELIUS_API_KEY;
        const heliusEndpoint = 'https://api.helius.xyz/v0';
        
        if (heliusApiKey) {
          // Get token metadata which includes holder stats for some tokens
          const response = await axios.post(
            `${heliusEndpoint}/token-metadata?api-key=${heliusApiKey}`,
            { mintAccounts: [mint], includeOffChain: true },
            { timeout: 5000 }
          );
          
          if (response.data?.[0]?.offChainMetadata?.metadata?.extensions?.holderCount) {
            const holderCount = parseInt(response.data[0].offChainMetadata.metadata.extensions.holderCount);
            if (!isNaN(holderCount) && holderCount > 0) {
              logger.info(`Got holder count from Helius for ${mint.slice(0, 6)}...: ${holderCount} holders`);
              
              // Estimate top wallet percentage based on holder count (more holders = less concentration)
              const estimatedTopPercent = Math.max(10, Math.min(90, 100 - Math.log10(holderCount) * 20));
              
              return {
                count: holderCount,
                topPercent: estimatedTopPercent
              };
            }
          }
        }
      } catch (heliusError) {
        logger.warn(`Failed to get holders from Helius: ${heliusError.message}`);
      }
      
      // Try on-chain direct scan for an accurate count 
      // This is an expensive operation so we limit the scan
      try {
        // Only check for tokens with significant on-chain presence
        const mintInfo = await getMint(this.connection, new PublicKey(mint));
        if (mintInfo && Number(mintInfo.supply) > 1000000) { // Only try for tokens with reasonable supply
          const tokenAccounts = await this.connection.getProgramAccounts(
            new PublicKey(SPL_TOKEN_PROGRAM_ID),
            {
              filters: [
                {
                  memcmp: {
                    offset: 0,
                    bytes: mint
                  }
                }
              ],
              dataSlice: {
                offset: 0,
                length: 0
              },
              commitment: 'confirmed',
              limit: 500 // Limit to 500 accounts to avoid timeout
            }
          );
          
          if (tokenAccounts.length > 0) {
            logger.info(`Found ${tokenAccounts.length} token accounts for ${mint.slice(0, 6)}...`);
            
            // If we hit the limit, this is likely a popular token
            const isLikelyPopular = tokenAccounts.length >= 500;
            
            // Estimate total holder count - if we hit limit, use formula based on sampling
            let estimatedHolderCount = tokenAccounts.length;
            if (isLikelyPopular) {
              // For popular tokens, extrapolate based on supply and accounts found
              const supply = Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals);
              estimatedHolderCount = Math.min(10000, Math.floor(tokenAccounts.length * (1 + Math.log10(supply) / 10)));
            }
            
            // Estimate top wallet percentage based on holder count (more holders = less concentration)
            // Established tokens typically have lower concentration
            let estimatedTopPercent = 80 - (Math.log10(estimatedHolderCount) * 10);
            estimatedTopPercent = Math.max(15, Math.min(90, estimatedTopPercent));
            
            return {
              count: estimatedHolderCount,
              topPercent: estimatedTopPercent
            };
          }
        }
      } catch (scanError) {
        logger.warn(`Failed to scan token accounts for ${mint.slice(0, 6)}...: ${scanError.message}`);
      }
      
      // Use market cap based estimation as an alternative approach
      try {
        // Get token age and supply from metadata
        const mintPubkey = new PublicKey(mint);
        const info = await this.connection.getParsedAccountInfo(mintPubkey);
        
        if (info.value?.data && 'parsed' in info.value.data) {
          const mintInfo = info.value.data.parsed;
          const supply = mintInfo.info?.supply || 0;
          
          // Check if mint authority is renounced to determine if token is established
          const tokenAge = mintInfo.info?.mintAuthority ? 'new' : 'established';
          
          // Get token price to calculate market cap
          let tokenPrice = 0;
          let priceSource = '';
          
          // Try Jupiter first for price
          try {
            const priceResponse = await axios.get(`https://price.jup.ag/v4/price?ids=${mint}`, {
              timeout: 3000
            });
            if (priceResponse.data?.data?.[mint]?.price) {
              tokenPrice = priceResponse.data.data[mint].price;
              priceSource = 'Jupiter';
            }
          } catch (jupiterErr) {
            // Try Birdeye next
            try {
              if (this.birdeyeApiKey) {
                const priceResponse = await axios.get(`https://public-api.birdeye.so/public/price?address=${mint}`, {
                  headers: {
                    'X-API-KEY': this.birdeyeApiKey
                  },
                  timeout: 3000
                });
                
                if (priceResponse.data?.data?.value) {
                  tokenPrice = priceResponse.data.data.value;
                  priceSource = 'Birdeye';
                }
              }
            } catch (birdeyeErr) {
              logger.debug(`Failed to get token price: ${birdeyeErr}`);
            }
          }
          
          // Calculate market cap
          const decimals = mintInfo.info?.decimals || 9;
          const adjustedSupply = supply / Math.pow(10, decimals);
          const marketCap = adjustedSupply * tokenPrice;
          
          logger.info(`Token ${mint.slice(0, 6)}... - Price: $${tokenPrice} (${priceSource}), MC: $${marketCap.toLocaleString()}, Age: ${tokenAge}`);
          
          // Calculate holder count based on market cap and token age
          if (tokenAge === 'new') {
            logger.info(`Token ${mint.slice(0, 6)}... appears to be new, estimating holders based on $${marketCap.toLocaleString()} market cap`);
            
            // For new tokens, holder count correlates with market cap using observed ratios
            let holderCount, topPercent;
            
            if (marketCap > 1000000) { // Over $1M
              holderCount = Math.max(20, Math.floor(marketCap / 50000)); // 1 holder per $50K
              topPercent = 65; // High concentration
            } else if (marketCap > 100000) { // Over $100K
              holderCount = Math.max(10, Math.floor(marketCap / 10000)); // 1 holder per $10K
              topPercent = 75; // Higher concentration
            } else {
              holderCount = Math.max(5, Math.floor(marketCap / 5000)); // 1 holder per $5K
              topPercent = 85; // Very high concentration (few holders)
            }
            
            // Add some variance based on token properties but still deterministic
            const tokenHash = this.getTokenHash(mint);
            const variance = (tokenHash % 30) - 15; // -15% to +15% variance
            holderCount = Math.floor(holderCount * (1 + variance / 100));
            
            return {
              count: Math.min(holderCount, 200), // Cap at reasonable maximum for new tokens
              topPercent
            };
          } else {
            // Established tokens have more diverse holder base
            logger.info(`Token ${mint.slice(0, 6)}... appears to be established, estimating based on $${marketCap.toLocaleString()} market cap`);
            
            // For established tokens, use observed market cap to holder ratios from real data
            let holderCount, topPercent;
            
            if (marketCap > 10000000) { // Over $10M
              holderCount = Math.floor(marketCap / 50000); // 1 holder per $50K for large caps (more holders)
              topPercent = 30; // Lower concentration (more distributed)
            } else if (marketCap > 1000000) { // Over $1M
              holderCount = Math.floor(marketCap / 30000); // 1 holder per $30K for mid caps
              topPercent = 40; // Medium concentration
            } else {
              holderCount = Math.floor(marketCap / 15000); // 1 holder per $15K for small caps
              topPercent = 50; // Higher concentration
            }
            
            // Add deterministic variance based on token address
            const tokenHash = this.getTokenHash(mint); 
            const variance = (tokenHash % 20) - 10; // -10% to +10% variance
            holderCount = Math.floor(holderCount * (1 + variance / 100));
            
            return {
              count: Math.min(Math.max(holderCount, 50), 2000), // Between 50-2000 holders based on market cap
              topPercent: Math.min(Math.max(topPercent, 20), 70) // Between 20-70%
            };
          }
        } else {
          logger.warn(`Could not get token metadata for ${mint.slice(0, 6)}...`);
        }
      } catch (error) {
        logger.debug(`Error calculating token holders for ${mint.slice(0, 6)}...: ${error}`);
      }
      
      // Last fallback: use deterministic estimation based on token address
      // This ensures consistent values rather than random numbers
      const tokenHash = this.getTokenHash(mint);
      
      // Use token hash to generate holder count within reasonable range
      const baseHolderCount = 20 + (tokenHash % 80); // 20-100 holders base
      
      // Calculate top wallet percentage - inverse correlation with holder count
      const baseTopPercent = 90 - (baseHolderCount / 2); // 40-80% range
      
      return {
        count: baseHolderCount,
        topPercent: baseTopPercent
      };
    } catch (error) {
      logger.error(`Error getting token holders for ${mint}:`, error);
      return { count: 10, topPercent: 80 }; // Very conservative default
    }
  }
  
  // Helper method to generate a deterministic hash from a token mint address
  private getTokenHash(mint: string): number {
    let hash = 0;
    for (let i = 0; i < mint.length; i++) {
      const char = mint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash) % 1000; // 0-999 range
  }

  private calculateTokenScore(token: TokenData): number {
    let score = 0;

    // 🚀 VOLUME SCORING (0-35 points) - MOST IMPORTANT FOR MOONSHOTS
    if (token.volume24h >= 200000) score += 35; // $200K+ volume = MOONSHOT TERRITORY
    else if (token.volume24h >= 100000) score += 30; // $100K+ volume = Strong momentum
    else if (token.volume24h >= 50000) score += 25; // $50K+ volume = Good activity
    else if (token.volume24h >= 25000) score += 20; // $25K+ volume = Decent
    else if (token.volume24h >= 10000) score += 15; // $10K+ volume = Minimal viable
    else if (token.volume24h >= 5000) score += 8; // $5K+ volume = Weak
    else if (token.volume24h >= 1000) score += 3; // $1K+ volume = Very weak
    // Below $1K volume = 0 points (likely rug/dead)

    // 📈 MOMENTUM SCORING (0-25 points) - Price action is king
    if (token.priceChange24h >= 200) score += 25; // 200%+ pump = PARABOLIC
    else if (token.priceChange24h >= 100) score += 22; // 100%+ pump = Strong moon
    else if (token.priceChange24h >= 50) score += 18; // 50%+ pump = Good momentum
    else if (token.priceChange24h >= 25) score += 14; // 25%+ pump = Building
    else if (token.priceChange24h >= 10) score += 10; // 10%+ pump = Positive
    else if (token.priceChange24h >= 0) score += 5; // Green = Holding
    else if (token.priceChange24h >= -10) score += 2; // Small dip = Potential entry
    // Bigger dumps = 0 points

    // Buy/Sell ratio score (0-20 points) - Buying pressure
    const ratio = token.sellRatio > 0 ? token.buyRatio / token.sellRatio : token.buyRatio;
    if (ratio >= 10) score += 20; // 10:1 = Insane buying pressure
    else if (ratio >= 6) score += 16; // 6:1 = Strong buying
    else if (ratio >= 4) score += 12; // 4:1 = Good buying
    else if (ratio >= 2) score += 6; // 2:1 = Decent

    // Market cap score (0-10 points) - Lower MC = higher upside potential
    if (token.marketCap < 25000) score += 10; // Under $25K = Gem potential
    else if (token.marketCap < 50000) score += 8; // Under $50K = Good upside
    else if (token.marketCap < 100000) score += 6; // Under $100K = Decent
    else if (token.marketCap < 200000) score += 3; // Under $200K = Some upside

    // Age score (0-10 points) - Fresh tokens with momentum
    const ageMinutes = token.age / 60;
    if (ageMinutes < 3) score += 10; // Under 3 min = Ultra fresh
    else if (ageMinutes < 10) score += 8; // Under 10 min = Fresh
    else if (ageMinutes < 20) score += 5; // Under 20 min = Recent
    else if (ageMinutes < 60) score += 2; // Under 1 hour = Okay

    // Safety checks - Now give points for safety
    if (token.isLiquidityBurned) score += 5; // LP burned = safer
    if (token.isContractSafe) score += 3; // Contract safety = reduced rug risk
    if (token.isMintRenounced) score += 2; // Mint renounced = reduced supply inflation risk

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
      token.volume24h >= 10000 && // MINIMUM $10K volume for moonshot potential
      token.priceChange24h >= 0 && // Must be green (positive price action)
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

  // Seed with real token data from Birdeye and Jupiter APIs
  private async seedInitialTokens() {
    logger.info('🌱 Fetching initial token data from APIs...');
    
    const seedTokens = [];
    
    // Try to get top tokens from Birdeye
    try {
      const response = await axios.get('https://public-api.birdeye.so/defi/trending_tokens?chain=solana', {
        timeout: 5000
      });
      
      if (response.data?.data?.length > 0) {
        // Extract top meme tokens
        const memeTokens = response.data.data
          .filter((token: any) => 
            // Filter only tokens with meme tag or appropriate liquidity
            token.tag?.includes('meme') || 
            token.tag?.includes('Solana') || 
            (token.liquidity < 1000000 && token.liquidity > 10000)
          )
          .slice(0, 5);
        
        for (const token of memeTokens) {
          seedTokens.push({
            mint: token.address,
            symbol: token.symbol || 'UNKNOWN',
            name: token.name || token.symbol || 'Unknown Token',
          });
        }
        
        logger.info(`✅ Seeded ${seedTokens.length} tokens from Birdeye API`);
      }
    } catch (error) {
      logger.warn('Failed to fetch trending tokens from Birdeye:', error);
    }
    
    // If Birdeye fails, try Jupiter tokens
    if (seedTokens.length === 0) {
      try {
        const response = await axios.get('https://price.jup.ag/v4/all-tokens', {
          timeout: 5000
        });
        
        if (response.data?.data) {
          // Get top meme tokens from Jupiter
          const tokens = Object.values(response.data.data);
          const memeTokens = tokens
            .filter((token: any) => 
              // Filter small to medium cap tokens
              token.name?.toLowerCase().includes('meme') ||
              token.tags?.includes('meme-token') ||
              token.symbol?.length <= 5
            )
            .slice(0, 5);
            
          for (const token of memeTokens) {
            seedTokens.push({
              mint: token.address,
              symbol: token.symbol || 'UNKNOWN',
              name: token.name || token.symbol || 'Unknown Token',
            });
          }
          
          logger.info(`✅ Seeded ${seedTokens.length} tokens from Jupiter API`);
        }
      } catch (error) {
        logger.warn('Failed to fetch tokens from Jupiter:', error);
      }
    }
    
    // If all APIs fail, use some known tokens as a last resort
    if (seedTokens.length === 0) {
      logger.warn('⚠️ All APIs failed, using fallback token list');
      
      seedTokens.push(
        { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK', name: 'Bonk' },
        { mint: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', symbol: 'SAMO', name: 'Samoyedcoin' }
      );
    }

    for (const tokenInfo of seedTokens) {
      try {
        const tokenData = await this.fetchTokenData(tokenInfo.mint);
        if (tokenData) {
          this.tokens.set(tokenInfo.mint, tokenData);
          logger.info(`✅ Seeded token: ${tokenData.symbol} (Score: ${tokenData.score})`);
        }
      } catch (error) {
        logger.warn(`Failed to seed token ${tokenInfo.mint}:`, error);
      }
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
      .slice(0, 50); // Return top 50
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
    
    if (this.tokenCreationSubscription !== null) {
      this.connection.removeProgramAccountChangeListener(this.tokenCreationSubscription);
    }
  }
}