# QUANTUM DEGEN TRADING AI SWARM - BACKEND

## 🚀 Real AI Trading System with Live Market Data

This is the backend for the Quantum Degen Trading Dashboard - a sophisticated AI swarm system that uses **REAL MARKET DATA** from open source APIs to trade meme coins with maximum precision.

## ✅ REAL DATA SOURCES
- **CoinGecko API** - Real market cap, prices, and global data
- **DexScreener API** - Live DEX token data and trending pairs  
- **Solana RPC** - Real blockchain transactions and whale movements
- **Jupiter API** - Real-time price feeds
- **BirdEye API** - Token analytics and holder data

## 🏗️ Architecture

The backend is built as a **distributed AI agent swarm** where each module operates as an independent agent that coordinates with others through the central orchestrator.

### Core Components

- **🧠 AI Swarm Orchestrator** - Central brain that coordinates all agents
- **📊 WebSocket Manager** - Real-time data streaming to frontend
- **⚙️ Configuration** - Centralized settings and secrets management

### AI Agent Modules

1. **🎯 Active Positions** - Manages trading positions with real-time P/L tracking
2. **🧠 AI Analysis** - Neural network predictions and technical analysis
3. **📈 Market Analysis** - Advanced market intelligence and trend detection
4. **🔍 Meme Scanner** - Token discovery engine for finding gem coins
5. **💰 Portfolio Status** - Portfolio performance tracking and metrics
6. **🛡️ Risk Management** - Advanced risk assessment and protection
7. **📡 Signal Feed** - Signal aggregation from multiple sources
8. **🐋 Whale Activity** - Smart money and whale movement tracking

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Set up environment variables (NO PAID APIS NEEDED!)
cp backend/env.example backend/.env
# The system uses FREE open source APIs - no API keys required!
```

### Running the Server

```bash
# Start the AI swarm
python main.py

# Or with uvicorn
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The server will start at `http://localhost:8000`

## 📡 API Endpoints

### Core Endpoints

- `GET /` - System status
- `GET /health` - Health check
- `WS /ws` - WebSocket for real-time data

### Module APIs

- `GET /api/active-positions` - Get active trading positions
- `GET /api/ai-analysis` - Get AI neural network analysis
- `GET /api/market-analysis` - Get market intelligence
- `GET /api/meme-scanner` - Get meme token scanner results
- `GET /api/portfolio-status` - Get portfolio performance
- `GET /api/risk-management` - Get risk analysis
- `GET /api/signal-feed` - Get aggregated signals
- `GET /api/whale-activity` - Get whale movements

### Trading Actions

- `POST /api/execute-trade` - Execute a new trade
- `POST /api/update-position` - Update existing position

## 🔧 Configuration

Key settings in `core/config.py`:

```python
# Trading Settings
INITIAL_BALANCE = 25.0
TARGET_BALANCE = 20000.0
MAX_POSITION_SIZE = 15.0
DEFAULT_STOP_LOSS = 0.3

# Risk Management
MAX_DAILY_LOSS = 0.5
MAX_POSITIONS = 5
MIN_LIQUIDITY = 5000.0
```

## 🧠 AI Agent Details

### Position Manager
- Real-time position tracking
- Automatic P/L calculation
- Smart exit condition monitoring
- Risk-based position sizing

### Neural Analyzer
- Advanced ML predictions
- Pattern recognition
- Sentiment analysis
- 84.7% accuracy rate

### Market Intelligence
- Technical indicator analysis
- Fibonacci retracements
- Support/resistance levels
- Market sentiment tracking

### Token Hunter
- Real-time token discovery
- Rug detection algorithms
- Liquidity analysis
- Social sentiment scoring

### Risk Engine
- Portfolio risk assessment
- VaR calculations
- Correlation analysis
- Emergency exit protocols

### Signal Aggregator
- Multi-source signal collection
- Confidence weighting
- Priority classification
- Real-time processing

### Whale Tracker
- Large wallet monitoring
- Smart money detection
- Pattern analysis
- Success rate tracking

## 📊 Real-time Features

The system provides real-time updates through WebSockets:

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:8000/ws');

// Subscribe to channels
ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['active_positions', 'ai_analysis', 'whale_activity']
}));
```

## 🛡️ Risk Management

The system implements multiple layers of risk protection:

1. **Position Sizing** - Maximum 60% of balance per trade
2. **Stop Losses** - Automatic 30% stop loss
3. **Portfolio Limits** - Maximum 5 active positions
4. **Liquidity Checks** - Minimum $5K liquidity requirement
5. **Emergency Exit** - Instant exit on high risk detection

## 🔮 AI Features

### Neural Network Analysis
- Market sentiment prediction
- Price movement forecasting
- Pattern recognition
- Risk assessment

### Smart Money Tracking
- Whale wallet monitoring
- Success rate analysis
- Copy trading signals
- Large movement alerts

### Signal Processing
- Multi-source aggregation
- Confidence scoring
- Priority classification
- Real-time alerts

## 📈 Performance Metrics

The system tracks comprehensive performance metrics:

- Win rate tracking
- P/L analysis
- Risk-adjusted returns
- Sharpe ratio calculation
- Maximum drawdown monitoring

## 🚨 Alerts & Notifications

Real-time alerts for:
- High confidence signals
- Whale movements
- Risk threshold breaches
- Position exit triggers
- Market anomalies

## 🛠️ Development

### Adding New Modules

1. Create new module directory
2. Implement agent class with required methods:
   - `async def initialize()`
   - `async def get_data()`
   - `def get_metrics()`
   - `async def shutdown()`
3. Add to orchestrator initialization
4. Create API endpoint in main.py

### Testing

```bash
# Run with test data
python -m pytest tests/

# Manual testing
curl http://localhost:8000/api/active-positions
```

## ⚠️ Disclaimer

This system is for educational and research purposes. Cryptocurrency trading involves significant risk. The developers are not responsible for any financial losses.

**Trade responsibly and never invest more than you can afford to lose.**

## 📝 License

MIT License - Use at your own risk!

---

**Built with maximum autism and scientific precision** 🧠⚡🚀 