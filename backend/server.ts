import express, { Request, Response } from 'express';
import cors from 'cors';
import { Connection, Commitment, Keypair } from '@solana/web3.js';
import { PortfolioService } from './portfolio-service';
import { MemeScannerService } from './meme-scanner';
import { WhaleTrackerService } from './whale-tracker';
import bs58 from 'bs58';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 8000; // Backend runs on port 8000, frontend on 3000

// Create RPC connection without requiring PRIVATE_KEY
const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
const COMMITMENT_LEVEL: Commitment = process.env.COMMITMENT_LEVEL as Commitment || 'confirmed';

// Create Solana connection for network stats
const connection = new Connection(RPC_ENDPOINT, COMMITMENT_LEVEL);

// Initialize portfolio service if private key is available
let portfolioService: PortfolioService | null = null;
if (process.env.PRIVATE_KEY) {
  try {
    const wallet = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY));
    portfolioService = new PortfolioService(connection, wallet.publicKey);
    console.log(`💼 Portfolio Service initialized for wallet: ${wallet.publicKey.toString().slice(0, 8)}...`);
  } catch (error) {
    console.warn('⚠️  Failed to initialize portfolio service:', error);
  }
}

// Initialize MEME SCANNER service
let memeScannerService: MemeScannerService | null = null;
try {
  memeScannerService = new MemeScannerService(connection);
  console.log('🔍 MEME SCANNER Service initialized');
} catch (error) {
  console.warn('⚠️  Failed to initialize MEME SCANNER service:', error);
}

// Initialize Whale Tracker service
let whaleTrackerService: WhaleTrackerService | null = null;
try {
  whaleTrackerService = new WhaleTrackerService(connection);
  console.log('🐋 Whale Tracker Service initialized');
  // Start tracking whales automatically
  whaleTrackerService.startTracking();
} catch (error) {
  console.warn('⚠️  Failed to initialize Whale Tracker service:', error);
}

console.log(`🔗 Using RPC: ${RPC_ENDPOINT}`);
console.log(`🎯 Commitment Level: ${COMMITMENT_LEVEL}`);

// Middleware
app.use(cors({
  origin: 'http://localhost:3000', // Allow frontend on port 3000
  credentials: true
}));
app.use(express.json());

// State to track bot status
let botRunning = false;
let botProcess: Promise<void> | null = null;

// Cache for network stats (updated every 30 seconds)
let networkStatsCache = {
  gasPrice: 0.000012,
  volume24h: 0,
  transactions24h: 0,
  lastBlock: 0,
  lastBlockTime: new Date(),
  lastUpdated: new Date(),
};

// Function to fetch network statistics
async function updateNetworkStats() {
  try {
    // Get latest block info
    const slot = await connection.getSlot();
    const blockTime = await connection.getBlockTime(slot);
    
    // Get recent performance samples to calculate TPS
    const perfSamples = await connection.getRecentPerformanceSamples(1);
    const tps = perfSamples.length > 0 ? perfSamples[0].numTransactions / perfSamples[0].samplePeriodSecs : 0;
    
    // Estimate daily transactions (TPS * seconds in day)
    const estimatedDailyTransactions = Math.floor(tps * 86400);
    
    // For production, you'd fetch volume from external APIs like:
    // - CoinGecko API for SOL trading volume
    // - Jupiter API for DEX volume
    // - DeFiLlama API for DeFi volume
    // For now, we'll use realistic estimates
    
    networkStatsCache = {
      gasPrice: 0.000012, // Base fee (you could get this from recent priority fees)
      volume24h: 5920000000, // $5.92B - in production, fetch from CoinGecko
      transactions24h: estimatedDailyTransactions > 0 ? estimatedDailyTransactions : 24758691,
      lastBlock: slot,
      lastBlockTime: blockTime ? new Date(blockTime * 1000) : new Date(),
      lastUpdated: new Date(),
    };
    
    console.log('Network stats updated:', {
      slot,
      tps: Math.round(tps),
      estimatedDailyTxns: estimatedDailyTransactions.toLocaleString(),
      blockTime: networkStatsCache.lastBlockTime.toISOString(),
    });
  } catch (error) {
    console.error('Failed to update network stats:', error);
    // Keep the cache if there's an error, but update timestamp
    networkStatsCache.lastUpdated = new Date();
  }
}

// Update network stats every 30 seconds
setInterval(updateNetworkStats, 30000);
// Initial update
updateNetworkStats();

// API endpoint to get network statistics
app.get('/api/network-stats', (req: Request, res: Response) => {
  const timeSinceLastBlock = Math.floor((Date.now() - networkStatsCache.lastBlockTime.getTime()) / 1000);
  
  res.json({
    network: 'SOLANA',
    gasPrice: networkStatsCache.gasPrice,
    volume24h: networkStatsCache.volume24h,
    transactions24h: networkStatsCache.transactions24h,
    lastBlock: networkStatsCache.lastBlock,
    timeSinceLastBlock: timeSinceLastBlock,
    systemActive: true,
    lastUpdated: networkStatsCache.lastUpdated,
  });
});

// API endpoint to get bot status
app.get('/api/status', (req: Request, res: Response) => {
  res.json({ 
    running: botRunning,
    message: botRunning ? 'Bot is running' : 'Bot is stopped'
  });
});

// API endpoint to start the bot
app.post('/api/start', async (req: Request, res: Response) => {
  if (botRunning) {
    return res.status(400).json({ 
      success: false, 
      message: 'Bot is already running' 
    });
  }

  try {
    // Import here to avoid circular dependencies
    const { runListener } = await import('./index');
    const { logger } = await import('./helpers');
    
    logger.info('Starting trading bot from frontend...');
    botRunning = true;
    
    // Start the bot process and handle errors
    botProcess = runListener().catch((error) => {
      console.error('Bot process failed:', error);
      logger.error('Bot process failed:', error);
      botRunning = false;
      botProcess = null;
    });
    
    res.json({ 
      success: true, 
      message: 'Bot started successfully' 
    });
  } catch (error) {
    botRunning = false;
    botProcess = null;
    console.error('Failed to start bot:', error);
    res.status(500).json({ 
      success: false, 
      message: `Failed to start bot: ${error instanceof Error ? error.message : 'Unknown error'}` 
    });
  }
});

// API endpoint to stop the bot
app.post('/api/stop', (req: Request, res: Response) => {
  if (!botRunning) {
    return res.status(400).json({ 
      success: false, 
      message: 'Bot is not running' 
    });
  }

  try {
    console.log('Stopping trading bot from frontend...');
    botRunning = false;
    botProcess = null;
    
    res.json({ 
      success: true, 
      message: 'Bot stopped successfully' 
    });
  } catch (error) {
    console.error('Failed to stop bot:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to stop bot' 
    });
  }
});

// API endpoint to get portfolio metrics
app.get('/api/portfolio', async (req: Request, res: Response) => {
  if (!portfolioService) {
    return res.status(503).json({ 
      error: 'Portfolio service not available. Please check wallet configuration.' 
    });
  }

  try {
    const metrics = await portfolioService.getPortfolioMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Failed to get portfolio metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch portfolio data' 
    });
  }
});

// API endpoint to get active positions
app.get('/api/positions', async (req: Request, res: Response) => {
  if (!portfolioService) {
    return res.status(503).json({ 
      error: 'Portfolio service not available. Please check wallet configuration.' 
    });
  }

  try {
    const positions = await portfolioService.getOpenPositions();
    res.json(positions);
  } catch (error) {
    console.error('Failed to get positions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch positions data' 
    });
  }
});

// API endpoint to set initial balance
app.post('/api/initial-balance', async (req: Request, res: Response) => {
  if (!portfolioService) {
    return res.status(503).json({ 
      error: 'Portfolio service not available. Please check wallet configuration.' 
    });
  }

  try {
    const { balance } = req.body;
    if (typeof balance !== 'number' || balance < 0) {
      return res.status(400).json({ error: 'Invalid balance value' });
    }

    await portfolioService.setInitialBalance(balance);
    res.json({ success: true, message: 'Initial balance set successfully' });
  } catch (error) {
    console.error('Failed to set initial balance:', error);
    res.status(500).json({ 
      error: 'Failed to set initial balance' 
    });
  }
});

// API endpoint to get initial balance
app.get('/api/initial-balance', async (req: Request, res: Response) => {
  if (!portfolioService) {
    return res.status(503).json({ 
      error: 'Portfolio service not available. Please check wallet configuration.' 
    });
  }

  try {
    const initialBalance = await portfolioService.getInitialBalance();
    res.json({ initialBalance });
  } catch (error) {
    console.error('Failed to get initial balance:', error);
    res.status(500).json({ 
      error: 'Failed to fetch initial balance' 
    });
  }
});

// API endpoint to get trade history
app.get('/api/trades', async (req: Request, res: Response) => {
  if (!portfolioService) {
    return res.status(503).json({ 
      error: 'Portfolio service not available. Please check wallet configuration.' 
    });
  }

  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const trades = await portfolioService.getTradeHistory(limit);
    res.json(trades);
  } catch (error) {
    console.error('Failed to get trade history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch trade history' 
    });
  }
});

// API endpoint to get risk management data
app.get('/api/risk-management', async (req: Request, res: Response) => {
  if (!portfolioService) {
    return res.status(503).json({ 
      error: 'Portfolio service not available. Please check wallet configuration.' 
    });
  }

  try {
    const riskData = await portfolioService.getRiskManagementData();
    res.json(riskData);
  } catch (error) {
    console.error('Failed to get risk management data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch risk management data' 
    });
  }
});

// API endpoint to get detailed wallet information (for debugging)
app.get('/api/wallet-details', async (req: Request, res: Response) => {
  if (!portfolioService) {
    return res.status(503).json({ 
      error: 'Portfolio service not available. Please check wallet configuration.' 
    });
  }

  try {
    const details = await portfolioService.getWalletDetails();
    res.json(details);
  } catch (error) {
    console.error('Failed to get wallet details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch wallet details' 
    });
  }
});

// API endpoint to record a trade (for bot integration)
app.post('/api/trade', async (req: Request, res: Response) => {
  if (!portfolioService) {
    return res.status(503).json({ 
      error: 'Portfolio service not available. Please check wallet configuration.' 
    });
  }

  try {
    const { mint, symbol, type, amount, price, signature } = req.body;
    
    if (!mint || !symbol || !type || !amount || !price || !signature) {
      return res.status(400).json({ 
        error: 'Missing required fields: mint, symbol, type, amount, price, signature' 
      });
    }

    await portfolioService.recordTrade(mint, symbol, type, amount, price, signature);
    res.json({ success: true, message: 'Trade recorded successfully' });
  } catch (error) {
    console.error('Failed to record trade:', error);
    res.status(500).json({ 
      error: 'Failed to record trade' 
    });
  }
});

// MEME SCANNER API ENDPOINTS
// =========================

// API endpoint to get MEME SCANNER stats
app.get('/api/meme-scanner/stats', (req: Request, res: Response) => {
  if (!memeScannerService) {
    return res.status(503).json({ 
      error: 'MEME SCANNER service not available.' 
    });
  }

  try {
    const stats = memeScannerService.getStats();
    const connectionStatus = {
      isConnected: memeScannerService.isWebSocketConnected(),
      tokenCount: memeScannerService.getTokenCount(),
    };
    
    res.json({
      ...stats,
      connection: connectionStatus
    });
  } catch (error) {
    console.error('Failed to get MEME SCANNER stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch MEME SCANNER stats' 
    });
  }
});

// API endpoint to get filtered tokens (all tokens that pass criteria)
app.get('/api/meme-scanner/tokens', (req: Request, res: Response) => {
  if (!memeScannerService) {
    return res.status(503).json({ 
      error: 'MEME SCANNER service not available.' 
    });
  }

  try {
    const tokens = memeScannerService.getFilteredTokens();
    res.json(tokens);
  } catch (error) {
    console.error('Failed to get filtered tokens:', error);
    res.status(500).json({ 
      error: 'Failed to fetch filtered tokens' 
    });
  }
});

// API endpoint to get best opportunities (high-scoring tokens)
app.get('/api/meme-scanner/opportunities', (req: Request, res: Response) => {
  if (!memeScannerService) {
    return res.status(503).json({ 
      error: 'MEME SCANNER service not available.' 
    });
  }

  try {
    const opportunities = memeScannerService.getBestOpportunities();
    res.json(opportunities);
  } catch (error) {
    console.error('Failed to get best opportunities:', error);
    res.status(500).json({ 
      error: 'Failed to fetch best opportunities' 
    });
  }
});

// API endpoint to get MEME SCANNER status
app.get('/api/meme-scanner/status', (req: Request, res: Response) => {
  if (!memeScannerService) {
    return res.status(503).json({ 
      error: 'MEME SCANNER service not available.',
      isConnected: false,
      tokenCount: 0
    });
  }

  try {
    res.json({
      isConnected: memeScannerService.isWebSocketConnected(),
      tokenCount: memeScannerService.getTokenCount(),
      service: 'active'
    });
  } catch (error) {
    console.error('Failed to get MEME SCANNER status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch MEME SCANNER status',
      isConnected: false,
      tokenCount: 0
    });
  }
});

// WHALE TRACKER API ENDPOINTS
// ============================

// API endpoint to get whale transactions
app.get('/api/whale-tracker/transactions', (req: Request, res: Response) => {
  if (!whaleTrackerService) {
    return res.status(503).json({ 
      error: 'Whale Tracker service not available.' 
    });
  }

  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const transactions = whaleTrackerService.getRecentTransactions(limit);
    res.json(transactions);
  } catch (error) {
    console.error('Failed to get whale transactions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch whale transactions' 
    });
  }
});

// API endpoint to get whale statistics
app.get('/api/whale-tracker/stats', (req: Request, res: Response) => {
  if (!whaleTrackerService) {
    return res.status(503).json({ 
      error: 'Whale Tracker service not available.' 
    });
  }

  try {
    const stats = whaleTrackerService.getWhaleStats();
    res.json(stats);
  } catch (error) {
    console.error('Failed to get whale stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch whale stats' 
    });
  }
});

// API endpoint to get whale tracker status
app.get('/api/whale-tracker/status', (req: Request, res: Response) => {
  if (!whaleTrackerService) {
    return res.status(503).json({ 
      error: 'Whale Tracker service not available.',
      isActive: false
    });
  }

  try {
    res.json({
      isActive: whaleTrackerService.isActive(),
      service: 'active'
    });
  } catch (error) {
    console.error('Failed to get whale tracker status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch whale tracker status',
      isActive: false
    });
  }
});

// API endpoint to start whale tracking
app.post('/api/whale-tracker/start', async (req: Request, res: Response) => {
  if (!whaleTrackerService) {
    return res.status(503).json({ 
      error: 'Whale Tracker service not available.' 
    });
  }

  try {
    await whaleTrackerService.startTracking();
    res.json({ success: true, message: 'Whale tracking started' });
  } catch (error) {
    console.error('Failed to start whale tracking:', error);
    res.status(500).json({ 
      error: 'Failed to start whale tracking' 
    });
  }
});

// API endpoint to stop whale tracking
app.post('/api/whale-tracker/stop', (req: Request, res: Response) => {
  if (!whaleTrackerService) {
    return res.status(503).json({ 
      error: 'Whale Tracker service not available.' 
    });
  }

  try {
    whaleTrackerService.stopTracking();
    res.json({ success: true, message: 'Whale tracking stopped' });
  } catch (error) {
    console.error('Failed to stop whale tracking:', error);
    res.status(500).json({ 
      error: 'Failed to stop whale tracking' 
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log('\n🚀 SOLANA TRADING BOT BACKEND API');
  console.log('=================================');
  console.log(`🔗 Backend API: http://localhost:${PORT}`);
  console.log('🎯 Frontend should be running on http://localhost:3000');
  console.log('💡 Use the frontend dashboard to control the bot.');
  console.log('=================================\n');
  
  console.log(`Backend API server started on port ${PORT}`);
  console.log('Ready to serve API requests from the frontend.');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  if (botRunning) {
    console.log('⏹️  Stopping trading bot...');
    botRunning = false;
    botProcess = null;
  }
  if (memeScannerService) {
    console.log('🔍 Stopping MEME SCANNER service...');
    memeScannerService.destroy();
  }
  process.exit(0);
});

// Handle uncaught exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
}); 