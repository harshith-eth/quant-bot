# Portfolio Agent: Position Management and Performance Tracking

## Introduction

The Portfolio Agent is a critical component of the QuantBot AI Swarm responsible for managing active positions, tracking performance metrics, and providing a comprehensive view of trading activities. It functions as the system's financial record-keeper, ensuring accurate position tracking, profit/loss calculations, and portfolio optimization.

## Core Functionality

The Portfolio Agent handles several essential functions:

1. **Position Tracking**: Monitoring all active token positions and their performance
2. **Performance Analytics**: Calculating key metrics like ROI, profit/loss, and drawdowns
3. **Trade History**: Maintaining a comprehensive record of all executed trades
4. **Risk Exposure**: Tracking overall portfolio risk and exposure levels
5. **Rebalancing Recommendations**: Suggesting portfolio adjustments based on position sizing rules

## Technical Architecture

The Portfolio Agent is implemented through a modular architecture:

```
┌──────────────────────────────────────────────────────┐
│                  Portfolio Agent                     │
├──────────────────────────────────────────────────────┤
│ ┌────────────────┐ ┌────────────────┐ ┌────────────┐ │
│ │ Position       │ │ Trade History  │ │ Portfolio  │ │
│ │ Tracker        │ │ Manager        │ │ Database   │ │
│ └────────────────┘ └────────────────┘ └────────────┘ │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────┐ │
│ │ Performance    │ │ Risk           │ │ Reporting  │ │
│ │ Calculator     │ │ Monitor        │ │ Engine     │ │
│ └────────────────┘ └────────────────┘ └────────────┘ │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────┐ │
│ │ Notification   │ │ Portfolio      │ │ API        │ │
│ │ Manager        │ │ Optimizer      │ │ Interface  │ │
│ └────────────────┘ └────────────────┘ └────────────┘ │
└──────────────────────────────────────────────────────┘
```

## Core Data Structures

### Position Tracking

The Portfolio Agent maintains detailed information about each position:

```typescript
// portfolio-service.ts
interface Position {
  id: string;
  tokenMint: string;
  tokenName: string;
  tokenSymbol: string;
  entryPrice: number;
  currentPrice: number;
  amount: number;
  value: number;
  costBasis: number;
  profitLoss: number;
  profitLossPercentage: number;
  entryTimestamp: number;
  durationHeld: number;
  stopLoss?: number;
  takeProfit?: number;
  tags: string[];
  status: 'active' | 'closed';
}
```

### Trade History

Each trade is recorded with comprehensive metadata:

```typescript
interface Trade {
  id: string;
  type: 'buy' | 'sell';
  positionId: string;
  tokenMint: string;
  tokenSymbol: string;
  amount: number;
  price: number;
  value: number;
  fee: number;
  timestamp: number;
  signature: string;
  executedBy: string;
  initiatedBy: 'manual' | 'whale-signal' | 'meme-scanner' | 'auto';
  profitLoss?: number;
  profitLossPercentage?: number;
  holdTime?: number;
}
```

### Portfolio Summary

The overall portfolio status is tracked:

```typescript
interface PortfolioSummary {
  totalValue: number;
  quoteCurrencyBalance: number;
  activePositionsValue: number;
  totalPositions: number;
  totalTrades: number;
  dailyProfitLoss: number;
  dailyProfitLossPercentage: number;
  weeklyProfitLoss: number;
  weeklyProfitLossPercentage: number;
  allTimeProfitLoss: number;
  allTimeProfitLossPercentage: number;
  maxDrawdown: number;
  mostProfitableToken: {
    tokenMint: string;
    tokenSymbol: string;
    profitLoss: number;
    profitLossPercentage: number;
  };
  riskExposure: number; // 0-100
}
```

## Core Operations

### Position Management

The Portfolio Agent handles the full lifecycle of trading positions:

```typescript
// Creating a new position
async createPosition(trade: Trade): Promise<Position> {
  // Calculate initial position metrics
  const position: Position = {
    id: generateUniqueId(),
    tokenMint: trade.tokenMint,
    tokenName: await this.getTokenName(trade.tokenMint),
    tokenSymbol: trade.tokenSymbol,
    entryPrice: trade.price,
    currentPrice: trade.price,
    amount: trade.amount,
    value: trade.value,
    costBasis: trade.value + trade.fee,
    profitLoss: 0,
    profitLossPercentage: 0,
    entryTimestamp: trade.timestamp,
    durationHeld: 0,
    tags: [],
    status: 'active'
  };
  
  // Store in database
  await this.db.positions.insert(position);
  
  // Update portfolio summary
  await this.updatePortfolioSummary();
  
  // Notify other agents
  this.emitPositionUpdate(position);
  
  return position;
}

// Updating an existing position
async updatePosition(id: string, updates: Partial<Position>): Promise<Position> {
  const position = await this.db.positions.findOne({ id });
  const updatedPosition = { ...position, ...updates };
  
  // Recalculate metrics if price changed
  if (updates.currentPrice !== undefined && updates.currentPrice !== position.currentPrice) {
    updatedPosition.value = updatedPosition.amount * updatedPosition.currentPrice;
    updatedPosition.profitLoss = updatedPosition.value - updatedPosition.costBasis;
    updatedPosition.profitLossPercentage = (updatedPosition.profitLoss / updatedPosition.costBasis) * 100;
    updatedPosition.durationHeld = Date.now() - updatedPosition.entryTimestamp;
  }
  
  // Update in database
  await this.db.positions.update({ id }, updatedPosition);
  
  // Update portfolio summary
  await this.updatePortfolioSummary();
  
  // Notify other agents
  this.emitPositionUpdate(updatedPosition);
  
  return updatedPosition;
}

// Closing a position
async closePosition(id: string, trade: Trade): Promise<Position> {
  const position = await this.db.positions.findOne({ id });
  
  // Calculate final metrics
  position.status = 'closed';
  position.currentPrice = trade.price;
  position.value = trade.value;
  position.profitLoss = trade.value - position.costBasis;
  position.profitLossPercentage = (position.profitLoss / position.costBasis) * 100;
  position.durationHeld = trade.timestamp - position.entryTimestamp;
  
  // Update in database
  await this.db.positions.update({ id }, position);
  
  // Record trade with P&L information
  trade.profitLoss = position.profitLoss;
  trade.profitLossPercentage = position.profitLossPercentage;
  trade.holdTime = position.durationHeld;
  await this.recordTrade(trade);
  
  // Update portfolio summary
  await this.updatePortfolioSummary();
  
  // Notify other agents
  this.emitPositionClosed(position);
  
  return position;
}
```

### Performance Analytics

The Portfolio Agent calculates key performance indicators:

```typescript
async calculatePerformanceMetrics(): Promise<PerformanceMetrics> {
  const trades = await this.db.trades.find({});
  const positions = await this.db.positions.find({});
  
  // Calculate win/loss ratio
  const winningTrades = trades.filter(t => t.type === 'sell' && t.profitLossPercentage > 0);
  const losingTrades = trades.filter(t => t.type === 'sell' && t.profitLossPercentage <= 0);
  const winLossRatio = winningTrades.length / (losingTrades.length || 1);
  
  // Calculate average metrics
  const avgWinPercentage = calculateAverage(winningTrades.map(t => t.profitLossPercentage));
  const avgLossPercentage = calculateAverage(losingTrades.map(t => t.profitLossPercentage));
  const avgHoldTimeWinning = calculateAverage(winningTrades.map(t => t.holdTime));
  const avgHoldTimeLosing = calculateAverage(losingTrades.map(t => t.holdTime));
  
  // Calculate drawdown
  const maxDrawdown = this.calculateMaxDrawdown(trades);
  
  // Calculate Sharpe ratio
  const sharpeRatio = this.calculateSharpeRatio(trades);
  
  return {
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winLossRatio,
    profitFactor: this.calculateProfitFactor(trades),
    avgWinPercentage,
    avgLossPercentage,
    avgHoldTimeWinning,
    avgHoldTimeLosing,
    maxDrawdown,
    sharpeRatio,
    expectedValue: (winLossRatio * avgWinPercentage) - avgLossPercentage,
    // Additional metrics
  };
}
```

### Risk Monitoring

The agent continuously assesses portfolio risk:

```typescript
async calculateRiskExposure(): Promise<RiskMetrics> {
  const positions = await this.db.positions.find({ status: 'active' });
  const portfolioValue = positions.reduce((sum, pos) => sum + pos.value, 0);
  
  // Calculate concentration risk
  const tokenConcentration = {};
  positions.forEach(position => {
    const percentage = (position.value / portfolioValue) * 100;
    tokenConcentration[position.tokenMint] = {
      tokenSymbol: position.tokenSymbol,
      percentage,
      value: position.value
    };
  });
  
  // Find highest concentration
  const highestConcentration = Object.values(tokenConcentration)
    .reduce((max, token: any) => token.percentage > max ? token.percentage : max, 0);
  
  // Calculate volatility exposure
  const volatilityExposure = await this.calculateVolatilityExposure(positions);
  
  // Calculate correlation between positions
  const correlationRisk = await this.calculateCorrelationRisk(positions);
  
  return {
    totalExposure: portfolioValue,
    tokenConcentration,
    highestConcentration,
    volatilityExposure,
    correlationRisk,
    riskScore: this.calculateOverallRiskScore({
      highestConcentration,
      volatilityExposure,
      correlationRisk
    })
  };
}
```

## Integration with the AI Swarm

### Event Publication

The Portfolio Agent publishes events for other agents to consume:

```typescript
// When position metrics change
emitPositionUpdate(position: Position): void {
  eventBus.emit('position-update', {
    id: position.id,
    tokenMint: position.tokenMint,
    tokenSymbol: position.tokenSymbol,
    currentPrice: position.currentPrice,
    profitLossPercentage: position.profitLossPercentage,
    value: position.value
  });
}

// When risk levels change
emitRiskUpdate(riskMetrics: RiskMetrics): void {
  eventBus.emit('risk-update', {
    overallRisk: riskMetrics.riskScore,
    highConcentrationTokens: Object.entries(riskMetrics.tokenConcentration)
      .filter(([, data]: [string, any]) => data.percentage > 20)
      .map(([mint, data]: [string, any]) => ({
        tokenMint: mint,
        tokenSymbol: data.tokenSymbol,
        percentage: data.percentage
      }))
  });
}
```

### Data Consumption

The Portfolio Agent consumes events from other agents:

```typescript
// Listen for new trades from Trading Agent
eventBus.on('trade-executed', async (trade: Trade) => {
  if (trade.type === 'buy') {
    await portfolioAgent.createPosition(trade);
  } else if (trade.type === 'sell') {
    await portfolioAgent.closePosition(trade.positionId, trade);
  }
});

// Listen for price updates from Market Agent
eventBus.on('price-update', async (update: PriceUpdate) => {
  const positions = await portfolioAgent.getPositionsByToken(update.tokenMint);
  for (const position of positions) {
    await portfolioAgent.updatePosition(position.id, {
      currentPrice: update.price
    });
  }
});
```

## Database Integration

The Portfolio Agent uses a persistent database for reliable record-keeping:

```typescript
// portfolio-service.ts
import Database from 'better-sqlite3';

export class PortfolioService {
  private db: Database;
  
  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }
  
  private initializeDatabase() {
    // Create positions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS positions (
        id TEXT PRIMARY KEY,
        tokenMint TEXT NOT NULL,
        tokenName TEXT NOT NULL,
        tokenSymbol TEXT NOT NULL,
        entryPrice REAL NOT NULL,
        currentPrice REAL NOT NULL,
        amount REAL NOT NULL,
        value REAL NOT NULL,
        costBasis REAL NOT NULL,
        profitLoss REAL NOT NULL,
        profitLossPercentage REAL NOT NULL,
        entryTimestamp INTEGER NOT NULL,
        durationHeld INTEGER NOT NULL,
        stopLoss REAL,
        takeProfit REAL,
        tags TEXT,
        status TEXT NOT NULL
      )
    `);
    
    // Create trades table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        positionId TEXT,
        tokenMint TEXT NOT NULL,
        tokenSymbol TEXT NOT NULL,
        amount REAL NOT NULL,
        price REAL NOT NULL,
        value REAL NOT NULL,
        fee REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        signature TEXT NOT NULL,
        executedBy TEXT NOT NULL,
        initiatedBy TEXT NOT NULL,
        profitLoss REAL,
        profitLossPercentage REAL,
        holdTime INTEGER
      )
    `);
    
    // Create portfolio summary table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS portfolio_summary (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        totalValue REAL NOT NULL,
        quoteCurrencyBalance REAL NOT NULL,
        activePositionsValue REAL NOT NULL,
        totalPositions INTEGER NOT NULL,
        totalTrades INTEGER NOT NULL,
        dailyProfitLoss REAL NOT NULL,
        dailyProfitLossPercentage REAL NOT NULL,
        weeklyProfitLoss REAL NOT NULL,
        weeklyProfitLossPercentage REAL NOT NULL,
        allTimeProfitLoss REAL NOT NULL,
        allTimeProfitLossPercentage REAL NOT NULL,
        maxDrawdown REAL NOT NULL,
        riskExposure REAL NOT NULL,
        lastUpdated INTEGER NOT NULL
      )
    `);
  }
  
  // Additional database methods...
}
```

## Frontend Integration

The Portfolio Agent provides data for several frontend components:

```tsx
// PortfolioStatus.tsx component
const PortfolioStatus = () => {
  const [portfolioData, setPortfolioData] = useState<PortfolioSummary | null>(null);
  const [activePositions, setActivePositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryResponse, positionsResponse] = await Promise.all([
          fetch('/api/portfolio/summary'),
          fetch('/api/portfolio/positions?status=active')
        ]);
        
        const summary = await summaryResponse.json();
        const positions = await positionsResponse.json();
        
        setPortfolioData(summary);
        setActivePositions(positions);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to fetch portfolio data', error);
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);
  
  // Component rendering with portfolio data...
};
```

## API Interface

The Portfolio Agent exposes a comprehensive API for external access:

```typescript
// API routes for portfolio data
api.get('/portfolio/summary', async (req, res) => {
  const summary = await portfolioService.getPortfolioSummary();
  res.json(summary);
});

api.get('/portfolio/positions', async (req, res) => {
  const status = req.query.status as string;
  const positions = status 
    ? await portfolioService.getPositionsByStatus(status)
    : await portfolioService.getAllPositions();
  res.json(positions);
});

api.get('/portfolio/trades', async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const trades = await portfolioService.getRecentTrades(limit);
  res.json(trades);
});

api.get('/portfolio/performance', async (req, res) => {
  const period = req.query.period as string || 'all';
  const metrics = await portfolioService.getPerformanceMetrics(period);
  res.json(metrics);
});
```

## Advanced Features

### Portfolio Rebalancing

The Portfolio Agent provides automated rebalancing recommendations:

```typescript
async generateRebalancingPlan(): Promise<RebalancingPlan> {
  const positions = await this.db.positions.find({ status: 'active' });
  const riskMetrics = await this.calculateRiskExposure();
  const portfolioValue = positions.reduce((sum, pos) => sum + pos.value, 0);
  
  const recommendations = [];
  
  // Check concentration risk
  for (const [mint, data] of Object.entries(riskMetrics.tokenConcentration)) {
    const tokenData = data as any;
    if (tokenData.percentage > 25) {
      // Recommend reducing overweight positions
      const targetValue = portfolioValue * 0.2; // 20% target allocation
      const reductionAmount = tokenData.value - targetValue;
      
      recommendations.push({
        tokenMint: mint,
        tokenSymbol: tokenData.tokenSymbol,
        action: 'reduce',
        currentAllocation: tokenData.percentage,
        targetAllocation: 20,
        valueToAdjust: reductionAmount
      });
    }
  }
  
  // Check for underweight positions
  const highPotentialTokens = await this.identifyHighPotentialTokens();
  for (const token of highPotentialTokens) {
    const currentAllocation = (riskMetrics.tokenConcentration[token.mint]?.percentage) || 0;
    if (currentAllocation < 5) {
      // Recommend increasing underweight high-potential positions
      const targetValue = portfolioValue * 0.1; // 10% target allocation
      const increaseAmount = targetValue - (riskMetrics.tokenConcentration[token.mint]?.value || 0);
      
      recommendations.push({
        tokenMint: token.mint,
        tokenSymbol: token.symbol,
        action: 'increase',
        currentAllocation,
        targetAllocation: 10,
        valueToAdjust: increaseAmount
      });
    }
  }
  
  return {
    recommendations,
    currentRisk: riskMetrics.riskScore,
    projectedRisk: this.calculateProjectedRisk(recommendations, riskMetrics),
    timestamp: Date.now()
  };
}
```

### Performance Reporting

The agent generates detailed performance reports:

```typescript
async generatePerformanceReport(period: 'day' | 'week' | 'month' | 'all'): Promise<PerformanceReport> {
  const trades = await this.getTradesForPeriod(period);
  const metrics = await this.calculatePerformanceMetrics(trades);
  
  // Calculate performance by token
  const tokenPerformance = {};
  for (const trade of trades.filter(t => t.type === 'sell')) {
    if (!tokenPerformance[trade.tokenMint]) {
      tokenPerformance[trade.tokenMint] = {
        tokenSymbol: trade.tokenSymbol,
        trades: 0,
        totalProfitLoss: 0,
        averageProfitLossPercentage: 0
      };
    }
    
    const tokenData = tokenPerformance[trade.tokenMint];
    tokenData.trades++;
    tokenData.totalProfitLoss += trade.profitLoss;
  }
  
  // Calculate best and worst performers
  const sortedTokens = Object.entries(tokenPerformance)
    .map(([mint, data]: [string, any]) => ({
      tokenMint: mint,
      tokenSymbol: data.tokenSymbol,
      totalProfitLoss: data.totalProfitLoss,
      trades: data.trades
    }))
    .sort((a, b) => b.totalProfitLoss - a.totalProfitLoss);
  
  // Generate performance charts data
  const dailyPerformance = await this.getDailyPerformanceData(period);
  
  return {
    period,
    overallPerformance: {
      totalProfitLoss: metrics.totalProfitLoss,
      profitLossPercentage: metrics.profitLossPercentage,
      totalTrades: metrics.totalTrades,
      winLossRatio: metrics.winLossRatio
    },
    tokenPerformance: sortedTokens,
    bestPerformer: sortedTokens[0],
    worstPerformer: sortedTokens[sortedTokens.length - 1],
    dailyPerformance,
    metrics
  };
}
```

## Future Enhancements

The Portfolio Agent is designed for continuous evolution:

1. **Machine Learning**: AI models for predicting position performance
2. **Advanced Risk Models**: More sophisticated risk evaluation techniques
3. **Auto-Rebalancing**: Automated portfolio optimization without manual intervention
4. **Scenario Analysis**: What-if modeling for portfolio decisions
5. **Performance Attribution**: Detailed analysis of what factors contributed to returns

## Conclusion

The Portfolio Agent serves as the financial management center of the QuantBot AI Swarm, providing critical position tracking, performance analysis, and risk monitoring. By maintaining accurate records of all trading activities and continuously evaluating portfolio performance, it enables informed decision-making and helps optimize the system's overall trading strategy.

Through its integration with other agents in the swarm, real-time position updates, risk alerts, and performance insights flow throughout the system, ensuring all components have the financial context needed to make optimal decisions. This makes the Portfolio Agent an indispensable component of the QuantBot ecosystem.