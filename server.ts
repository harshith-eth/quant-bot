import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { exec } from 'child_process';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// State to track bot status
let botRunning = false;
let botProcess: Promise<void> | null = null;

// Routes
// Serve the main dashboard
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
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
    botProcess = runListener();
    
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
      message: 'Failed to start bot' 
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

// Function to open browser
function openBrowser(url: string) {
  const platform = process.platform;
  let command: string;

  switch (platform) {
    case 'darwin': // macOS
      command = `open ${url}`;
      break;
    case 'win32': // Windows
      command = `start ${url}`;
      break;
    default: // Linux and others
      command = `xdg-open ${url}`;
      break;
  }

  exec(command, (error) => {
    if (error) {
      console.warn('Could not automatically open browser:', error.message);
    }
  });
}

// Start the server
app.listen(PORT, () => {
  const dashboardUrl = `http://localhost:${PORT}`;
  
  console.log('\n🚀 SOLANA TRADING BOT DASHBOARD');
  console.log('================================');
  console.log(`📊 Dashboard: ${dashboardUrl}`);
  console.log('💡 The bot will NOT start automatically.');
  console.log('🎯 Open the dashboard to control the bot.');
  console.log('🌐 Opening browser automatically...');
  console.log('================================\n');
  
  console.log(`Server started on ${dashboardUrl}`);
  console.log('Bot dashboard is ready. Visit the URL above to control the bot.');
  
  // Automatically open the browser
  setTimeout(() => {
    openBrowser(dashboardUrl);
  }, 1000); // Small delay to ensure server is fully ready
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