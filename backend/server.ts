import express, { Request, Response } from 'express';
import cors from 'cors';
import { Connection, Commitment, Keypair } from '@solana/web3.js';
import { PortfolioService } from './portfolio-service';
import { MemeScannerService } from './meme-scanner';
import { WhaleTrackerService } from './whale-tracker';
import bs58 from 'bs58';
import dotenv from 'dotenv';
import WebSocket from 'ws';
import { createServer } from 'http';
import axios from 'axios';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocket.Server({ 
  server,
  perMessageDeflate: false // Disable compression for better compatibility
});
const PORT = 8000; // Backend runs on port 8000, frontend on 3000

// WebSocket server error handling
wss.on('error', (error) => {
  console.error('❌ WebSocket Server Error:', error);
});

console.log('🔌 WebSocket server initialized');

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
  origin: ['http://localhost:3000', 'http://localhost:3001'], // Allow frontend on both ports
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

// Trade logs storage
interface TradeLog {
  id: string;
  timestamp: Date;
  type: 'buy' | 'sell' | 'info' | 'error';
  message: string;
  mint?: string;
  signature?: string;
  url?: string;
}

let tradeLogs: TradeLog[] = [];
const MAX_LOGS = 100;

// WebSocket clients for trade logs
const tradeLogClients = new Set<WebSocket>();

// Function to broadcast trade logs to all connected clients
function broadcastTradeLog(log: TradeLog) {
  // Add to storage
  tradeLogs.push(log);
  if (tradeLogs.length > MAX_LOGS) {
    tradeLogs = tradeLogs.slice(-MAX_LOGS);
  }

  // Broadcast to all connected clients
  const message = JSON.stringify({ type: 'tradeLog', data: log });
  const clientsToRemove: WebSocket[] = [];
  
  tradeLogClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        console.error('Failed to send message to WebSocket client:', error);
        clientsToRemove.push(client);
      }
    } else {
      clientsToRemove.push(client);
    }
  });

  // Clean up disconnected clients
  clientsToRemove.forEach(client => {
    tradeLogClients.delete(client);
  });

  console.log(`📡 Broadcasted trade log to ${tradeLogClients.size} clients: ${log.message}`);
}

// WebSocket connection handler
wss.on('connection', (ws: WebSocket, req) => {
  console.log(`🔌 New WebSocket client connected from ${req.socket.remoteAddress}`);
  tradeLogClients.add(ws);

  // Send existing logs to new client
  try {
    ws.send(JSON.stringify({ 
      type: 'initialLogs', 
      data: tradeLogs.slice(-50) // Send last 50 logs
    }));
    console.log(`📊 Sent ${tradeLogs.slice(-50).length} initial logs to new client`);
  } catch (error) {
    console.error('Failed to send initial logs to client:', error);
  }

  ws.on('close', (code, reason) => {
    console.log(`🔌 WebSocket client disconnected - Code: ${code}, Reason: ${reason}`);
    tradeLogClients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket client error:', error);
    tradeLogClients.delete(ws);
  });

  // Send a ping every 30 seconds to keep connection alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    } else {
      clearInterval(pingInterval);
    }
  }, 30000);

  ws.on('close', () => {
    clearInterval(pingInterval);
  });
});

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

// Add some sample trade logs for testing
setTimeout(() => {
  addTradeLog('info', '🤖 Trading bot initialized and ready');
  addTradeLog('info', '🔍 Scanning for trading opportunities...');
}, 2000);

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

// API endpoint to check WebSocket server health
app.get('/api/websocket-health', (req: Request, res: Response) => {
  res.json({
    websocketServer: 'running',
    connectedClients: tradeLogClients.size,
    totalLogs: tradeLogs.length,
    lastLogTime: tradeLogs.length > 0 ? tradeLogs[tradeLogs.length - 1].timestamp : null
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
    
    // Add start log
    const startLog: TradeLog = {
      id: `start-${Date.now()}`,
      timestamp: new Date(),
      type: 'info',
      message: '🚀 Bot started successfully - Beginning trade execution...'
    };
    broadcastTradeLog(startLog);
    
    // Start the bot process and handle errors
    botProcess = runListener().catch((error) => {
      console.error('Bot process failed:', error);
      logger.error('Bot process failed:', error);
      botRunning = false;
      botProcess = null;
      
      // Add error log
      const errorLog: TradeLog = {
        id: `error-${Date.now()}`,
        timestamp: new Date(),
        type: 'error',
        message: `❌ Bot process failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      broadcastTradeLog(errorLog);
    });
    
    res.json({ 
      success: true, 
      message: 'Bot started successfully' 
    });
  } catch (error) {
    botRunning = false;
    botProcess = null;
    console.error('Failed to start bot:', error);
    
    // Add error log
    const errorLog: TradeLog = {
      id: `error-${Date.now()}`,
      timestamp: new Date(),
      type: 'error',
      message: `❌ Failed to start bot: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
    broadcastTradeLog(errorLog);
    
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
    
    // Add stop log
    const stopLog: TradeLog = {
      id: `stop-${Date.now()}`,
      timestamp: new Date(),
      type: 'info',
      message: '⏹️ Bot stopped successfully'
    };
    broadcastTradeLog(stopLog);
    
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

// API endpoint to get trade logs
app.get('/api/trade-logs', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = tradeLogs.slice(-limit);
    res.json(logs);
  } catch (error) {
    console.error('Failed to get trade logs:', error);
    res.status(500).json({ 
      error: 'Failed to fetch trade logs' 
    });
  }
});

// API endpoint to clear trade logs
app.delete('/api/trade-logs', (req: Request, res: Response) => {
  try {
    tradeLogs = [];
    
    // Broadcast clear event to all clients
    const message = JSON.stringify({ type: 'clearLogs' });
    tradeLogClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
    
    res.json({ success: true, message: 'Trade logs cleared' });
  } catch (error) {
    console.error('Failed to clear trade logs:', error);
    res.status(500).json({ 
      error: 'Failed to clear trade logs' 
    });
  }
});

// Manual trading endpoints
app.post('/api/manual-buy', async (req: Request, res: Response) => {
  try {
    addTradeLog('info', '🚀 Manual BUY order initiated by user');
    
    // Simple direct Jupiter swap without bot validation
    const success = await executeSimpleBuy();
    
    if (success) {
      res.json({ success: true, message: 'Manual buy order executed successfully' });
    } else {
      res.status(400).json({ success: false, message: 'Buy order failed - check logs for details' });
    }
  } catch (error) {
    console.error('Manual buy failed:', error);
    addTradeLog('error', `Manual buy failed: ${error}`);
    res.status(500).json({ success: false, message: 'Manual buy order failed' });
  }
});

// Simple buy function that works immediately
async function executeSimpleBuy(): Promise<boolean> {
  try {
    addTradeLog('buy', '💰 EXECUTING SIMPLE BUY - Finding trending token...');
    
    // Get a trending token from DexScreener
    const token = await getSimpleTrendingToken();
    if (!token) {
      addTradeLog('error', 'No suitable tokens found for trading');
      return false;
    }
    
    addTradeLog('buy', `🎯 Selected token: ${token.symbol} (${token.name})`, token.mint);
    
    // Execute Jupiter swap
    const success = await executeJupiterSwap(token);
    return success;
    
  } catch (error) {
    addTradeLog('error', `Simple buy failed: ${error}`);
    return false;
  }
}

async function getSimpleTrendingToken(): Promise<any> {
  try {
    addTradeLog('info', '🔍 Checking MEME SCANNER for trending tokens...');
    
    // First, try to get tokens from our MEME SCANNER
    if (memeScannerService) {
      try {
        const opportunities = await memeScannerService.getBestOpportunities();
        if (opportunities && opportunities.length > 0) {
          // Get the highest scoring token that's recent (within last hour)
          const recentTokens = opportunities.filter(token => {
            const ageMinutes = (Date.now() - token.createdAt.getTime()) / (1000 * 60);
            return ageMinutes <= 60; // Within last hour
          });
          
          if (recentTokens.length > 0) {
            const bestToken = recentTokens[0];
            addTradeLog('info', `🎯 MEME SCANNER found fresh token: ${bestToken.symbol} (Score: ${bestToken.score}, Age: ${Math.floor((Date.now() - bestToken.createdAt.getTime()) / (1000 * 60))}min)`, bestToken.mint);
            return {
              mint: bestToken.mint,
              symbol: bestToken.symbol,
              name: bestToken.name || bestToken.symbol
            };
          } else {
            // If no recent tokens, use the best available
            const bestToken = opportunities[0];
            addTradeLog('info', `🎯 MEME SCANNER found: ${bestToken.symbol} (Score: ${bestToken.score})`, bestToken.mint);
            return {
              mint: bestToken.mint,
              symbol: bestToken.symbol,
              name: bestToken.name || bestToken.symbol
            };
          }
        }
      } catch (scannerError) {
        addTradeLog('info', 'MEME SCANNER unavailable, trying other sources...');
      }
    }
    
    // Fallback to popular tokens that are guaranteed to work
    const popularTokens = [
      {
        mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
        symbol: 'BONK',
        name: 'Bonk'
      },
      {
        mint: 'WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk', // WEN
        symbol: 'WEN', 
        name: 'Wen'
      },
      {
        mint: 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82', // BOME
        symbol: 'BOME',
        name: 'Book of Meme'
      }
    ];
    
    // Use a random popular token
    const randomToken = popularTokens[Math.floor(Math.random() * popularTokens.length)];
    addTradeLog('info', `🎲 Using popular token: ${randomToken.symbol}`, randomToken.mint);
    return randomToken;
    
  } catch (error) {
    console.error('Error getting trending token:', error);
    addTradeLog('error', `Error getting token: ${error}`);
    // Return BONK as ultimate fallback
    return {
      mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      symbol: 'BONK',
      name: 'Bonk'
    };
  }
}

async function executeJupiterSwap(token: any): Promise<boolean> {
  try {
    addTradeLog('buy', `💫 Executing Jupiter swap for ${token.symbol}...`, token.mint);
    
    const axios = (await import('axios')).default;
    const { Connection, VersionedTransaction } = await import('@solana/web3.js');
    const { getWallet, RPC_ENDPOINT, COMMITMENT_LEVEL } = await import('./helpers');
    
    const connection = new Connection(RPC_ENDPOINT, COMMITMENT_LEVEL);
    const wallet = getWallet(process.env.PRIVATE_KEY?.trim() || '');
    
    const WSOL_MINT = 'So11111111111111111111111111111111111111112';
    const inputMint = WSOL_MINT; // Buying with SOL
    const outputMint = token.mint; // Buying this token
    const amount = 500000; // 0.0005 SOL (~$0.12)
    const slippageBps = 1500; // 15% slippage
    
    addTradeLog('info', `Getting quote for ${token.symbol}...`, token.mint);
    
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
      timeout: 15000
    });

    if (!quoteResponse.data) {
      addTradeLog('error', `No quote available for ${token.symbol}`, token.mint);
      return false;
    }

    addTradeLog('info', `Quote received! Expected tokens: ${quoteResponse.data.outAmount}`, token.mint);

    // Get swap transaction
    const swapResponse = await axios.post('https://quote-api.jup.ag/v6/swap', {
      quoteResponse: quoteResponse.data,
      userPublicKey: wallet.publicKey.toString(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 200000 // Higher priority fee
    }, {
      timeout: 15000
    });

    if (!swapResponse.data?.swapTransaction) {
      addTradeLog('error', `Failed to get swap transaction for ${token.symbol}`, token.mint);
      return false;
    }

    addTradeLog('buy', `🚀 Sending transaction for ${token.symbol}...`, token.mint);

    // Execute transaction
    const swapTransactionBuf = Buffer.from(swapResponse.data.swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    transaction.sign([wallet]);

    const signature = await connection.sendTransaction(transaction, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3
    });

    addTradeLog('buy', `📡 Transaction sent! Signature: ${signature}`, token.mint, signature);

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      addTradeLog('error', `Transaction failed: ${confirmation.value.err}`, token.mint, signature);
      return false;
    }

    addTradeLog('buy', `✅ BUY SUCCESSFUL! Bought ${token.symbol}`, token.mint, signature);
    addTradeLog('info', `🎉 Check your wallet for ${token.symbol} tokens!`, token.mint);
    
    return true;
    
  } catch (error) {
    addTradeLog('error', `Jupiter swap failed: ${error}`, token.mint);
    return false;
  }
}

app.post('/api/manual-sell', async (req: Request, res: Response) => {
  try {
    addTradeLog('info', '📉 Manual SELL order initiated by user');
    
    if (!portfolioService) {
      return res.status(503).json({ 
        success: false, 
        message: 'Portfolio service not available. Please check wallet configuration.' 
      });
    }

    // Get current positions to sell
    const positions = await portfolioService.getOpenPositions();
    
    if (positions.length === 0) {
      addTradeLog('info', 'No open positions to sell');
      return res.json({ success: false, message: 'No open positions to sell' });
    }

    // Execute REAL sell for the first position
    const position = positions[0];
    addTradeLog('sell', `🔥 REAL SELL ORDER: ${position.symbol}`, position.mint);
    
    try {
      // Import Jupiter API functionality
      const { Connection, VersionedTransaction } = await import('@solana/web3.js');
      const { getWallet, RPC_ENDPOINT, COMMITMENT_LEVEL } = await import('./helpers');
      const axios = (await import('axios')).default;
      
      const connection = new Connection(RPC_ENDPOINT, COMMITMENT_LEVEL);
      const wallet = getWallet(process.env.PRIVATE_KEY?.trim() || '');
      
      // Use Jupiter to sell the token back to SOL
      const WSOL_MINT = 'So11111111111111111111111111111111111111112';
      const inputMint = position.mint; // Token we're selling
      const outputMint = WSOL_MINT; // We want SOL back
      const amount = Math.floor(position.amount * Math.pow(10, 6)); // Convert to token units (assume 6 decimals)
      const slippageBps = 1500; // 15% slippage for selling
      
      addTradeLog('sell', `Getting sell quote for ${position.symbol}...`, position.mint);
      
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
        addTradeLog('error', `No sell quote available for ${position.symbol}`, position.mint);
        return res.json({ success: false, message: `No sell quote available for ${position.symbol}` });
      }

      // Get swap transaction
      const swapResponse = await axios.post('https://quote-api.jup.ag/v6/swap', {
        quoteResponse: quoteResponse.data,
        userPublicKey: wallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 100000
      }, {
        timeout: 10000
      });

      if (!swapResponse.data?.swapTransaction) {
        addTradeLog('error', `Failed to get sell transaction for ${position.symbol}`, position.mint);
        return res.json({ success: false, message: `Failed to get sell transaction for ${position.symbol}` });
      }

      // Execute the sell transaction
      const swapTransactionBuf = Buffer.from(swapResponse.data.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      transaction.sign([wallet]);

      const signature = await connection.sendTransaction(transaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3
      });

      addTradeLog('sell', `📡 REAL SELL transaction sent! Signature: ${signature}`, position.mint, signature);

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        addTradeLog('error', `Sell transaction failed: ${confirmation.value.err}`, position.mint, signature);
        return res.json({ success: false, message: `Sell transaction failed` });
      }

      addTradeLog('sell', `✅ REAL SELL SUCCESSFUL! Sold ${position.symbol} for SOL`, position.mint, signature);
      res.json({ success: true, message: `Real sell order for ${position.symbol} executed successfully!` });
      
    } catch (error) {
      addTradeLog('error', `Real sell execution failed: ${error}`, position.mint);
      res.json({ success: false, message: `Real sell execution failed: ${error}` });
    }
  } catch (error) {
    console.error('Manual sell failed:', error);
    addTradeLog('error', `Manual sell failed: ${error}`);
    res.status(500).json({ success: false, message: 'Manual sell order failed' });
  }
});

app.post('/api/toggle-auto-trading', async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
    
    if (enabled) {
      addTradeLog('info', '🤖 AUTO TRADING mode ENABLED - Executing trade...');
      
      // Execute simple auto trade
      const success = await executeSimpleBuy();
      
      if (success) {
        addTradeLog('info', '✅ AUTO TRADING executed successfully');
        res.json({ success: true, message: 'Auto trading executed successfully' });
      } else {
        addTradeLog('error', 'AUTO TRADING failed to execute');
        res.json({ success: false, message: 'Auto trading failed to execute' });
      }
      
    } else {
      addTradeLog('info', '⏸️ AUTO TRADING mode DISABLED');
      res.json({ success: true, message: 'Auto trading disabled' });
    }
    
  } catch (error) {
    console.error('Toggle auto trading failed:', error);
    addTradeLog('error', `Toggle auto trading failed: ${error}`);
    res.status(500).json({ success: false, message: 'Failed to toggle auto trading' });
  }
});

// Function to add trade log (can be called from bot logic)
export function addTradeLog(type: 'buy' | 'sell' | 'info' | 'error', message: string, mint?: string, signature?: string) {
  const log: TradeLog = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    type,
    message,
    mint,
    signature,
    url: signature ? `https://solscan.io/tx/${signature}` : undefined
  };
  
  broadcastTradeLog(log);
}

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
server.listen(PORT, () => {
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