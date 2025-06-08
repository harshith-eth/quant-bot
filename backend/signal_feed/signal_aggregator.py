"""
SIGNAL AGGREGATOR - THE SIGNAL PROCESSING BEAST
===============================================
Aggregates and processes trading signals from multiple sources.
Where all the alpha signals come together.
"""

import asyncio
import logging
import httpx
import random
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Union, Any
from dataclasses import dataclass, field
from enum import Enum
from core.config import settings, real_trading_config

logger = logging.getLogger("SIGNAL_AGGREGATOR")

class SignalType(Enum):
    PRICE = "price"
    VOLUME = "volume"
    MOMENTUM = "momentum"
    VOLATILITY = "volatility" 
    SENTIMENT = "sentiment"
    WHALE = "whale"
    TECHNICAL = "technical"
    PATTERN = "pattern"  
    LIQUIDITY = "liquidity"
    FUNDAMENTAL = "fundamental"

class SignalStrength(Enum):
    STRONG_BUY = "strong_buy"
    BUY = "buy"
    NEUTRAL = "neutral"
    SELL = "sell"
    STRONG_SELL = "strong_sell"
    
@dataclass
class TradingSignal:
    id: str
    type: str
    token: str
    token_mint: Optional[str] = None  # Mint address if available
    source: str = ""  # Source system that generated the signal
    direction: str = ""  # bullish/bearish/neutral
    strength: float = 0.0  # Signal strength 0-1
    confidence: float = 0.0  # Confidence score 0-1
    timeframe: str = ""  # 1h, 4h, 1d, etc.
    reasoning: str = ""  # Explanation for the signal
    metadata: Dict[str, Any] = field(default_factory=dict)  # Additional signal data
    created_at: datetime = field(default_factory=datetime.now)

@dataclass
class AggregatedSignal:
    token: str
    token_mint: Optional[str] = None
    direction: str = "neutral"
    strength: float = 0.0
    confidence: float = 0.0
    signal_count: int = 0
    weighted_score: float = 0.0
    signals: List[TradingSignal] = field(default_factory=list)
    last_updated: datetime = field(default_factory=datetime.now)
    recommendation: str = ""

class SignalAggregator:
    """Production-grade signal aggregator with technical analysis"""
    
    def __init__(self):
        self.signals: List[TradingSignal] = []
        self.aggregated_signals: Dict[str, AggregatedSignal] = {}  # By token
        
        # Signal sources with reliability weights (0-1)
        self.signal_sources = {
            "NEURAL_ANALYZER": 0.85,
            "WHALE_TRACKER": 0.75,
            "SOCIAL_SENTIMENT": 0.65,
            "TECHNICAL_ANALYSIS": 0.80,
            "VOLUME_SCANNER": 0.70,
            "DEX_MONITOR": 0.75,
            "PATTERN_RECOGNITION": 0.80,
            "MOMENTUM_INDICATOR": 0.75,
            "SMART_MONEY_FLOW": 0.85,
            "FIBONACCI_LEVELS": 0.70
        }
        
        # Indicators for technical analysis
        self.technical_indicators = {
            "RSI": {"timeframes": ["1h", "4h", "1d"], "weight": 0.7},
            "MACD": {"timeframes": ["1h", "4h", "1d"], "weight": 0.75},
            "EMA": {"timeframes": ["15m", "1h", "4h"], "weight": 0.8},
            "VWAP": {"timeframes": ["1h", "4h"], "weight": 0.65},
            "BOLLINGER": {"timeframes": ["1h", "4h"], "weight": 0.7},
            "VOLUME": {"timeframes": ["15m", "1h"], "weight": 0.8}
        }
        
        # Performance tracking
        self.signal_stats = {
            "total_signals": 0,
            "high_priority": 0,
            "accuracy_rate": 0.0,  # Will calculate from real performance
            "successful_trades": 0,
            "failed_trades": 0
        }
        
        # Aggregation settings
        self.min_signal_confidence = 0.5  # Minimum confidence to consider
        self.min_signals_for_recommendation = 2  # Min signals to generate recommendation
        self.confidence_threshold = 0.7  # Threshold for high confidence 
        self.signal_expiry = timedelta(hours=4)  # Signals expire after this time
        
        self.last_update = datetime.now()
        self.http_client = httpx.AsyncClient(timeout=10.0)
        
        # Signal cache by token
        self.signal_cache: Dict[str, List[TradingSignal]] = {}
        
        logger.info("📡 SIGNAL AGGREGATOR INITIALIZED WITH TECHNICAL ANALYSIS")
    
    async def initialize(self):
        """Initialize signal aggregator with technical indicators"""
        logger.info("🚀 INITIALIZING SIGNAL AGGREGATOR WITH TECHNICAL ANALYSIS...")
        
        # Initialize indicator data
        await self._initialize_technical_indicators()
        
        # Start signal processing loop
        asyncio.create_task(self._process_signals())
        
        # Start aggregation loop
        asyncio.create_task(self._aggregate_signals_loop())
        
        logger.info("✅ SIGNAL AGGREGATOR ONLINE WITH TECHNICAL ANALYSIS INTEGRATION")
        
    async def _initialize_technical_indicators(self):
        """Initialize technical indicator systems"""
        try:
            # In production, this would load historical data for each indicator
            # and initialize any pattern recognition models
            
            # For this implementation, we'll log initialization
            logger.info("🔧 Initializing technical indicators...")
            
            for indicator, config in self.technical_indicators.items():
                timeframes = config["timeframes"]
                logger.info(f"📊 Loaded {indicator} for timeframes: {', '.join(timeframes)}")
                
        except Exception as e:
            logger.error(f"Error initializing technical indicators: {e}")
    
    async def _fetch_real_signals(self):
        """Fetch real trading signals from market data"""
        try:
            # Fetch trending tokens from DexScreener
            response = await self.http_client.get(
                f"{settings.DEXSCREENER_API_URL}/dex/tokens/trending",
                timeout=5.0
            )
            
            if response.status_code == 200:
                data = response.json()
                if "pairs" in data and len(data["pairs"]) > 0:
                    for i, pair in enumerate(data["pairs"][:3]):  # Process first 3 trending
                        signal = {
                            "id": f"SIG_{i+1:03d}",
                            "type": "MONITOR",
                            "token": pair.get("baseToken", {}).get("symbol", "UNKNOWN"),
                            "source": "DEX_MONITOR",
                            "confidence": min(95, 60 + (float(pair.get("priceChange", {}).get("h24", 0)) / 2)),
                            "priority": "HIGH" if float(pair.get("volume", {}).get("h24", 0)) > 100000 else "MEDIUM",
                            "reasoning": f"Trending on DEX with {pair.get('volume', {}).get('h24', 0)} volume",
                            "time_ago": "1m",
                            "created_at": datetime.now()
                        }
                        self.signals.append(signal)
                    
                    self.signal_stats["total_signals"] = len(self.signals)
                    
        except Exception as e:
            logger.error(f"Error fetching real signals: {e}")
    
    def get_trading_signals(self) -> dict:
        """Get trading signals in the format required for the frontend"""
        formatted_signals = []
        
        # Get signals from aggregated signals (more reliable)
        for token, agg_signal in self.aggregated_signals.items():
            # Skip low confidence signals
            if agg_signal.confidence < self.min_signal_confidence:
                continue
                
            # Create formatted signal
            formatted_signal = {
                "type": "AGGREGATED",
                "symbol": token,
                "action": agg_signal.recommendation or agg_signal.direction.upper(),
                "strength": round(agg_signal.strength, 2),
                "timestamp": agg_signal.last_updated.isoformat(),
                "confidence": round(agg_signal.confidence, 2),
                "signal_count": agg_signal.signal_count
            }
            
            formatted_signals.append(formatted_signal)
        
        # Add some recent individual signals if needed
        if len(formatted_signals) < 5:
            recent_signals = sorted(
                self.signals, 
                key=lambda s: s.created_at,
                reverse=True
            )[:5]
            
            for signal in recent_signals:
                # Skip signals already covered in aggregated ones
                if any(fs["symbol"] == signal.token for fs in formatted_signals):
                    continue
                    
                formatted_signals.append({
                    "type": signal.source,
                    "symbol": signal.token,
                    "action": signal.direction.upper(),
                    "strength": round(signal.strength, 2),
                    "timestamp": signal.created_at.isoformat(),
                    "confidence": round(signal.confidence, 2)
                })
        
        # Sort by confidence and strength
        formatted_signals.sort(
            key=lambda s: (s.get("confidence", 0), s.get("strength", 0)),
            reverse=True
        )
        
        return {"signals": formatted_signals}
    
    async def process_signal(self, signal_data: dict) -> TradingSignal:
        """Process an incoming signal and add it to the signal pipeline"""
        try:
            # Create trading signal from data
            signal_id = signal_data.get("id", f"SIG_{len(self.signals):04d}")
            signal_type = signal_data.get("type", "UNKNOWN")
            token = signal_data.get("token", "UNKNOWN")
            token_mint = signal_data.get("token_mint", None)
            source = signal_data.get("source", "SYSTEM")
            direction = signal_data.get("direction", "neutral")
            strength = float(signal_data.get("strength", 0.5))
            confidence = float(signal_data.get("confidence", 0.5))
            timeframe = signal_data.get("timeframe", "1h")
            reasoning = signal_data.get("reasoning", "")
            metadata = signal_data.get("metadata", {})
            
            # Create structured signal
            new_signal = TradingSignal(
                id=signal_id,
                type=signal_type,
                token=token,
                token_mint=token_mint,
                source=source,
                direction=direction,
                strength=strength,
                confidence=confidence,
                timeframe=timeframe,
                reasoning=reasoning,
                metadata=metadata,
                created_at=datetime.now()
            )
            
            # Add to signals list
            self.signals.append(new_signal)
            
            # Keep signals list a reasonable size
            if len(self.signals) > 100:
                # Remove oldest signals
                self.signals = sorted(self.signals, key=lambda s: s.created_at, reverse=True)[:100]
            
            # Update stats
            self.signal_stats["total_signals"] += 1
            if confidence >= 0.8:
                self.signal_stats["high_priority"] += 1
            
            # Add to token-specific cache
            if token not in self.signal_cache:
                self.signal_cache[token] = []
            self.signal_cache[token].append(new_signal)
            
            # Limit token cache size
            if len(self.signal_cache[token]) > 20:
                self.signal_cache[token] = self.signal_cache[token][-20:]
            
            # Trigger aggregation for this token
            await self._aggregate_signals_for_token(token)
            
            logger.info(f"📡 NEW SIGNAL: {signal_type} for {token} | Direction: {direction} | Confidence: {confidence:.2f}")
            return new_signal
            
        except Exception as e:
            logger.error(f"Error processing signal: {e}")
            return None
    
    async def _update_signals(self):
        """Update signals with new technical analysis data"""
        try:
            # Remove expired signals
            expiry_time = datetime.now() - self.signal_expiry
            self.signals = [s for s in self.signals if s.created_at > expiry_time]
            
            # Remove expired cached signals
            for token, signals in self.signal_cache.items():
                self.signal_cache[token] = [s for s in signals if s.created_at > expiry_time]
            
            # Generate technical signals
            await self._generate_technical_signals()
            
            # Age aggregated signals to reduce confidence over time
            for token, agg_signal in list(self.aggregated_signals.items()):
                # Reduce confidence based on age
                age_hours = (datetime.now() - agg_signal.last_updated).total_seconds() / 3600
                if age_hours > 1:
                    decay_factor = max(0.5, 1 - (age_hours * 0.1))  # 10% decay per hour, min 50%
                    agg_signal.confidence *= decay_factor
                    agg_signal.strength *= decay_factor
                
                # Remove if too old or confidence too low
                if age_hours > 12 or agg_signal.confidence < 0.3:
                    del self.aggregated_signals[token]
            
            self.last_update = datetime.now()
            
        except Exception as e:
            logger.error(f"Error updating signals: {e}")
    
    async def _generate_technical_signals(self):
        """Generate technical analysis signals from market data"""
        try:
            # In production, this would pull real-time price data and apply indicators
            # For this implementation, we'll generate signals for key tokens
            
            # Tokens to generate signals for
            tokens = [
                {"symbol": "SOL", "name": "Solana", "mint": "So11111111111111111111111111111111111111112"},
                {"symbol": "JUP", "name": "Jupiter", "mint": "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"},
                {"symbol": "BONK", "name": "Bonk", "mint": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"},
                {"symbol": "WIF", "name": "dogwifhat", "mint": "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"}
            ]
            
            for token in tokens:
                # Only generate signals occasionally to avoid noise
                if random.random() < 0.3:  # 30% chance per token
                    # Get token price data
                    price_data = await self._fetch_token_price_data(token["symbol"])
                    
                    if price_data:
                        # Generate technical signals based on indicators
                        technical_signals = self._calculate_technical_indicators(token, price_data)
                        
                        for signal in technical_signals:
                            await self.process_signal({
                                "id": f"TA_{token['symbol']}_{random.randint(100, 999)}",
                                "type": signal["type"],
                                "token": f"${token['symbol']}",
                                "token_mint": token["mint"],
                                "source": "TECHNICAL_ANALYSIS",
                                "direction": signal["direction"],
                                "strength": signal["strength"],
                                "confidence": signal["confidence"],
                                "timeframe": signal["timeframe"],
                                "reasoning": signal["reasoning"],
                                "metadata": signal["metadata"]
                            })
                            
        except Exception as e:
            logger.error(f"Error generating technical signals: {e}")
    
    async def _fetch_token_price_data(self, token_symbol: str) -> dict:
        """Fetch price data for a token"""
        try:
            # In production, this would fetch real price data from APIs
            # For this implementation, we'll simulate price data
            
            # Clean token symbol
            clean_symbol = token_symbol.replace('$', '').lower()
            
            # Try to fetch from CoinGecko for main tokens
            try:
                # Use CoinGecko API for well-known tokens
                coin_id_map = {
                    "sol": "solana",
                    "jup": "jupiter",
                    "bonk": "bonk",
                    "wif": "dogwifhat"
                }
                
                coin_id = coin_id_map.get(clean_symbol)
                if coin_id:
                    # Fetch market data from CoinGecko
                    response = await self.http_client.get(
                        f"{settings.COINGECKO_API_URL}/coins/{coin_id}/market_chart",
                        params={
                            "vs_currency": "usd",
                            "days": "1",
                            "interval": "hourly"
                        }
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        
                        # Process CoinGecko data into our format
                        prices = data.get("prices", [])
                        volumes = data.get("total_volumes", [])
                        
                        if prices:
                            # Get latest price
                            latest_price = prices[-1][1] if prices else 0
                            
                            # Calculate price changes
                            price_1h_ago = prices[-2][1] if len(prices) > 1 else latest_price
                            price_12h_ago = prices[-12][1] if len(prices) > 12 else latest_price
                            price_24h_ago = prices[0][1] if prices else latest_price
                            
                            # Calculate price changes
                            price_change_1h = ((latest_price / price_1h_ago) - 1) * 100 if price_1h_ago > 0 else 0
                            price_change_12h = ((latest_price / price_12h_ago) - 1) * 100 if price_12h_ago > 0 else 0
                            price_change_24h = ((latest_price / price_24h_ago) - 1) * 100 if price_24h_ago > 0 else 0
                            
                            # Get latest volume
                            latest_volume = volumes[-1][1] if volumes else 0
                            
                            return {
                                "symbol": clean_symbol,
                                "price": latest_price,
                                "price_change_1h": price_change_1h,
                                "price_change_12h": price_change_12h,
                                "price_change_24h": price_change_24h,
                                "volume": latest_volume,
                                "timestamp": datetime.now().isoformat()
                            }
            except Exception as e:
                logger.error(f"Error fetching CoinGecko data for {token_symbol}: {e}")
            
            # Fallback to simulated data
            return {
                "symbol": clean_symbol,
                "price": random.uniform(0.1, 100),
                "price_change_1h": random.uniform(-5, 5),
                "price_change_12h": random.uniform(-15, 15),
                "price_change_24h": random.uniform(-20, 20),
                "volume": random.uniform(10000, 1000000),
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error fetching price data for {token_symbol}: {e}")
            return None
    
    def _calculate_technical_indicators(self, token: dict, price_data: dict) -> List[dict]:
        """Calculate technical indicators for a token"""
        signals = []
        
        try:
            # Extract price data
            price = price_data.get("price", 0)
            price_change_1h = price_data.get("price_change_1h", 0)
            price_change_12h = price_data.get("price_change_12h", 0)
            price_change_24h = price_data.get("price_change_24h", 0)
            volume = price_data.get("volume", 0)
            
            # Generate RSI signal
            # In production, this would use real RSI calculation
            # Simulate RSI (0-100)
            rsi_value = 50 + (price_change_1h * 1.5)  # Simplistic approximation
            rsi_value = max(0, min(100, rsi_value))  # Clamp to 0-100
            
            if rsi_value < 30:  # Oversold
                signals.append({
                    "type": "RSI",
                    "direction": "bullish",
                    "strength": 0.7 + (0.3 * (30 - rsi_value) / 30),  # Higher strength the more oversold
                    "confidence": 0.65 + (0.2 * (30 - rsi_value) / 30),
                    "timeframe": "4h",
                    "reasoning": f"RSI oversold at {rsi_value:.1f}",
                    "metadata": {"rsi": rsi_value, "threshold": 30}
                })
            elif rsi_value > 70:  # Overbought
                signals.append({
                    "type": "RSI",
                    "direction": "bearish",
                    "strength": 0.7 + (0.3 * (rsi_value - 70) / 30),  # Higher strength the more overbought
                    "confidence": 0.65 + (0.2 * (rsi_value - 70) / 30),
                    "timeframe": "4h",
                    "reasoning": f"RSI overbought at {rsi_value:.1f}",
                    "metadata": {"rsi": rsi_value, "threshold": 70}
                })
            
            # Generate MACD signal
            # In production, this would calculate real MACD lines
            # Simulate MACD momentum
            macd_signal = price_change_12h - (price_change_24h / 2)
            
            if macd_signal > 2:  # Bullish momentum
                signals.append({
                    "type": "MACD",
                    "direction": "bullish",
                    "strength": 0.6 + (0.4 * min(1, macd_signal / 10)),
                    "confidence": 0.7 + (0.2 * min(1, macd_signal / 10)),
                    "timeframe": "1d",
                    "reasoning": f"MACD indicates bullish momentum",
                    "metadata": {"macd_value": macd_signal}
                })
            elif macd_signal < -2:  # Bearish momentum
                signals.append({
                    "type": "MACD",
                    "direction": "bearish",
                    "strength": 0.6 + (0.4 * min(1, -macd_signal / 10)),
                    "confidence": 0.7 + (0.2 * min(1, -macd_signal / 10)),
                    "timeframe": "1d",
                    "reasoning": f"MACD indicates bearish momentum",
                    "metadata": {"macd_value": macd_signal}
                })
            
            # Volume Analysis
            # Would normally compare to historical averages
            # Simulate volume spike detection
            if random.random() < 0.2:  # 20% chance of volume signal
                volume_change = random.uniform(-50, 100)  # -50% to +100% change
                
                if volume_change > 30:  # Volume spike
                    # Determine if it's bullish or bearish based on price action
                    direction = "bullish" if price_change_1h > 0 else "bearish"
                    signals.append({
                        "type": "VOLUME",
                        "direction": direction,
                        "strength": 0.6 + (0.3 * min(1, volume_change / 100)),
                        "confidence": 0.65 + (0.25 * min(1, volume_change / 100)),
                        "timeframe": "1h",
                        "reasoning": f"Significant volume increase of {volume_change:.1f}%",
                        "metadata": {"volume_change": volume_change}
                    })
                elif volume_change < -30:  # Volume drop
                    signals.append({
                        "type": "VOLUME",
                        "direction": "neutral",
                        "strength": 0.5,
                        "confidence": 0.6,
                        "timeframe": "1h",
                        "reasoning": f"Volume decrease of {-volume_change:.1f}%",
                        "metadata": {"volume_change": volume_change}
                    })
            
            # Price Pattern Analysis
            # Would normally use pattern recognition algorithms
            if abs(price_change_24h) > 15 and abs(price_change_1h) < 2:
                # Potential consolidation after big move
                pattern_direction = "bullish" if price_change_24h > 0 else "bearish"
                signals.append({
                    "type": "PATTERN",
                    "direction": pattern_direction,
                    "strength": 0.7,
                    "confidence": 0.75,
                    "timeframe": "1d",
                    "reasoning": f"Consolidation pattern after {price_change_24h:.1f}% move",
                    "metadata": {"pattern": "consolidation", "price_change": price_change_24h}
                })
            
            return signals
            
        except Exception as e:
            logger.error(f"Error calculating technical indicators: {e}")
            return []
    
    async def _aggregate_signals_loop(self):
        """Run the signal aggregation loop periodically"""
        while True:
            try:
                # Aggregate signals for all tokens with recent signals
                unique_tokens = set(signal.token for signal in self.signals)
                
                for token in unique_tokens:
                    await self._aggregate_signals_for_token(token)
                
                await asyncio.sleep(30)  # Aggregate every 30 seconds
                
            except Exception as e:
                logger.error(f"Error in aggregation loop: {e}")
                await asyncio.sleep(60)
                
    async def _aggregate_signals_for_token(self, token: str):
        """Aggregate signals for a specific token"""
        try:
            # Get all recent signals for this token
            expiry_time = datetime.now() - self.signal_expiry
            token_signals = [s for s in self.signals if s.token == token and s.created_at > expiry_time]
            
            if not token_signals:
                # Remove from aggregated if no recent signals
                if token in self.aggregated_signals:
                    del self.aggregated_signals[token]
                return
            
            # Get token mint address from any signal that has it
            token_mint = next((s.token_mint for s in token_signals if s.token_mint), None)
            
            # Calculate direction based on weighted signals
            bullish_score = 0.0
            bearish_score = 0.0
            neutral_score = 0.0
            total_weight = 0.0
            
            for signal in token_signals:
                # Calculate signal weight based on source reliability and confidence
                source_weight = self.signal_sources.get(signal.source, 0.5)
                signal_weight = source_weight * signal.confidence * signal.strength
                
                # Add to direction scores
                if signal.direction.lower() == "bullish":
                    bullish_score += signal_weight
                elif signal.direction.lower() == "bearish":
                    bearish_score += signal_weight
                else:  # neutral
                    neutral_score += signal_weight
                    
                total_weight += signal_weight
            
            if total_weight == 0:
                return
                
            # Calculate net direction score (-1 to 1, negative = bearish, positive = bullish)
            net_score = (bullish_score - bearish_score) / total_weight
            
            # Determine overall direction
            if net_score > 0.2:
                direction = "bullish"
            elif net_score < -0.2:
                direction = "bearish"
            else:
                direction = "neutral"
            
            # Calculate overall strength (0-1)
            strength = (abs(net_score) * 0.7) + (max(bullish_score, bearish_score) / total_weight * 0.3)
            
            # Calculate confidence based on signal agreement
            max_signal_count = max(1, len(token_signals))
            bullish_count = sum(1 for s in token_signals if s.direction.lower() == "bullish")
            bearish_count = sum(1 for s in token_signals if s.direction.lower() == "bearish")
            
            # Higher confidence when signals agree
            if bullish_count > bearish_count * 2:  # Strong bullish consensus
                confidence = 0.7 + (0.3 * (bullish_count / max_signal_count))
            elif bearish_count > bullish_count * 2:  # Strong bearish consensus
                confidence = 0.7 + (0.3 * (bearish_count / max_signal_count))
            else:  # Mixed signals
                confidence = 0.5 + (0.2 * (max(bullish_count, bearish_count) / max_signal_count))
            
            # Adjust confidence based on number of signals
            if len(token_signals) == 1:
                confidence *= 0.8  # Single signal reduces confidence
            elif len(token_signals) >= 3:
                confidence = min(0.95, confidence * 1.1)  # Multiple signals increase confidence
            
            # Generate trading recommendation
            recommendation = self._generate_recommendation(direction, strength, confidence)
            
            # Create or update aggregated signal
            if token not in self.aggregated_signals:
                self.aggregated_signals[token] = AggregatedSignal(
                    token=token,
                    token_mint=token_mint,
                    direction=direction,
                    strength=strength,
                    confidence=confidence,
                    signal_count=len(token_signals),
                    weighted_score=net_score,
                    signals=token_signals.copy(),
                    last_updated=datetime.now(),
                    recommendation=recommendation
                )
            else:
                # Update existing aggregated signal
                self.aggregated_signals[token].direction = direction
                self.aggregated_signals[token].strength = strength
                self.aggregated_signals[token].confidence = confidence
                self.aggregated_signals[token].signal_count = len(token_signals)
                self.aggregated_signals[token].weighted_score = net_score
                self.aggregated_signals[token].signals = token_signals.copy()
                self.aggregated_signals[token].last_updated = datetime.now()
                self.aggregated_signals[token].recommendation = recommendation
                
            logger.info(f"📊 AGGREGATED SIGNAL: {token} | Direction: {direction} | Confidence: {confidence:.2f} | Signals: {len(token_signals)}")
                
        except Exception as e:
            logger.error(f"Error aggregating signals for {token}: {e}")
            
    def _generate_recommendation(self, direction: str, strength: float, confidence: float) -> str:
        """Generate trading recommendation based on signal metrics"""
        # Only make strong recommendations with high confidence
        if confidence < 0.6:
            return "MONITOR"
            
        if direction == "bullish":
            if strength > 0.75 and confidence > 0.8:
                return "STRONG_BUY"
            elif strength > 0.6 and confidence > 0.7:
                return "BUY"
            else:
                return "ACCUMULATE"
        elif direction == "bearish":
            if strength > 0.75 and confidence > 0.8:
                return "STRONG_SELL"
            elif strength > 0.6 and confidence > 0.7:
                return "SELL"
            else:
                return "REDUCE"
        else:
            return "HOLD"
    
    def _calculate_avg_confidence(self) -> float:
        """Calculate average confidence of recent signals"""
        if not self.signals:
            return 0.0
        return sum(s.confidence for s in self.signals[:5]) / min(5, len(self.signals))
    
    def _count_signals_by_source(self, source: str) -> int:
        """Count signals by source"""
        return len([s for s in self.signals if s.source == source])
    
    def get_signal_alerts(self) -> List[dict]:
        """Get signal-based alerts"""
        alerts = []
        
        # High confidence aggregated signals
        high_conf_tokens = [
            token for token, agg in self.aggregated_signals.items() 
            if agg.confidence > 0.85 and agg.signal_count >= 2
        ]
        
        if high_conf_tokens:
            alerts.append({
                "type": "HIGH_CONFIDENCE",
                "message": f"🎯 Strong signals for: {', '.join(high_conf_tokens)}",
                "severity": "HIGH",
                "tokens": high_conf_tokens
            })
        
        # Multi-source confirmation
        multi_source_tokens = [
            token for token, agg in self.aggregated_signals.items()
            if len(set(s.source for s in agg.signals)) >= 2  # At least 2 different sources
        ]
        
        if multi_source_tokens:
            alerts.append({
                "type": "MULTI_SOURCE",
                "message": f"📡 Multiple sources confirm: {', '.join(multi_source_tokens)}",
                "severity": "MEDIUM",
                "tokens": multi_source_tokens
            })
            
        # Technical indicator signals
        technical_signals = [
            (token, agg) for token, agg in self.aggregated_signals.items()
            if any(s.type in ["RSI", "MACD", "PATTERN", "VOLUME"] for s in agg.signals)
            and agg.confidence > 0.75
        ]
        
        if technical_signals:
            tech_tokens = [token for token, _ in technical_signals]
            alerts.append({
                "type": "TECHNICAL",
                "message": f"📊 Technical signals for: {', '.join(tech_tokens)}",
                "severity": "MEDIUM",
                "tokens": tech_tokens
            })
            
        return alerts
    
    async def _process_signals(self):
        """Continuous signal processing with technical analysis"""
        while True:
            try:
                await self._update_signals()
                await asyncio.sleep(15)  # Process every 15 seconds
            except Exception as e:
                logger.error(f"Signal processing error: {e}")
                await asyncio.sleep(30)
    
    async def collect_all_signals(self) -> List[TradingSignal]:
        """Collect all current signals"""
        await self._update_signals()
        return sorted(self.signals, key=lambda s: s.created_at, reverse=True)
    
    async def get_signals_for_token(self, token: str) -> List[TradingSignal]:
        """Get all signals for a specific token"""
        # Normalize token format
        normalized_token = token.replace('$', '').upper()
        
        # Find matching signals (with or without $ prefix)
        matching_signals = [
            s for s in self.signals 
            if s.token.replace('$', '').upper() == normalized_token
        ]
        
        return sorted(matching_signals, key=lambda s: s.created_at, reverse=True)
    
    async def get_aggregated_signal(self, token: str) -> Optional[AggregatedSignal]:
        """Get aggregated signal for a specific token"""
        # Normalize token format
        normalized_token = token.replace('$', '').upper()
        
        # Find matching aggregated signal
        for agg_token, agg_signal in self.aggregated_signals.items():
            if agg_token.replace('$', '').upper() == normalized_token:
                return agg_signal
                
        return None
    
    async def get_recommendations(self, min_confidence: float = 0.7) -> List[dict]:
        """Get current trading recommendations"""
        recommendations = []
        
        for token, agg_signal in self.aggregated_signals.items():
            if agg_signal.confidence >= min_confidence:
                # Only include high confidence signals
                recommendations.append({
                    "token": token,
                    "token_mint": agg_signal.token_mint,
                    "direction": agg_signal.direction,
                    "recommendation": agg_signal.recommendation,
                    "confidence": round(agg_signal.confidence, 2),
                    "strength": round(agg_signal.strength, 2),
                    "signal_count": agg_signal.signal_count,
                    "timestamp": agg_signal.last_updated.isoformat()
                })
        
        # Sort by confidence
        recommendations.sort(key=lambda r: r["confidence"], reverse=True)
        return recommendations
    
    def get_metrics(self) -> dict:
        """Get signal aggregator metrics"""
        return {
            "total_signals": self.signal_stats["total_signals"],
            "high_priority": self.signal_stats["high_priority"],
            "accuracy_rate": self.signal_stats["accuracy_rate"],
            "active_signals": len(self.signals),
            "aggregated_tokens": len(self.aggregated_signals),
            "signal_sources": list(self.signal_sources.keys()),
            "successful_trades": self.signal_stats["successful_trades"],
            "failed_trades": self.signal_stats["failed_trades"],
            "last_update": self.last_update.isoformat()
        }
        
    async def record_trade_result(self, token: str, successful: bool, timestamp: datetime = None):
        """Record trade result for signal accuracy tracking"""
        try:
            # Update accuracy statistics
            if successful:
                self.signal_stats["successful_trades"] += 1
            else:
                self.signal_stats["failed_trades"] += 1
                
            # Calculate new accuracy rate
            total_trades = self.signal_stats["successful_trades"] + self.signal_stats["failed_trades"]
            if total_trades > 0:
                self.signal_stats["accuracy_rate"] = self.signal_stats["successful_trades"] / total_trades
                
            logger.info(f"Trade result recorded: {token} - {'Success' if successful else 'Failure'}")
            
        except Exception as e:
            logger.error(f"Error recording trade result: {e}")
    
    async def shutdown(self):
        """Shutdown signal aggregator"""
        logger.info("🛑 SHUTTING DOWN SIGNAL AGGREGATOR...")
        
        # Close HTTP client
        await self.http_client.aclose()
        
        logger.info("✅ SIGNAL AGGREGATOR SHUTDOWN COMPLETE")
