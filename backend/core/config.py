"""
QUANTUM DEGEN AI SWARM - CONFIGURATION
====================================
All settings and secrets for the AI swarm system.
"""

import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    """Configuration settings for the AI swarm"""
    
    # Blockchain RPC URLs (Free public endpoints)
    SOLANA_RPC_URL: str = "https://api.mainnet-beta.solana.com"
    SOLANA_RPC_BACKUP: str = "https://solana-api.projectserum.com"
    ETHEREUM_RPC_URL: str = "https://cloudflare-eth.com"
    
    # DEX and Market Data Sources (Free/Public endpoints)
    COINGECKO_API_URL: str = "https://api.coingecko.com/api/v3"
    DEXSCREENER_API_URL: str = "https://api.dexscreener.com/latest"
    JUPITER_API_URL: str = "https://price.jup.ag/v4"
    BIRDEYE_API_URL: str = "https://public-api.birdeye.so"
    
    # Social Media APIs (Optional - Free tiers)
    TWITTER_BEARER_TOKEN: Optional[str] = None
    REDDIT_CLIENT_ID: Optional[str] = None
    REDDIT_CLIENT_SECRET: Optional[str] = None
    TELEGRAM_BOT_TOKEN: Optional[str] = None
    
    # Database (Optional - defaults to in-memory)
    DATABASE_URL: str = "sqlite:///./trading_bot.db"
    REDIS_URL: str = "redis://localhost:6379"
    
    # Trading Settings
    INITIAL_BALANCE: float = 25.0
    TARGET_BALANCE: float = 20000.0
    MIN_POSITION_SIZE: float = 1.0
    MAX_POSITION_SIZE: float = 15.0  # Max $ per position
    DEFAULT_STOP_LOSS: float = 0.3   # 30% stop loss
    
    # Risk Management
    MAX_DAILY_LOSS: float = 0.5      # 50% of balance
    MAX_POSITIONS: int = 5
    MIN_LIQUIDITY: float = 5000.0    # Min $5K liquidity
    MAX_MARKET_CAP: float = 200000.0 # Max $200K MC
    WHALE_THRESHOLD: float = 500.0   # 500 SOL minimum
    
    # Data Update Intervals (seconds)
    PRICE_UPDATE_INTERVAL: int = 5
    WHALE_SCAN_INTERVAL: int = 30
    TOKEN_SCAN_INTERVAL: int = 60
    PORTFOLIO_UPDATE_INTERVAL: int = 10
    
    # AI Analysis Settings
    NEURAL_CONFIDENCE_THRESHOLD: float = 0.85
    FIBONACCI_LEVELS: list = [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0]
    
    # Scanner Settings
    SCAN_INTERVAL: int = 30          # seconds
    NEW_TOKEN_AGE_LIMIT: int = 900   # 15 minutes
    MIN_HOLDERS: int = 50
    MIN_BUY_SELL_RATIO: float = 3.0
    
    # Smart Money Detection
    SMART_MONEY_WIN_RATE: float = 0.8
    MIN_WHALE_AMOUNT: float = 100.0  # 100 SOL minimum
    
    # WebSocket Settings
    WS_HEARTBEAT_INTERVAL: int = 30
    MAX_WS_CONNECTIONS: int = 100
    WEBSOCKET_HOST: str = "localhost"
    WEBSOCKET_PORT: int = 8000
    
    # Debug and Development
    DEBUG_MODE: bool = True
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

# Global settings instance
settings = Settings() 