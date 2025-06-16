import { Connection } from '@solana/web3.js';
import { MarketStateV3, LiquidityStateV4, Token } from '@raydium-io/raydium-sdk';
import { logger } from './helpers';
import * as fs from 'fs';
import * as path from 'path';

export class MarketCache {
  private markets: Map<string, MarketStateV3> = new Map();

  constructor(private readonly connection: Connection) {}

  async init({ quoteToken }: { quoteToken: Token }): Promise<void> {
    logger.info('Initializing market cache...');
    // Implementation for preloading existing markets if needed
    // This would typically load known markets from RPC or a data source
    logger.info('Market cache initialized');
  }

  save(accountId: string, marketState: MarketStateV3): void {
    this.markets.set(accountId, marketState);
    logger.trace({ accountId }, 'Market saved to cache');
  }

  async get(marketId: string): Promise<MarketStateV3 | undefined> {
    return this.markets.get(marketId);
  }

  size(): number {
    return this.markets.size;
  }
}

export class PoolCache {
  private pools: Map<string, { accountId: string; state: LiquidityStateV4 }> = new Map();

  constructor() {}

  save(accountId: string, poolState: LiquidityStateV4): void {
    const baseMint = poolState.baseMint.toString();
    this.pools.set(baseMint, { accountId, state: poolState });
    logger.trace({ baseMint, accountId }, 'Pool saved to cache');
  }

  async get(baseMint: string): Promise<{ accountId: string; state: LiquidityStateV4 } | undefined> {
    return this.pools.get(baseMint);
  }

  size(): number {
    return this.pools.size;
  }
}

export class SnipeListCache {
  private snipeList: Set<string> = new Set();
  private readonly snipeListPath = path.join(__dirname, 'snipe-list.txt');

  constructor() {}

  init(): void {
    this.loadSnipeList();
    logger.info(`Snipe list cache initialized with ${this.snipeList.size} tokens`);
  }

  private loadSnipeList(): void {
    try {
      if (fs.existsSync(this.snipeListPath)) {
        const content = fs.readFileSync(this.snipeListPath, 'utf8');
        const tokens = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0 && !line.startsWith('#'));
        
        this.snipeList.clear();
        tokens.forEach(token => this.snipeList.add(token));
        logger.info(`Loaded ${this.snipeList.size} tokens from snipe list`);
      } else {
        logger.warn(`Snipe list file not found at ${this.snipeListPath}`);
      }
    } catch (error) {
      logger.error({ error }, 'Failed to load snipe list');
    }
  }

  isInList(mintAddress: string): boolean {
    return this.snipeList.has(mintAddress);
  }

  refresh(): void {
    this.loadSnipeList();
  }

  size(): number {
    return this.snipeList.size;
  }
} 