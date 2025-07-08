# 🚀 QuantBot v3.0 - Complete Startup Guide

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Starting the System](#starting-the-system)
6. [Verification](#verification)
7. [Troubleshooting](#troubleshooting)
8. [Advanced Configuration](#advanced-configuration)

---

## 📋 Prerequisites

### System Requirements
- **Node.js**: Version 18.0.0 or higher
- **Python**: Version 3.8 or higher
- **npm**: Version 8.0.0 or higher
- **Operating System**: macOS, Linux, or Windows 10+
- **RAM**: Minimum 4GB (8GB recommended)
- **Storage**: 10GB free space
- **Internet**: Stable broadband connection

### Required Accounts & API Keys
1. **Solana RPC Provider** (Choose one):
   - [Helius](https://helius.dev/) - Recommended for production
   - [QuickNode](https://www.quicknode.com/chains/sol)
   - [Alchemy](https://www.alchemy.com/solana)
   - [GenesysGo](https://genesysgo.com/)

2. **AI Services** (Optional but recommended):
   - [Azure OpenAI](https://azure.microsoft.com/en-us/products/ai-services/openai-service)
   - [OpenAI API](https://platform.openai.com/api-keys)

3. **Social Media APIs** (Optional):
   - [Twitter/X Developer Account](https://developer.twitter.com/en/portal/dashboard)

### Software Dependencies
```bash
# Check Node.js version
node --version  # Should be 18.0.0+

# Check Python version
python3 --version  # Should be 3.8+

# Check npm version
npm --version  # Should be 8.0.0+
```

---

## 🌐 Environment Setup

### 1. Install Node.js
If Node.js is not installed or version is outdated:

**macOS (using Homebrew):**
```bash
brew install node
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Windows:**
Download from [nodejs.org](https://nodejs.org/en/download/)

### 2. Install Python Dependencies
```bash
# Install Python package manager
sudo apt-get install python3-pip  # Linux
brew install python3  # macOS

# Install required Python packages
pip3 install asyncio aiohttp requests python-dotenv tweepy openai
```

### 3. Install Git (if not already installed)
```bash
# Linux
sudo apt-get install git

# macOS
brew install git

# Windows
# Download from git-scm.com
```

---

## 📦 Installation

### 1. Clone the Repository
```bash
# Navigate to your projects directory
cd ~/projects  # or your preferred directory

# Clone the repository
git clone https://github.com/your-username/quantbot-v3.git
cd quantbot-v3
```

### 2. Install All Dependencies
```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install --legacy-peer-deps
cd ..
```

### 3. Verify Installation
```bash
# Check if all node_modules directories exist
ls backend/node_modules
ls frontend/node_modules

# Check if TypeScript compiles (in backend directory)
cd backend
npx tsc --noEmit
cd ..
```

---

## ⚙️ Configuration

### 1. Create Environment File
```bash
# Create .env file in the root directory
cp .env.example .env
```

### 2. Configure Environment Variables
Edit the `.env` file with your settings:

```bash
# ===== SOLANA CONFIGURATION =====
# Your Solana wallet private key (base58 encoded)
PRIVATE_KEY=your_wallet_private_key_here

# Primary RPC endpoint - Use Helius for best performance
RPC_ENDPOINT=https://mainnet.helius-rpc.com/?api-key=your_helius_api_key

# Backup RPC endpoints (optional but recommended)
RPC_ENDPOINT_BACKUP=https://api.mainnet-beta.solana.com
RPC_ENDPOINT_BACKUP_2=https://solana-mainnet.g.alchemy.com/v2/your_alchemy_key

# Commitment level for transactions
COMMITMENT_LEVEL=confirmed

# ===== TRADING CONFIGURATION =====
# Maximum SOL amount to trade per position
MAX_TRADE_AMOUNT=0.1

# Take profit percentage (e.g., 0.2 = 20%)
TAKE_PROFIT_PERCENTAGE=0.2

# Stop loss percentage (e.g., 0.1 = 10%)
STOP_LOSS_PERCENTAGE=0.1

# Slippage tolerance (e.g., 0.05 = 5%)
SLIPPAGE_TOLERANCE=0.05

# ===== AI CONFIGURATION =====
# Azure OpenAI configuration
AZURE_OPENAI_API_KEY=your_azure_openai_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment-name

# Alternative OpenAI configuration
OPENAI_API_KEY=your_openai_api_key

# ===== SOCIAL MEDIA CONFIGURATION =====
# Twitter/X API keys
TWITTER_BEARER_TOKEN=your_twitter_bearer_token
TWITTER_API_KEY=your_twitter_api_key
TWITTER_API_SECRET=your_twitter_api_secret
TWITTER_ACCESS_TOKEN=your_twitter_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_twitter_access_token_secret

# ===== RISK MANAGEMENT =====
# Maximum portfolio exposure (e.g., 0.8 = 80%)
MAX_PORTFOLIO_EXPOSURE=0.8

# Maximum position size percentage
MAX_POSITION_SIZE_PERCENTAGE=0.1

# Minimum liquidity threshold (USD)
MIN_LIQUIDITY_THRESHOLD=50000

# ===== DEBUGGING =====
# Enable debug mode (true/false)
DEBUG_MODE=false

# Log level (error, warn, info, debug)
LOG_LEVEL=info
```

### 3. Wallet Setup
If you don't have a Solana wallet private key:

```bash
# Generate a new wallet using Solana CLI
solana-keygen new --outfile ~/solana-wallet.json

# Get the private key in base58 format
solana-keygen pubkey ~/solana-wallet.json  # This shows public key
# For private key, use a base58 encoder tool or:
node -e "console.log(require('bs58').encode(require('fs').readFileSync('~/solana-wallet.json')))"
```

**⚠️ Security Warning**: Never share your private key or commit it to version control!

---

## 🚀 Starting the System

### Method 1: Using Python Scripts (Recommended)
The easiest way to start the system:

```bash
# Terminal 1: Start Backend
python3 start-backend.py

# Terminal 2: Start Frontend
python3 start-frontend.py
```

### Method 2: Manual Start
If you prefer manual control:

```bash
# Terminal 1: Start Backend
cd backend
npm run dev

# Terminal 2: Start Frontend
cd frontend
npm run dev
```

### Method 3: Using npm Scripts
```bash
# Start both frontend and backend simultaneously
npm run dev

# Or start individually
npm run backend:dev
npm run frontend:dev
```

### Expected Output

**Backend Terminal:**
```
🔧 BACKEND SERVER
========================================
🚀 Starting Quant Bot Backend...
🔗 Will run on: http://localhost:8000
========================================
📦 Installing backend dependencies...
✅ Dependencies installed
🔧 Starting backend server...
💼 Portfolio Service initialized for wallet: 12345678...
🔍 MEME SCANNER Service initialized
🐋 Whale Tracker Service initialized
📡 Signal Feed Service initialized
🔗 Using RPC: https://mainnet.helius-rpc.com/?api-key=...
🎯 Commitment Level: confirmed
✅ Backend server running on port 8000
```

**Frontend Terminal:**
```
🎨 FRONTEND SERVER
========================================
🚀 Starting Quant Bot Frontend...
🌐 Will run on: http://localhost:3000
========================================
📦 Installing frontend dependencies...
✅ Dependencies installed
🎨 Starting frontend server...
   ▲ Next.js 15.2.4
   - Local:        http://localhost:3000
   - Network:      http://192.168.1.100:3000
🌐 Opening browser...
```

---

## ✅ Verification

### 1. Check System Status
1. **Backend Health**: Visit `http://localhost:8000/api/network-stats`
2. **Frontend**: Visit `http://localhost:3000`
3. **WebSocket**: Check browser console for WebSocket connection

### 2. Verify Dashboard Components
The dashboard should display:
- ✅ **Header**: Bot controls and system status
- ✅ **Stats Bar**: Network statistics and metrics
- ✅ **Portfolio Status**: Your wallet balance and positions
- ✅ **Active Positions**: Current token holdings
- ✅ **Meme Scanner**: New token detection
- ✅ **Signal Feed**: Trading signals and alerts
- ✅ **Whale Activity**: Large transaction monitoring
- ✅ **Market Analysis**: Price and volume data
- ✅ **Risk Management**: Portfolio risk metrics

### 3. Test Bot Functionality
1. **Start Bot**: Click "START BOT" button in dashboard
2. **Monitor Logs**: Check real-time logs in the Signal Feed
3. **Verify Trading**: Watch for new token detections and trades

### 4. Expected Log Messages
```
🤖 Trading bot initialized and ready
🔍 Scanning for trading opportunities...
📊 Market condition: NEUTRAL with volatility index 42/100
🌐 Jupiter API connected successfully - Fetching liquidity data
💹 SOL price: $158.24 (24h: +3.8%) - Market cap: $68.5B
```

---

## 🔧 Troubleshooting

### Common Issues and Solutions

#### 1. Backend Won't Start
**Error**: `Cannot find module` or `Module not found`
```bash
# Solution: Reinstall dependencies
cd backend
rm -rf node_modules package-lock.json
npm install
```

#### 2. Frontend Won't Start
**Error**: Peer dependency conflicts
```bash
# Solution: Use legacy peer deps
cd frontend
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

#### 3. WebSocket Connection Failed
**Error**: WebSocket connection refused
```bash
# Check if backend is running
curl http://localhost:8000/api/status

# Check firewall settings
sudo ufw allow 8000  # Linux
sudo ufw allow 3000  # Linux
```

#### 4. RPC Connection Issues
**Error**: `Failed to connect to RPC endpoint`
```bash
# Test RPC endpoint
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' \
  https://your-rpc-endpoint

# Try alternative RPC
# Update RPC_ENDPOINT in .env file
```

#### 5. Database Issues
**Error**: `Database connection failed`
```bash
# Reset database
cd backend
rm -f portfolio.db
npm run dev  # This will recreate the database
```

#### 6. Permission Errors
**Error**: `EACCES` or permission denied
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

#### 7. Port Already in Use
**Error**: `Port 3000/8000 is already in use`
```bash
# Find and kill process using port
sudo lsof -i :3000  # Find process ID
sudo kill -9 <PID>  # Kill process

# Or change port in .env
PORT=3001  # For frontend
BACKEND_PORT=8001  # For backend
```

### Debug Mode
Enable debug mode for detailed logging:
```bash
# In .env file
DEBUG_MODE=true
LOG_LEVEL=debug
```

### Performance Issues
If the system is slow:
1. **Check Memory Usage**: `htop` or `top` command
2. **Optimize RPC Calls**: Use paid RPC providers
3. **Reduce Polling Frequency**: Adjust cache durations
4. **Close Unused Services**: Disable unnecessary scanners

---

## 🔧 Advanced Configuration

### Multi-RPC Setup
Configure multiple RPC endpoints for redundancy:
```env
RPC_ENDPOINT=https://mainnet.helius-rpc.com/?api-key=key1
RPC_ENDPOINT_BACKUP=https://solana-mainnet.g.alchemy.com/v2/key2
RPC_ENDPOINT_BACKUP_2=https://api.mainnet-beta.solana.com
```

### Trading Strategy Customization
```env
# Conservative Strategy
MAX_TRADE_AMOUNT=0.05
TAKE_PROFIT_PERCENTAGE=0.15
STOP_LOSS_PERCENTAGE=0.08

# Aggressive Strategy
MAX_TRADE_AMOUNT=0.2
TAKE_PROFIT_PERCENTAGE=0.3
STOP_LOSS_PERCENTAGE=0.12
```

### Performance Optimization
```env
# Cache durations (milliseconds)
CACHE_DURATION=120000  # 2 minutes
PRICE_CACHE_DURATION=300000  # 5 minutes
BALANCE_CACHE_DURATION=60000  # 1 minute

# Rate limiting
MAX_REQUESTS_PER_MINUTE=100
CONCURRENT_REQUESTS=5
```

---

## 📞 Support

### Getting Help
1. **Check Logs**: Always check both backend and frontend logs
2. **Review Configuration**: Ensure all environment variables are set
3. **Test Components**: Use API endpoints to test individual components
4. **Documentation**: Refer to the comprehensive README.md

### Useful Commands
```bash
# Check system status
curl http://localhost:8000/api/network-stats

# Check bot status
curl http://localhost:8000/api/status

# Check WebSocket health
curl http://localhost:8000/api/websocket-health

# Test RPC connection
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' \
  $RPC_ENDPOINT
```

---

## 🎯 Next Steps

After successful startup:
1. **Monitor Initial Performance**: Watch the bot for 30 minutes
2. **Adjust Risk Parameters**: Modify based on your risk tolerance
3. **Enable Social Sentiment**: Configure Twitter API for better signals
4. **Optimize Strategy**: Fine-tune based on market conditions
5. **Set Up Monitoring**: Configure alerts for important events

---

*🚀 You're now ready to use QuantBot v3.0! Happy trading!*

---

**⚠️ Disclaimer**: This software is for educational purposes only. Trading cryptocurrencies involves significant risk of loss. Only trade with funds you can afford to lose.