"""
MARKET INTELLIGENCE - THE MARKET READING MACHINE
===============================================
Advanced market analysis with technical indicators and trend detection.
Reading the market like a fucking fortune teller.
"""

import asyncio
import logging
import httpx
import random
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import json
from core.config import settings

logger = logging.getLogger("MARKET_INTELLIGENCE")

class MarketIntelligence:
    """Advanced market analysis and intelligence system"""
    
    def __init__(self):
        self.market_data = {}
        self.technical_indicators = {}
        self.market_conditions = {}
        self.fibonacci_levels = [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0]
        self.last_update = datetime.now()
        self.http_client = httpx.AsyncClient()
        
        # Initialize market data
        self._initialize_market_data()
        
        logger.info("📊 MARKET INTELLIGENCE INITIALIZED")
    
    async def initialize(self):
        """Initialize market intelligence"""
        logger.info("🚀 INITIALIZING MARKET INTELLIGENCE...")
        # Start market monitoring
        asyncio.create_task(self._monitor_market())
        logger.info("✅ MARKET INTELLIGENCE ONLINE")
    
    def _initialize_market_data(self):
        """Initialize with base market data"""
        self.market_data = {
            "total_market_cap": 2350000000,  # $2.35B
            "market_dominance": {
                "SOL": 45.2,
                "ETH": 28.7,
                "MEMES": 26.1
            },
            "fear_greed_index": 72,  # Greed
            "global_sentiment": "BULLISH",
            "trend_strength": 8.4,
            "volatility": 67.3
        }
        
        self.technical_indicators = {
            "rsi": {"1h": 68.4, "4h": 72.1, "1d": 58.9},
            "macd": {"signal": "BULLISH", "histogram": 0.0023},
            "ema": {"20": 0.000045, "50": 0.000041, "200": 0.000038},
            "bollinger": {"upper": 0.000048, "middle": 0.000044, "lower": 0.000040},
            "volume": {"avg_24h": 15600000, "current": 23400000, "spike": True}
        }
    
    async def get_analysis(self) -> dict:
        """Get comprehensive market analysis"""
        await self._update_market_analysis()
        
        return {
            "market_overview": {
                "total_market_cap": f"${self.market_data['total_market_cap']/1000000:.1f}M",
                "sentiment": self.market_data["global_sentiment"],
                "fear_greed": f"{self.market_data['fear_greed_index']}/100",
                "trend_strength": f"{self.market_data['trend_strength']:.1f}/10",
                "volatility": f"{self.market_data['volatility']:.1f}%"
            },
            "technical_analysis": {
                "rsi_1h": f"{self.technical_indicators['rsi']['1h']:.1f}",
                "rsi_4h": f"{self.technical_indicators['rsi']['4h']:.1f}",
                "macd_signal": self.technical_indicators["macd"]["signal"],
                "trend_ema": self._get_ema_trend(),
                "volume_status": "SPIKE" if self.technical_indicators["volume"]["spike"] else "NORMAL"
            },
            "fibonacci_analysis": self._get_fibonacci_analysis(),
            "support_resistance": self._get_support_resistance(),
            "market_sectors": {
                "meme_coins": {"trend": "BULLISH", "strength": 8.7},
                "ai_tokens": {"trend": "NEUTRAL", "strength": 6.2},
                "defi": {"trend": "BEARISH", "strength": 4.1},
                "gaming": {"trend": "BULLISH", "strength": 7.8}
            },
            "key_levels": {
                "major_support": "$0.000041",
                "major_resistance": "$0.000048", 
                "breakout_target": "$0.000055",
                "stop_loss": "$0.000037"
            },
            "predictions": {
                "next_1h": self._predict_short_term(),
                "next_4h": self._predict_medium_term(),
                "next_24h": self._predict_long_term()
            },
            "alerts": self._get_market_alerts(),
            "last_update": self.last_update.isoformat()
        }
    
    async def _update_market_analysis(self):
        """Update market analysis with fresh data"""
        # Simulate market data updates
        await self._update_market_cap()
        await self._update_technical_indicators()
        await self._update_sentiment()
        
        self.last_update = datetime.now()
    
    async def _update_market_cap(self):
        """Update market cap and dominance using real data"""
        try:
            # Fetch real market data from CoinGecko
            response = await self.http_client.get(
                f"{settings.COINGECKO_API_URL}/global"
            )
            data = response.json()
            
            if "data" in data:
                global_data = data["data"]
                self.market_data["total_market_cap"] = global_data.get("total_market_cap", {}).get("usd", 2350000000)
        
                # Update market dominance
                dominance = global_data.get("market_cap_percentage", {})
                self.market_data["market_dominance"] = {
                    "SOL": dominance.get("sol", 1.5),
                    "ETH": dominance.get("eth", 18.5),
                    "BTC": dominance.get("btc", 45.2)
                }
        except Exception as e:
            logger.error(f"Error fetching real market data: {e}")
            # Fallback to previous values if API fails
    
    async def _update_technical_indicators(self):
        """Update technical indicators"""
        # Update RSI
        for timeframe in self.technical_indicators["rsi"]:
            rsi_change = random.uniform(-3, 3)
            self.technical_indicators["rsi"][timeframe] += rsi_change
            self.technical_indicators["rsi"][timeframe] = max(20, min(80, self.technical_indicators["rsi"][timeframe]))
        
        # Update MACD
        if random.random() < 0.2:  # 20% chance to flip
            current_signal = self.technical_indicators["macd"]["signal"]
            self.technical_indicators["macd"]["signal"] = "BEARISH" if current_signal == "BULLISH" else "BULLISH"
        
        # Update volume
        volume_change = random.uniform(0.8, 1.3)
        self.technical_indicators["volume"]["current"] *= volume_change
        avg_volume = self.technical_indicators["volume"]["avg_24h"]
        self.technical_indicators["volume"]["spike"] = self.technical_indicators["volume"]["current"] > avg_volume * 1.5
    
    async def _update_sentiment(self):
        """Update market sentiment"""
        # Update fear & greed index
        fg_change = random.uniform(-5, 5)
        self.market_data["fear_greed_index"] += fg_change
        self.market_data["fear_greed_index"] = max(10, min(90, self.market_data["fear_greed_index"]))
        
        # Update global sentiment based on fear & greed
        fg_index = self.market_data["fear_greed_index"]
        if fg_index > 70:
            self.market_data["global_sentiment"] = "BULLISH"
        elif fg_index < 30:
            self.market_data["global_sentiment"] = "BEARISH"
        else:
            self.market_data["global_sentiment"] = "NEUTRAL"
        
        # Update trend strength
        trend_change = random.uniform(-0.3, 0.3)
        self.market_data["trend_strength"] += trend_change
        self.market_data["trend_strength"] = max(3.0, min(10.0, self.market_data["trend_strength"]))
    
    def _get_ema_trend(self) -> str:
        """Determine EMA trend"""
        ema20 = self.technical_indicators["ema"]["20"]
        ema50 = self.technical_indicators["ema"]["50"]
        ema200 = self.technical_indicators["ema"]["200"]
        
        if ema20 > ema50 > ema200:
            return "STRONG BULLISH"
        elif ema20 > ema50:
            return "BULLISH"
        elif ema20 < ema50 < ema200:
            return "STRONG BEARISH"
        else:
            return "BEARISH"
    
    def _get_fibonacci_analysis(self) -> dict:
        """Get Fibonacci retracement analysis"""
        current_price = 0.000044
        high = 0.000052
        low = 0.000036
        
        # Calculate Fibonacci levels
        fib_levels = {}
        for level in self.fibonacci_levels:
            price = low + (high - low) * level
            fib_levels[f"{level:.1%}"] = f"${price:.6f}"
        
        # Determine current position
        current_fib = (current_price - low) / (high - low)
        
        return {
            "range_high": f"${high:.6f}",
            "range_low": f"${low:.6f}",
            "current_level": f"{current_fib:.1%}",
            "levels": fib_levels,
            "key_support": f"${low + (high - low) * 0.618:.6f}",
            "key_resistance": f"${low + (high - low) * 0.786:.6f}"
        }
    
    def _get_support_resistance(self) -> dict:
        """Get support and resistance levels"""
        return {
            "immediate_support": ["$0.000041", "$0.000039"],
            "immediate_resistance": ["$0.000047", "$0.000049"],
            "major_support": ["$0.000036", "$0.000033"],
            "major_resistance": ["$0.000052", "$0.000058"],
            "psychological_levels": ["$0.000040", "$0.000050", "$0.000060"]
        }
    
    def _predict_short_term(self) -> str:
        """Predict next 1 hour movement"""
        rsi_1h = self.technical_indicators["rsi"]["1h"]
        volume_spike = self.technical_indicators["volume"]["spike"]
        
        if rsi_1h > 70 and not volume_spike:
            return "CONSOLIDATION EXPECTED"
        elif rsi_1h < 30 and volume_spike:
            return "POTENTIAL REVERSAL"
        elif volume_spike and self.market_data["global_sentiment"] == "BULLISH":
            return "CONTINUED UPWARD MOMENTUM"
        else:
            return "SIDEWAYS MOVEMENT"
    
    def _predict_medium_term(self) -> str:
        """Predict next 4 hours movement"""
        trend_strength = self.market_data["trend_strength"]
        macd_signal = self.technical_indicators["macd"]["signal"]
        
        if trend_strength > 7 and macd_signal == "BULLISH":
            return "STRONG BULLISH CONTINUATION"
        elif trend_strength < 4:
            return "RANGE-BOUND TRADING"
        else:
            return "MILD BULLISH BIAS"
    
    def _predict_long_term(self) -> str:
        """Predict next 24 hours movement"""
        fg_index = self.market_data["fear_greed_index"]
        ema_trend = self._get_ema_trend()
        
        if fg_index > 75 and "BULLISH" in ema_trend:
            return "POTENTIAL CORRECTION RISK"
        elif fg_index < 25:
            return "ACCUMULATION OPPORTUNITY"
        else:
            return "TREND CONTINUATION LIKELY"
    
    def _get_market_alerts(self) -> List[dict]:
        """Get current market alerts"""
        alerts = []
        
        # Volume spike alert
        if self.technical_indicators["volume"]["spike"]:
            alerts.append({
                "type": "VOLUME",
                "message": "High volume spike detected",
                "severity": "HIGH"
            })
        
        # RSI alerts
        rsi_1h = self.technical_indicators["rsi"]["1h"]
        if rsi_1h > 75:
            alerts.append({
                "type": "RSI",
                "message": "RSI overbought - potential reversal",
                "severity": "MEDIUM"
            })
        elif rsi_1h < 25:
            alerts.append({
                "type": "RSI", 
                "message": "RSI oversold - potential bounce",
                "severity": "HIGH"
            })
        
        # Fear & Greed alerts
        fg_index = self.market_data["fear_greed_index"]
        if fg_index > 80:
            alerts.append({
                "type": "SENTIMENT",
                "message": "Extreme greed - correction risk",
                "severity": "HIGH"
            })
        
        return alerts
    
    async def _monitor_market(self):
        """Continuous market monitoring"""
        while True:
            try:
                await self._update_market_analysis()
                await asyncio.sleep(15)  # Update every 15 seconds
            except Exception as e:
                logger.error(f"Market monitoring error: {e}")
                await asyncio.sleep(30)
    
    async def scan_market(self) -> dict:
        """Scan market for opportunities"""
        return await self.get_analysis()
    
    async def assess_market_conditions(self) -> dict:
        """Assess current market conditions"""
        return {
            "bullishness": self.market_data["fear_greed_index"] / 100,
            "volatility": self.market_data["volatility"] / 100,
            "trend_strength": self.market_data["trend_strength"] / 10,
            "sentiment": self.market_data["global_sentiment"]
        }
    
    def get_metrics(self) -> dict:
        """Get market intelligence metrics"""
        return {
            "market_cap": self.market_data["total_market_cap"],
            "sentiment": self.market_data["global_sentiment"],
            "fear_greed": self.market_data["fear_greed_index"],
            "trend_strength": self.market_data["trend_strength"],
            "last_update": self.last_update.isoformat()
        }
    
    async def shutdown(self):
        """Shutdown market intelligence"""
        logger.info("🛑 SHUTTING DOWN MARKET INTELLIGENCE...")
        logger.info("✅ MARKET INTELLIGENCE SHUTDOWN COMPLETE") 