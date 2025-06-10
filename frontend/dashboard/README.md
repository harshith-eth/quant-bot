# Real-time Trading Dashboard

This dashboard provides a comprehensive real-time monitoring and trading interface for the Quantum Degen Trading AI Swarm. It features WebSocket integration for real-time data updates, manual trading controls, performance metrics visualization, and an intuitive user interface for full production-grade trading operations.

## Features

### Real-time Data Updates
- WebSocket integration for instant data streaming
- Heartbeat monitoring to maintain connection reliability
- Automatic reconnection with exponential backoff
- Channel-based subscription system for targeted data updates

### Performance Monitoring
- Real-time P&L charting with multiple timeframes
- Portfolio status visualization
- Active position tracking
- Trade history with win/loss metrics

### Trading Controls
- Manual order execution interface
- Emergency stop functionality
- Position management (close, update stop loss/take profit)
- Real-time trade status updates
- Wallet configuration and balance monitoring
- Auto-trading mode toggle

### Alert System
- Visual notifications for important events
- Severity-based alert styling
- Auto-dismissing notifications with configurable timeouts

## Directory Structure

```
frontend/dashboard/
├── index.html              # Main dashboard HTML
├── styles.css              # Global styles
├── dashboard.js            # WebSocket controller and core functionality
├── script.js               # UI initialization and event handlers
├── chart-component.js      # Chart visualization library
├── test-websocket.js       # WebSocket testing utilities
├── websocket-test.html     # WebSocket test interface
├── card-trading-controls.html # Manual trading interface component
├── card-*.html             # Individual dashboard components
│   ├── card-active-positions.html
│   ├── card-ai-analysis.html
│   ├── card-market-analysis.html
│   ├── card-meme-scanner.html
│   ├── card-performance-metrics.html
│   ├── card-portfolio-status.html
│   ├── card-risk-management.html
│   ├── card-signal-feed.html
│   ├── card-trading-controls.html
│   └── card-whale-activity.html
└── README.md               # Documentation
```

## Usage

### Running the Dashboard
1. Start the backend server: `cd backend && python main.py`
2. Open the dashboard in a browser: `http://localhost:8000/static/dashboard/index.html`

### Testing WebSocket Integration
1. Start the backend server
2. Open the WebSocket test page: `http://localhost:8000/static/dashboard/websocket-test.html`
3. Use the test interface to verify WebSocket connectivity and functionality
4. Monitor WebSocket metrics like latency, message rate, and reconnection capabilities

## WebSocket Protocol

### Connection
The dashboard connects to the WebSocket server at `ws://<hostname>:8000/ws`.

### Subscription
After connecting, the dashboard subscribes to the following data channels:
- `portfolio_status`: Portfolio balance and performance metrics
- `active_positions`: Current trading positions
- `market_analysis`: Market data and technical analysis
- `meme_scanner`: New token opportunities
- `signal_feed`: Trading signals from AI agents
- `whale_activity`: Large transaction monitoring
- `risk_management`: Risk metrics and warnings
- `ai_analysis`: AI insights and predictions

### Message Types
The dashboard handles these WebSocket message types:
- `connection_established`: Initial connection success
- `subscription_confirmed`: Channel subscription confirmation
- `data_update`: New data for a subscribed channel
- `broadcast`: System-wide messages
- `alert`: Notifications requiring user attention
- `trade_execution`: Trade execution status updates
- `pong`: Heartbeat response

## Dashboard Components

### WebSocket Controller (dashboard.js)
Manages real-time data streaming, connection reliability, and data distribution.

### Chart Component (chart-component.js)
Provides line and candlestick chart visualization for price and P&L data.

### Trading Controls
Enables manual trading with order execution, risk management, and emergency controls.

### Performance Metrics
Displays P&L trends, trade history, and portfolio performance metrics.

### Alert System
Shows context-aware notifications for important system events and trade statuses.

## Future Enhancements

- Position size calculator with risk analysis
- Dark/light theme toggle
- Mobile-responsive design
- Advanced charting with technical indicators
- Multi-account support
- Customizable dashboard layouts
- Notification preferences
- Performance analytics export
