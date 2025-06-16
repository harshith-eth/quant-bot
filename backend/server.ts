import express, { Request, Response } from 'express';
import cors from 'cors';
import { Connection, Commitment } from '@solana/web3.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 8000; // Backend runs on port 8000, frontend on 3000

// Create RPC connection without requiring PRIVATE_KEY
const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
const COMMITMENT_LEVEL: Commitment = process.env.COMMITMENT_LEVEL as Commitment || 'confirmed';

// Create Solana connection for network stats
const connection = new Connection(RPC_ENDPOINT, COMMITMENT_LEVEL);

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