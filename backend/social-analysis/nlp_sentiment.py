"""
ADVANCED NLP-BASED SENTIMENT ANALYZER
====================================
Uses transformer-based NLP models for advanced sentiment analysis of tweets.
"""

import asyncio
import logging
import numpy as np
from typing import List, Dict, Union, Optional, Tuple
from datetime import datetime
import re
import httpx

# These models are commonly used for sentiment analysis
NLP_MODEL_ENDPOINT = "https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english"
FINBERT_ENDPOINT = "https://api-inference.huggingface.co/models/ProsusAI/finbert"

# For backup/fallback
VADER_AVAILABLE = False
try:
    from nltk.sentiment.vader import SentimentIntensityAnalyzer
    import nltk
    nltk.download('vader_lexicon', quiet=True)
    VADER_AVAILABLE = True
except ImportError:
    pass

logger = logging.getLogger("NLP_SENTIMENT")

class NLPSentimentAnalyzer:
    """Advanced NLP-based sentiment analyzer using transformers"""
    
    def __init__(self):
        self.http_client = httpx.AsyncClient(timeout=30.0)
        self.api_key = None
        self.cache = {}  # Simple cache to avoid re-analyzing the same text
        self.token_specific_keywords = self._load_token_specific_keywords()
        
        if VADER_AVAILABLE:
            self.vader = SentimentIntensityAnalyzer()
            # Add crypto-specific lexicon
            self._update_vader_lexicon()
        
        logger.info("🧠 NLP Sentiment Analyzer initialized")
    
    def _load_token_specific_keywords(self) -> Dict[str, Dict[str, float]]:
        """Load token-specific sentiment keywords and their weights"""
        # This could be loaded from a config file or database in a real implementation
        return {
            "general": {
                # Positive crypto terms with weights
                "moon": 0.8,
                "hodl": 0.6,
                "gem": 0.7, 
                "bullish": 0.9,
                "undervalued": 0.7,
                "100x": 0.8,
                "1000x": 0.9,
                "pump": 0.5,
                "hold": 0.4,
                "buy": 0.3,
                "long": 0.5,
                "green": 0.2,
                "gains": 0.6,
                "profit": 0.6,
                "support": 0.4,
                "breakout": 0.6,
                "potential": 0.4,
                "opportunity": 0.4,
                
                # Negative crypto terms with weights
                "dump": -0.6,
                "sell": -0.3,
                "short": -0.4,
                "bearish": -0.8,
                "rug": -0.9,
                "scam": -0.9,
                "ponzi": -0.9,
                "avoid": -0.7,
                "crash": -0.7,
                "red": -0.2,
                "loss": -0.5,
                "dip": -0.3,
                "dead": -0.6,
                "worthless": -0.8,
                "overvalued": -0.7,
                "fud": -0.5,
                "collapse": -0.7,
                "shitcoin": -0.9
            },
            # Token-specific keywords can be added here
            "BONK": {
                "good dog": 0.7,
                "woof": 0.6
            },
            "SAMO": {
                "good boy": 0.7,
                "best dog": 0.8
            }
        }
    
    def _update_vader_lexicon(self):
        """Update VADER lexicon with crypto-specific terms"""
        if not VADER_AVAILABLE:
            return
            
        # Add crypto-specific terms to VADER lexicon
        crypto_lexicon = {
            "moon": 4.0,
            "mooning": 4.0,
            "hodl": 3.0,
            "gem": 3.5,
            "bullish": 3.8,
            "100x": 4.0,
            "1000x": 4.5,
            "dump": -3.0,
            "dumping": -3.0,
            "rug": -4.5,
            "rugpull": -5.0,
            "scam": -4.5,
            "ponzi": -4.5,
            "fud": -3.0,
        }
        
        self.vader.lexicon.update(crypto_lexicon)
    
    def set_api_key(self, key: str):
        """Set the API key for the Hugging Face Inference API"""
        self.api_key = key
    
    async def analyze_text(self, text: str, token_symbol: str = None) -> Dict[str, float]:
        """
        Analyze text using multiple NLP approaches
        
        Returns:
            Dict with sentiment scores:
            - score: Overall sentiment score (-1 to 1)
            - confidence: Confidence in the sentiment score (0 to 1)
            - polarity: Positive, neutral, or negative classification
            - transformer_score: Score from transformer model if available
            - vader_score: Score from VADER if available
            - keyword_score: Score from keyword analysis if available
        """
        # Check cache
        cache_key = f"{text[:100]}_{token_symbol or 'general'}"
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        # Preprocess text
        clean_text = self._preprocess_text(text)
        
        # Use multiple approaches and combine the results
        results = {}
        
        # 1. Try transformer-based model (most accurate but can fail or be slow)
        transformer_result = await self._analyze_with_transformer(clean_text, token_symbol)
        results["transformer_score"] = transformer_result.get("score", 0)
        
        # 2. Try VADER (faster fallback)
        vader_result = self._analyze_with_vader(clean_text, token_symbol)
        results["vader_score"] = vader_result.get("score", 0)
        
        # 3. Use keyword-based approach (always works as final fallback)
        keyword_result = self._analyze_with_keywords(clean_text, token_symbol)
        results["keyword_score"] = keyword_result.get("score", 0)
        
        # Combine scores with weighted average
        available_scores = []
        weights = []
        
        if "transformer_score" in results and results["transformer_score"] != 0:
            available_scores.append(results["transformer_score"])
            weights.append(0.6)  # Weight transformer results higher
        
        if "vader_score" in results and results["vader_score"] != 0:
            available_scores.append(results["vader_score"])
            weights.append(0.3)
        
        if "keyword_score" in results and results["keyword_score"] != 0:
            available_scores.append(results["keyword_score"])
            weights.append(0.1)
        
        # Handle edge case with no valid scores
        if not available_scores:
            results["score"] = 0
            results["confidence"] = 0
        else:
            # Normalize weights
            total_weight = sum(weights)
            normalized_weights = [w / total_weight for w in weights]
            
            # Calculate weighted average
            results["score"] = sum(score * weight for score, weight in zip(available_scores, normalized_weights))
            
            # Calculate confidence based on agreement between methods
            if len(available_scores) > 1:
                variance = np.var(available_scores)
                results["confidence"] = max(0, min(1, 1 - (variance * 2)))  # Lower variance = higher confidence
            else:
                results["confidence"] = 0.6  # Medium confidence with only one method
        
        # Determine polarity label
        if results["score"] > 0.2:
            results["polarity"] = "positive"
        elif results["score"] < -0.2:
            results["polarity"] = "negative"
        else:
            results["polarity"] = "neutral"
        
        # Round score to 2 decimal places
        results["score"] = round(results["score"], 2)
        results["confidence"] = round(results["confidence"], 2)
        
        # Cache the result
        self.cache[cache_key] = results
        return results
    
    async def _analyze_with_transformer(self, text: str, token_symbol: str = None) -> Dict[str, float]:
        """Use transformer models for sentiment analysis"""
        # If text is too long, truncate it to avoid token limits
        if len(text) > 512:
            text = text[:512]
        
        try:
            headers = {}
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
            
            # Try finBERT first for financial/crypto text if token is specified
            if token_symbol:
                try:
                    response = await self.http_client.post(
                        FINBERT_ENDPOINT,
                        json={"inputs": text},
                        headers=headers,
                        timeout=10.0
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        if isinstance(result, list) and len(result) > 0:
                            # Extract sentiment scores - finBERT has positive, negative, neutral classes
                            sentiment_data = result[0]
                            scores = {item["label"]: item["score"] for item in sentiment_data}
                            
                            # Convert to -1 to 1 scale
                            positive = scores.get("positive", 0)
                            negative = scores.get("negative", 0)
                            
                            # Calculate final score from -1 to 1
                            score = positive - negative
                            return {"score": score, "model": "finbert"}
                except Exception as e:
                    logger.warning(f"FinBERT analysis failed: {str(e)}")
            
            # Fallback to general sentiment model
            response = await self.http_client.post(
                NLP_MODEL_ENDPOINT,
                json={"inputs": text},
                headers=headers,
                timeout=10.0
            )
            
            if response.status_code == 200:
                result = response.json()
                if isinstance(result, list) and len(result) > 0:
                    # Extract sentiment scores
                    sentiment_data = result[0]
                    scores = {item["label"]: item["score"] for item in sentiment_data}
                    
                    # Most models use POSITIVE/NEGATIVE or LABEL_0/LABEL_1
                    positive = scores.get("POSITIVE", scores.get("LABEL_1", 0))
                    negative = scores.get("NEGATIVE", scores.get("LABEL_0", 0))
                    
                    # Calculate final score from -1 to 1
                    score = positive - negative
                    return {"score": score, "model": "transformer"}
                    
            return {"score": 0, "model": "none"}
        
        except Exception as e:
            logger.warning(f"Transformer analysis failed: {str(e)}")
            return {"score": 0, "model": "none"}
    
    def _analyze_with_vader(self, text: str, token_symbol: str = None) -> Dict[str, float]:
        """Use VADER for sentiment analysis - fast rule-based approach"""
        if not VADER_AVAILABLE:
            return {"score": 0, "model": "none"}
        
        try:
            # Get VADER sentiment
            sentiment = self.vader.polarity_scores(text)
            
            # VADER compound score is from -1 to 1
            return {
                "score": sentiment["compound"],
                "model": "vader"
            }
        except Exception as e:
            logger.warning(f"VADER analysis failed: {str(e)}")
            return {"score": 0, "model": "none"}
    
    def _analyze_with_keywords(self, text: str, token_symbol: str = None) -> Dict[str, float]:
        """Use keyword-based approach for sentiment analysis"""
        text = text.lower()
        
        # Get general keywords
        keywords = self.token_specific_keywords["general"].copy()
        
        # Add token-specific keywords if available
        if token_symbol and token_symbol in self.token_specific_keywords:
            keywords.update(self.token_specific_keywords[token_symbol])
        
        # Count keyword occurrences and their sentiment values
        sentiment_values = []
        for keyword, weight in keywords.items():
            count = text.count(keyword)
            if count > 0:
                sentiment_values.extend([weight] * count)
        
        # Calculate average sentiment if keywords found
        if sentiment_values:
            avg_sentiment = sum(sentiment_values) / len(sentiment_values)
            # Normalize to -1 to 1
            score = max(-1, min(1, avg_sentiment))
            return {"score": score, "model": "keyword"}
        
        return {"score": 0, "model": "none"}
    
    def _preprocess_text(self, text: str) -> str:
        """Preprocess text to improve analysis quality"""
        # Convert to lowercase
        text = text.lower()
        
        # Remove URLs
        text = re.sub(r'https?://\S+|www\.\S+', '', text)
        
        # Remove mentions (@username)
        text = re.sub(r'@\w+', '', text)
        
        # Remove hashtags but keep the words
        text = re.sub(r'#(\w+)', r'\1', text)
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
    
    async def analyze_tweets(self, tweets: List[Dict], token_symbol: str = None) -> Dict:
        """
        Analyze a list of tweets using NLP techniques
        
        Args:
            tweets: List of tweet objects
            token_symbol: Crypto token symbol for token-specific analysis
            
        Returns:
            Dict with:
            - sentiment_score: Overall sentiment score (-1 to 1)
            - positive_count: Number of positive tweets
            - negative_count: Number of negative tweets
            - neutral_count: Number of neutral tweets
            - confidence: Overall confidence in the analysis (0 to 1)
        """
        if not tweets:
            return {
                "tweet_count": 0,
                "sentiment_score": 0.0,
                "negative_count": 0,
                "neutral_count": 0, 
                "positive_count": 0,
                "confidence": 0.0
            }
        
        # Analyze each tweet concurrently
        analysis_tasks = []
        for tweet in tweets:
            text = tweet.get("text", "")
            analysis_tasks.append(self.analyze_text(text, token_symbol))
        
        # Wait for all analyses to complete
        results = await asyncio.gather(*analysis_tasks)
        
        # Count sentiment categories
        positive_count = sum(1 for r in results if r["polarity"] == "positive")
        negative_count = sum(1 for r in results if r["polarity"] == "negative") 
        neutral_count = sum(1 for r in results if r["polarity"] == "neutral")
        
        # Calculate average sentiment score and confidence
        sentiment_scores = [r["score"] for r in results]
        confidence_scores = [r["confidence"] for r in results]
        
        # Weighted sentiment score based on confidence
        if sentiment_scores and confidence_scores:
            weighted_scores = [s * c for s, c in zip(sentiment_scores, confidence_scores)]
            total_confidence = sum(confidence_scores)
            
            if total_confidence > 0:
                overall_sentiment = sum(weighted_scores) / total_confidence
                average_confidence = total_confidence / len(confidence_scores)
            else:
                overall_sentiment = 0
                average_confidence = 0
        else:
            overall_sentiment = 0
            average_confidence = 0
        
        return {
            "tweet_count": len(tweets),
            "sentiment_score": round(overall_sentiment, 2),
            "negative_count": negative_count,
            "neutral_count": neutral_count,
            "positive_count": positive_count,
            "confidence": round(average_confidence, 2)
        }