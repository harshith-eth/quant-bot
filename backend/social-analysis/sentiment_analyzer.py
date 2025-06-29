"""
SENTIMENT ANALYZER - REAL SIGNAL GENERATION
=========================================
Analyzes social media sentiment data to generate trading signals.

Features:
- Advanced NLP sentiment analysis using transformer models
- Multi-stage sentiment processing with Hugging Face API
- Fallback mechanisms with VADER and keyword-based analysis
- Social media trend detection and signal generation
- Confidence scoring for sentiment reliability
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import httpx
from core.config import settings
from .twitter_api import TwitterClient
from .nlp_sentiment import NLPSentimentAnalyzer

logger = logging.getLogger("SENTIMENT_ANALYZER")

class SentimentAnalyzer:
    """Analyzes social media sentiment for trading signals"""
    
    def __init__(self):
        self.twitter_client = TwitterClient()
        self.nlp_analyzer = NLPSentimentAnalyzer()
        if settings.HUGGINGFACE_API_KEY:
            self.nlp_analyzer.set_api_key(settings.HUGGINGFACE_API_KEY)
        
        self.sentiment_data = {}
        self.signals = []
        self.last_update = datetime.now()
        self.trend_analysis = {
            "trending_tokens": [],
            "sentiment_trends": {},
            "last_update": datetime.now()
        }
        
        logger.info("😊 SENTIMENT ANALYZER INITIALIZED with NLP capabilities")
    
    async def initialize(self):
        """Initialize sentiment analyzer"""
        logger.info("🚀 INITIALIZING SENTIMENT ANALYZER...")
        
        # Start continuous sentiment analysis
        asyncio.create_task(self._continuous_analysis())
        
        logger.info("✅ SENTIMENT ANALYZER ONLINE")
    
    async def _continuous_analysis(self):
        """Continuous sentiment analysis loop"""
        while True:
            try:
                # Update trending tokens analysis
                await self.update_trending_tokens()
                
                # Sleep for a while before next update
                await asyncio.sleep(60 * 10)  # Update every 10 minutes
            except Exception as e:
                logger.error(f"Continuous analysis error: {e}")
                await asyncio.sleep(60)
    
    async def update_trending_tokens(self):
        """Update trending tokens based on social media"""
        trending_tokens = await self.twitter_client.get_trending_tokens()
        
        # Only use if we have results
        if trending_tokens:
            self.trend_analysis["trending_tokens"] = trending_tokens
            self.trend_analysis["last_update"] = datetime.now()
            
            # Generate sentiment analysis for top 3 tokens
            for token in trending_tokens[:3]:
                symbol = token["symbol"]
                sentiment = await self.twitter_client.analyze_token_sentiment(symbol, symbol)
                
                # Store sentiment data
                self.sentiment_data[symbol] = sentiment
                
                # Track sentiment trends
                if symbol not in self.trend_analysis["sentiment_trends"]:
                    self.trend_analysis["sentiment_trends"][symbol] = []
                
                # Keep only the last 6 sentiment scores (1 hour of data)
                self.trend_analysis["sentiment_trends"][symbol].append({
                    "time": datetime.now().isoformat(),
                    "score": sentiment["sentiment_score"],
                    "tweets": sentiment["tweet_count"]
                })
                
                if len(self.trend_analysis["sentiment_trends"][symbol]) > 6:
                    self.trend_analysis["sentiment_trends"][symbol].pop(0)
    
    async def get_sentiment_data(self, token_symbol: str = None) -> Dict:
        """Get sentiment data for a specific token or all tokens"""
        if token_symbol:
            # If we don't have data for this token yet, fetch it
            if token_symbol not in self.sentiment_data:
                sentiment = await self.twitter_client.analyze_token_sentiment(token_symbol, token_symbol)
                self.sentiment_data[token_symbol] = sentiment
            return self.sentiment_data.get(token_symbol, {})
        else:
            # Return all sentiment data
            return self.sentiment_data
    
    async def get_sentiment_signals(self) -> List[Dict]:
        """Get trading signals based on social sentiment"""
        signals = []
        
        # Check for sentiment trends that might generate signals
        for symbol, trends in self.trend_analysis["sentiment_trends"].items():
            # Need at least 2 data points to detect trends
            if len(trends) < 2:
                continue
            
            # Calculate sentiment change
            current = trends[-1]["score"]
            previous = trends[0]["score"]
            change = current - previous
            
            # Get the sentiment confidence from the data if available
            sentiment_confidence = 0.7  # Default confidence level
            if symbol in self.sentiment_data and "confidence" in self.sentiment_data[symbol]:
                sentiment_confidence = self.sentiment_data[symbol]["confidence"]

            # Generate signals based on sentiment changes with adjusted confidence based on NLP analysis
            if change > 0.3:  # Significant positive change
                signals.append({
                    "id": f"SENT_{len(signals)+1:03d}",
                    "type": "BUY",
                    "token": f"${symbol}",
                    "source": "SOCIAL_SENTIMENT_NLP",
                    "confidence": min(95, 65 + int(change * 100) + int(sentiment_confidence * 20)),
                    "priority": "HIGH" if current > 0.5 and sentiment_confidence > 0.7 else "MEDIUM",
                    "reasoning": f"NLP detected positive sentiment surge on Twitter (+{change:.2f}, {int(sentiment_confidence * 100)}% confidence)",
                    "time_ago": "Just now",
                    "created_at": datetime.now()
                })
            elif change < -0.3:  # Significant negative change
                signals.append({
                    "id": f"SENT_{len(signals)+1:03d}",
                    "type": "SELL",
                    "token": f"${symbol}",
                    "source": "SOCIAL_SENTIMENT_NLP",
                    "confidence": min(95, 65 + int(abs(change) * 100) + int(sentiment_confidence * 20)),
                    "priority": "HIGH" if current < -0.3 and sentiment_confidence > 0.7 else "MEDIUM",
                    "reasoning": f"NLP detected negative sentiment spike on Twitter ({change:.2f}, {int(sentiment_confidence * 100)}% confidence)",
                    "time_ago": "Just now",
                    "created_at": datetime.now()
                })
            
            # Also check for high tweet count with positive sentiment, using NLP confidence
            tweet_count = trends[-1]["tweets"]
            if tweet_count > 50 and current > 0.3:
                # Get sentiment confidence
                sentiment_confidence = 0.7  # Default
                if symbol in self.sentiment_data and "confidence" in self.sentiment_data[symbol]:
                    sentiment_confidence = self.sentiment_data[symbol]["confidence"]
                    
                signals.append({
                    "id": f"SENT_{len(signals)+1:03d}",
                    "type": "MONITOR",
                    "token": f"${symbol}",
                    "source": "SOCIAL_SENTIMENT_NLP",
                    "confidence": min(95, 60 + int(tweet_count / 10) + int(sentiment_confidence * 20)),
                    "priority": "HIGH" if sentiment_confidence > 0.8 else "MEDIUM",
                    "reasoning": f"NLP detected high Twitter activity with positive sentiment ({tweet_count} tweets, {int(sentiment_confidence * 100)}% confidence)",
                    "time_ago": "Just now",
                    "created_at": datetime.now()
                })
        
        return signals
    
    def get_trend_analysis(self) -> Dict:
        """Get social media trend analysis"""
        return {
            "trending_tokens": self.trend_analysis["trending_tokens"],
            "sentiment_trends": {
                symbol: trends[-3:] for symbol, trends in self.trend_analysis["sentiment_trends"].items()
            },
            "last_update": self.trend_analysis["last_update"].isoformat()
        }
    
    async def get_social_metrics(self, token_symbol: str) -> Dict:
        """Get detailed social metrics for a specific token"""
        sentiment = await self.get_sentiment_data(token_symbol)
        
        # Get sentiment trend if available
        trend = self.trend_analysis["sentiment_trends"].get(token_symbol, [])
        sentiment_change = 0
        
        if len(trend) >= 2:
            sentiment_change = trend[-1]["score"] - trend[0]["score"]
        
        return {
            "token": token_symbol,
            "sentiment_score": sentiment.get("sentiment_score", 0),
            "sentiment_change": round(sentiment_change, 2),
            "tweet_count": sentiment.get("tweet_count", 0),
            "engagement_score": sentiment.get("engagement_score", 0),
            "positive_ratio": sentiment.get("positive_count", 0) / max(1, sentiment.get("tweet_count", 1)),
            "top_tweets": sentiment.get("top_tweets", []),
            "last_update": datetime.now().isoformat()
        }
    
    async def shutdown(self):
        """Shutdown sentiment analyzer"""
        logger.info("🛑 SHUTTING DOWN SENTIMENT ANALYZER...")
        logger.info("✅ SENTIMENT ANALYZER SHUTDOWN COMPLETE")