# Database Schema

## Overview

The Database Schema for the Quant-Bot platform defines the structure, organization, and relationships of data stored across various storage systems. This document outlines the schema design for relational databases, NoSQL stores, time-series databases, and in-memory caches used throughout the platform.

## Data Storage Architecture

### 1. Storage Types

Different database technologies used for specific purposes:

#### Relational Database

- **PostgreSQL**: Primary structured data storage
- **Purpose**: Consistent, relationship-rich data
- **Key Data**: User accounts, configuration, trading history
- **Characteristics**: ACID compliance, strong relationships, complex queries
- **Usage Pattern**: Read-heavy with periodic writes

#### NoSQL Database

- **MongoDB**: Flexible schema document storage
- **Purpose**: Semi-structured data with varying schemas
- **Key Data**: Token metadata, market profiles, strategy configurations
- **Characteristics**: Schema flexibility, horizontal scaling, document model
- **Usage Pattern**: Mixed read/write with complex documents

#### Time-Series Database

- **InfluxDB**: Optimized time-sequential data storage
- **Purpose**: High-volume temporal metrics and market data
- **Key Data**: Price history, performance metrics, trading signals
- **Characteristics**: Time-indexed, high write throughput, efficient queries
- **Usage Pattern**: High-volume writes, time-range queries

#### In-Memory Cache

- **Redis**: High-speed data caching
- **Purpose**: Rapid access to frequently used data
- **Key Data**: Recent prices, active signals, session data
- **Characteristics**: Sub-millisecond access, data structures, expiration
- **Usage Pattern**: Very high read rate, transient data

### 2. Data Distribution Strategy

How data is allocated across storage systems:

#### Storage Selection Criteria

- **Access Pattern**: Read/write frequency and ratio
- **Query Complexity**: Simple lookups vs. complex joins
- **Consistency Needs**: ACID requirements vs. eventual consistency
- **Volume and Velocity**: Data size and ingestion rate
- **Relationship Density**: Connected data vs. independent records

#### Cross-Database Relationships

- **Foreign Key References**: Cross-database identifier relationships
- **Denormalization Strategy**: Strategic redundancy for performance
- **Consistency Management**: Maintaining referential integrity
- **Synchronization Methods**: Keeping related data current
- **Query Federation**: Cross-database query execution

## Core Relational Schema

### 1. User Data Schema

User account and preference information:

#### Users Table

```sql
CREATE TABLE users (
    user_id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE
);
```

#### UserProfiles Table

```sql
CREATE TABLE user_profiles (
    profile_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id),
    display_name VARCHAR(100),
    risk_tolerance VARCHAR(50) DEFAULT 'moderate',
    default_theme VARCHAR(50) DEFAULT 'light',
    notification_preferences JSONB,
    dashboard_layout JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### UserApiKeys Table

```sql
CREATE TABLE user_api_keys (
    key_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id),
    key_name VARCHAR(100) NOT NULL,
    api_key VARCHAR(100) NOT NULL,
    api_secret VARCHAR(255) NOT NULL,
    permissions VARCHAR(255)[] NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'active'
);
```

### 2. Wallet and Portfolio Schema

Blockchain wallet and holding information:

#### Wallets Table

```sql
CREATE TABLE wallets (
    wallet_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id),
    wallet_address VARCHAR(255) NOT NULL,
    wallet_name VARCHAR(100),
    blockchain VARCHAR(50) NOT NULL DEFAULT 'solana',
    wallet_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_synced_at TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    UNIQUE(user_id, wallet_address)
);
```

#### Portfolios Table

```sql
CREATE TABLE portfolios (
    portfolio_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    risk_limit DECIMAL(15, 6),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'active'
);
```

#### PortfolioPositions Table

```sql
CREATE TABLE portfolio_positions (
    position_id UUID PRIMARY KEY,
    portfolio_id UUID NOT NULL REFERENCES portfolios(portfolio_id),
    token_address VARCHAR(255) NOT NULL,
    token_symbol VARCHAR(50),
    token_name VARCHAR(255),
    quantity DECIMAL(30, 15) NOT NULL,
    average_entry_price DECIMAL(30, 15),
    current_price DECIMAL(30, 15),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_trade_at TIMESTAMP
);
```

### 3. Trading Schema

Trading operations and history:

#### TradingStrategies Table

```sql
CREATE TABLE trading_strategies (
    strategy_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id),
    strategy_name VARCHAR(100) NOT NULL,
    strategy_type VARCHAR(50) NOT NULL,
    description TEXT,
    parameters JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_run_at TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'active'
);
```

#### TradingSignals Table

```sql
CREATE TABLE trading_signals (
    signal_id UUID PRIMARY KEY,
    strategy_id UUID REFERENCES trading_strategies(strategy_id),
    signal_type VARCHAR(50) NOT NULL,
    token_address VARCHAR(255) NOT NULL,
    direction VARCHAR(10) NOT NULL,  -- 'buy' or 'sell'
    confidence DECIMAL(5, 2) NOT NULL,
    price_target DECIMAL(30, 15),
    stop_loss DECIMAL(30, 15),
    take_profit DECIMAL(30, 15),
    expiration_time TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    metadata JSONB
);
```

#### Trades Table

```sql
CREATE TABLE trades (
    trade_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id),
    portfolio_id UUID REFERENCES portfolios(portfolio_id),
    signal_id UUID REFERENCES trading_signals(signal_id),
    strategy_id UUID REFERENCES trading_strategies(strategy_id),
    token_address VARCHAR(255) NOT NULL,
    token_symbol VARCHAR(50),
    direction VARCHAR(10) NOT NULL,  -- 'buy' or 'sell'
    quantity DECIMAL(30, 15) NOT NULL,
    price DECIMAL(30, 15) NOT NULL,
    value_usd DECIMAL(15, 2),
    fee_amount DECIMAL(30, 15),
    transaction_hash VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP,
    status VARCHAR(50) NOT NULL,
    execution_details JSONB
);
```

### 4. Event and Notification Schema

System events and user notifications:

#### SystemEvents Table

```sql
CREATE TABLE system_events (
    event_id UUID PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    source VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'new'
);
```

#### UserNotifications Table

```sql
CREATE TABLE user_notifications (
    notification_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id),
    event_id UUID REFERENCES system_events(event_id),
    notification_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    importance VARCHAR(50) NOT NULL DEFAULT 'normal',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'unread'
);
```

## NoSQL Schema

### 1. Token Metadata Collection

Detailed information about tokens:

```json
{
  "_id": "token_address_string",
  "symbol": "TOKEN",
  "name": "Token Full Name",
  "decimals": 9,
  "totalSupply": "1000000000000000000",
  "mintAuthority": "authority_address_string",
  "freezeAuthority": "freeze_authority_address_string",
  "metadata": {
    "description": "Token description text",
    "image": "image_url_string",
    "externalUrl": "project_url_string"
  },
  "contractAnalysis": {
    "renounced": false,
    "mutable": true,
    "securityScore": 75,
    "riskFactors": ["mutable_supply", "not_renounced"]
  },
  "tokenomics": {
    "initialDistribution": {
      "team": 15,
      "publicSale": 40,
      "liquidity": 35,
      "marketing": 10
    },
    "unlockSchedule": [
      {
        "date": "2023-06-01T00:00:00Z",
        "percentage": 20,
        "category": "team"
      }
    ]
  },
  "exchanges": [
    {
      "name": "raydium",
      "address": "pool_address_string",
      "liquidityUsd": 250000,
      "volume24h": 75000,
      "priceImpact1000usd": 0.25
    }
  ],
  "priceHistory": {
    "hourly": "time_series_collection_reference",
    "daily": "time_series_collection_reference"
  },
  "socialMetrics": {
    "twitter": {
      "handle": "twitter_handle",
      "followers": 5000,
      "engagement": 2.3
    },
    "telegram": {
      "members": 10000,
      "activity": "high"
    }
  },
  "createdAt": "2023-01-15T12:34:56Z",
  "updatedAt": "2023-04-23T09:12:34Z"
}
```

### 2. Market Data Collection

Market conditions and metrics:

```json
{
  "_id": "market_snapshot_id",
  "timestamp": "2023-06-01T12:00:00Z",
  "globalMetrics": {
    "totalMarketCapUsd": 1250000000000,
    "solanaMarketCapUsd": 25000000000,
    "solanaPrice": 145.75,
    "solanaDominance": 2.0,
    "totalVolume24h": 75000000000
  },
  "marketMood": {
    "fearGreedIndex": 65,
    "sentiment": "bullish",
    "volatilityIndex": 0.85
  },
  "topMovers": [
    {
      "tokenAddress": "token_address_string",
      "symbol": "TOKEN",
      "priceChangePercent": 25.5,
      "volume24h": 15000000
    }
  ],
  "sectorPerformance": [
    {
      "sector": "defi",
      "performancePercent": 5.2,
      "marketCapUsd": 48000000000
    }
  ],
  "whaleActivity": {
    "largeTransactionCount": 145,
    "largeTransactionVolumeUsd": 250000000,
    "netFlowUsd": 75000000
  },
  "liquidityMetrics": {
    "totalValueLockedUsd": 18500000000,
    "topDexVolume": {
      "raydium": 450000000,
      "orca": 325000000
    }
  }
}
```

### 3. Whale Activity Collection

Large transaction tracking:

```json
{
  "_id": "transaction_id_string",
  "blockTime": 1654372800,
  "timestamp": "2023-06-01T12:00:00Z",
  "signature": "transaction_signature_string",
  "walletAddress": "wallet_address_string",
  "walletProfile": {
    "type": "institutional",
    "knownEntity": "exchange_name",
    "whaleCategory": "mega",
    "historicalInfluence": 8.5
  },
  "transactionType": "swap",
  "tokens": [
    {
      "address": "token_address_string",
      "symbol": "SOL",
      "direction": "sell",
      "amount": 50000,
      "valueUsd": 7250000
    },
    {
      "address": "token_address_string",
      "symbol": "USDC",
      "direction": "buy",
      "amount": 7245000,
      "valueUsd": 7245000
    }
  ],
  "market": {
    "venue": "jupiter",
    "route": "raydium",
    "priceImpact": 0.75
  },
  "significance": {
    "relativeSize": "very_large",
    "marketImpact": "high",
    "signalStrength": 8.2,
    "priceMoveAfter3h": -2.5
  },
  "relatedTransactions": [
    "related_transaction_signature_1",
    "related_transaction_signature_2"
  ]
}
```

### 4. Strategy Configuration Collection

Trading strategy settings:

```json
{
  "_id": "strategy_id_uuid",
  "userId": "user_id_uuid",
  "name": "Whale Follower Alpha",
  "type": "whale_follower",
  "description": "Follows transactions of known profitable whale wallets",
  "status": "active",
  "parameters": {
    "minTransactionValueUsd": 100000,
    "minWhaleInfluenceScore": 7,
    "followSizePercentage": 5,
    "maxPositionSizeUsd": 10000,
    "allowedTokens": {
      "type": "allowlist",
      "list": ["token_address_1", "token_address_2"]
    },
    "executionDelay": 60,
    "takeProfitPercent": 15,
    "stopLossPercent": 7.5,
    "timeBasedExit": {
      "enabled": true,
      "maxHoldingTimeHours": 48
    }
  },
  "filters": {
    "transactionTypes": ["swap", "liquidity_add"],
    "excludedWallets": ["excluded_address_1", "excluded_address_2"],
    "minimumLiquidityUsd": 500000
  },
  "performance": {
    "allTime": {
      "tradesTotal": 45,
      "winRate": 0.65,
      "profitPercent": 32.5,
      "sharpeRatio": 1.8
    },
    "last30Days": {
      "tradesTotal": 12,
      "winRate": 0.58,
      "profitPercent": 8.5,
      "sharpeRatio": 1.5
    }
  },
  "schedule": {
    "active": true,
    "timeWindows": [
      {
        "days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
        "startTime": "09:00:00",
        "endTime": "20:00:00",
        "timezone": "UTC"
      }
    ]
  },
  "createdAt": "2023-01-15T12:34:56Z",
  "updatedAt": "2023-04-23T09:12:34Z",
  "lastRunAt": "2023-06-01T14:25:11Z"
}
```

## Time-Series Schema

### 1. Price Data

Historical token prices:

```
Measurement: token_prices
Tags:
  - token_address: string
  - symbol: string
  - source: string (e.g., "raydium", "jupiter")

Fields:
  - price: float
  - volume: float
  - market_cap: float
  - liquidity: float
  - price_change_24h: float
  - high_24h: float
  - low_24h: float

Timestamp: UTC timestamp
```

### 2. Trading Metrics

Performance measurements:

```
Measurement: trading_metrics
Tags:
  - strategy_id: uuid_string
  - user_id: uuid_string
  - token_address: string (optional)

Fields:
  - pnl_percent: float
  - pnl_absolute: float
  - win_count: integer
  - loss_count: integer
  - active_positions: integer
  - exposure_usd: float
  - max_drawdown: float
  - sharpe_ratio: float
  - sortino_ratio: float

Timestamp: UTC timestamp
```

### 3. System Performance

Operational metrics:

```
Measurement: system_performance
Tags:
  - service: string
  - instance: string
  - region: string

Fields:
  - cpu_usage_percent: float
  - memory_usage_percent: float
  - request_count: integer
  - error_count: integer
  - response_time_ms: float
  - queue_depth: integer
  - active_connections: integer
  - throughput: float

Timestamp: UTC timestamp
```

### 4. Signal Events

Trading signal occurrences:

```
Measurement: trading_signals
Tags:
  - signal_id: uuid_string
  - strategy_id: uuid_string
  - token_address: string
  - direction: string (buy/sell)

Fields:
  - confidence: float
  - strength: float
  - price: float
  - volume: float
  - predicted_move: float
  - actual_move_1h: float
  - actual_move_24h: float
  - success: boolean

Timestamp: UTC timestamp
```

## Cache Schema

### 1. Recent Price Cache

Current token prices:

```
Key pattern: price:{token_address}
Value type: Hash
Fields:
  - price: string (decimal)
  - updated_at: string (ISO timestamp)
  - source: string
  - change_24h: string (decimal percent)
  - volume_24h: string (decimal)

Expiration: 30 seconds
```

### 2. Active Signals Cache

Current trading signals:

```
Key pattern: signal:{signal_id}
Value type: Hash
Fields:
  - token_address: string
  - direction: string
  - confidence: string (decimal)
  - price: string (decimal)
  - strategy_id: string
  - created_at: string (ISO timestamp)
  - expires_at: string (ISO timestamp)

Expiration: Signal-specific (typically minutes to hours)
```

### 3. User Session Cache

Active user sessions:

```
Key pattern: session:{session_id}
Value type: Hash
Fields:
  - user_id: string
  - email: string
  - role: string
  - permissions: string (JSON array)
  - last_activity: string (ISO timestamp)
  - ip_address: string

Expiration: 24 hours with activity-based refresh
```

### 4. API Response Cache

Frequent API responses:

```
Key pattern: api:{endpoint}:{parameters_hash}
Value type: String (JSON response)

Expiration: Endpoint-specific (typically seconds to minutes)
```

## Schema Relationships

### 1. Primary Relationships

Key data connections:

- **User to Wallet**: One-to-many (user_id in wallets)
- **User to Portfolio**: One-to-many (user_id in portfolios)
- **Portfolio to Position**: One-to-many (portfolio_id in positions)
- **User to Strategy**: One-to-many (user_id in strategies)
- **Strategy to Signal**: One-to-many (strategy_id in signals)
- **Signal to Trade**: One-to-one or one-to-many (signal_id in trades)
- **User to Notification**: One-to-many (user_id in notifications)

### 2. Cross-Database Relationships

Connections between storage types:

- **Relational to NoSQL**: Token address as common identifier
- **Relational to Time-Series**: Strategy ID and token address as common tags
- **Relational to Cache**: Signal ID and user ID as key components
- **NoSQL to Time-Series**: Token address linking metadata to price history

### 3. Data Integrity Approach

Maintaining consistency across stores:

- **Transactional Boundaries**: Defined unit-of-work scope
- **Eventual Consistency**: Accepted delay in non-critical updates
- **Change Data Capture**: Event-based propagation of changes
- **Periodic Reconciliation**: Scheduled consistency verification
- **Compensating Transactions**: Recovery mechanisms for failures

## Database Evolution Strategy

### 1. Schema Migration

Approach to schema changes:

- **Version Control**: Tracked schema definitions
- **Migration Scripts**: Change implementation code
- **Forward/Backward Compatibility**: Supporting multiple versions
- **Phased Deployment**: Gradual schema updates
- **Blue-Green Updates**: Zero-downtime migrations

### 2. Performance Optimization

Schema improvements for efficiency:

- **Index Strategy**: Optimized field indexing
- **Partition Scheme**: Data division for performance
- **Query Optimization**: Efficient data access patterns
- **Denormalization**: Strategic redundancy for speed
- **Archival Process**: Moving historical data

### 3. Scalability Considerations

Supporting data growth:

- **Horizontal Sharding**: Data distribution across instances
- **Read Replicas**: Distributed query processing
- **Write Distribution**: Managing write volume
- **Connection Pooling**: Efficient resource usage
- **Materialized Views**: Precomputed query results

## Conclusion

The Database Schema of the Quant-Bot platform employs a multi-database approach that matches storage technologies to specific data requirements. By using relational databases for structured user and transaction data, NoSQL for flexible token and market information, time-series databases for historical metrics, and in-memory caches for high-speed access, the platform achieves both performance and flexibility. This comprehensive schema design supports the system's core functionality while providing the foundation for future growth and feature expansion.