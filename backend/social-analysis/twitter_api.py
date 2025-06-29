"""
TWITTER API CLIENT - REAL-TIME SOCIAL SIGNALS
============================================
Connects to the Twitter/X API to gather social sentiment data.

Features:
- Real-time tweet analysis for crypto tokens
- Advanced NLP-based sentiment analysis
- Multi-tier sentiment processing:
  1. Transformer models (Hugging Face API)
  2. VADER sentiment analysis
  3. Keyword-based fallback analysis
- Confidence scoring for sentiment reliability
- Engagement metrics calculation
- Top tweet identification and ranking
"""

import asyncio
import logging
import httpx
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Union
from core.config import settings
from .nlp_sentiment import NLPSentimentAnalyzer

logger = logging.getLogger("TWITTER_API")

class TwitterClient:
    """Client for Twitter/X API integration"""
    
    def __init__(self):
        self.bearer_token = settings.TWITTER_BEARER_TOKEN
        if not self.bearer_token:
            logger.warning("⚠️ No Twitter bearer token found. Twitter analysis will be disabled.")
            self.enabled = False
        else:
            self.enabled = True
            
        self.http_client = httpx.AsyncClient()
        self.base_url = "https://api.twitter.com/2"
        self.cache = {}
        self.cache_expiry = {}
        self.cache_duration = timedelta(minutes=15)  # Cache results for 15 minutes
        
        # Initialize NLP sentiment analyzer
        self.nlp_analyzer = NLPSentimentAnalyzer()
        if settings.HUGGINGFACE_API_KEY:
            self.nlp_analyzer.set_api_key(settings.HUGGINGFACE_API_KEY)
        
        logger.info("🐦 TWITTER API CLIENT INITIALIZED")
    
    def _get_auth_headers(self) -> Dict[str, str]:
        """Get authentication headers for Twitter API"""
        return {
            "Authorization": f"Bearer {self.bearer_token}"
        }
    
    async def search_recent_tweets(self, query: str, max_results: int = 100) -> Optional[Dict]:
        """Search for recent tweets matching the query"""
        if not self.enabled:
            logger.warning("⚠️ Twitter API disabled - no bearer token")
            return None
            
        # Check cache first
        cache_key = f"search:{query}:{max_results}"
        if cache_key in self.cache and datetime.now() < self.cache_expiry.get(cache_key, datetime.min):
            logger.info(f"🔄 Using cached Twitter results for '{query}'")
            return self.cache[cache_key]
        
        try:
            # Twitter v2 API endpoint for searching recent tweets
            endpoint = f"{self.base_url}/tweets/search/recent"
            
            # Parameters for the search
            params = {
                "query": query,
                "max_results": max_results,
                "tweet.fields": "created_at,public_metrics,entities",
                "expansions": "author_id",
                "user.fields": "username,public_metrics"
            }
            
            # Make the API request
            response = await self.http_client.get(
                endpoint, 
                params=params,
                headers=self._get_auth_headers(),
                timeout=10.0
            )
            
            # Check if the request was successful
            if response.status_code == 200:
                data = response.json()
                
                # Cache the result
                self.cache[cache_key] = data
                self.cache_expiry[cache_key] = datetime.now() + self.cache_duration
                
                logger.info(f"✅ Successfully fetched {len(data.get('data', []))} tweets for '{query}'")
                return data
            else:
                logger.error(f"❌ Twitter API error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Twitter search error: {str(e)}")
            return None
    
    async def analyze_token_sentiment(self, token_name: str, symbol: str) -> Dict[str, Union[float, int, List]]:
        """Analyze sentiment for a specific token using advanced NLP techniques"""
        # Build search query with token name and symbol
        query = f"({token_name} OR {symbol}) (crypto OR token OR sol OR solana) -is:retweet"
        
        # Get recent tweets
        tweets_data = await self.search_recent_tweets(query, max_results=100)
        
        if not tweets_data or "data" not in tweets_data:
            logger.warning(f"⚠️ No tweets found for {token_name} ({symbol})")
            return {
                "tweet_count": 0,
                "sentiment_score": 0.0,
                "negative_count": 0,
                "neutral_count": 0,
                "positive_count": 0,
                "engagement_score": 0.0,
                "confidence": 0.0,
                "top_tweets": []
            }
        
        tweets = tweets_data.get("data", [])
        users = {user["id"]: user for user in tweets_data.get("includes", {}).get("users", [])}
        
        # Calculate engagement metrics
        total_likes = 0
        total_retweets = 0
        total_replies = 0
        
        # Process engagement metrics for each tweet
        for tweet in tweets:
            metrics = tweet.get("public_metrics", {})
            likes = metrics.get("like_count", 0)
            retweets = metrics.get("retweet_count", 0)
            replies = metrics.get("reply_count", 0)
            
            total_likes += likes
            total_retweets += retweets
            total_replies += replies
        
        # Use advanced NLP sentiment analysis
        logger.info(f"🧠 Running advanced NLP sentiment analysis on {len(tweets)} tweets for {symbol}")
        formatted_tweets = [{"text": tweet.get("text", "")} for tweet in tweets]
        
        # Get sentiment analysis results using the NLP analyzer
        nlp_results = await self.nlp_analyzer.analyze_tweets(formatted_tweets, symbol)
        
        # Calculate engagement score
        total_tweets = len(tweets)
        engagement_score = (total_likes * 1 + total_retweets * 2 + total_replies * 0.5) / total_tweets if total_tweets > 0 else 0
        
        # Get top 5 tweets by engagement
        top_tweets = sorted(
            tweets, 
            key=lambda t: t.get("public_metrics", {}).get("like_count", 0) + 
                 t.get("public_metrics", {}).get("retweet_count", 0) * 2,
            reverse=True
        )[:5]
        
        # Format top tweets for display
        formatted_top_tweets = []
        for tweet in top_tweets:
            user_id = tweet.get("author_id", "")
            username = users.get(user_id, {}).get("username", "unknown")
            metrics = tweet.get("public_metrics", {})
            
            formatted_top_tweets.append({
                "text": tweet.get("text", ""),
                "username": f"@{username}",
                "likes": metrics.get("like_count", 0),
                "retweets": metrics.get("retweet_count", 0),
                "created_at": tweet.get("created_at", "")
            })
        
        return {
            "tweet_count": nlp_results["tweet_count"],
            "sentiment_score": nlp_results["sentiment_score"],
            "negative_count": nlp_results["negative_count"],
            "neutral_count": nlp_results["neutral_count"],
            "positive_count": nlp_results["positive_count"],
            "engagement_score": round(engagement_score, 2),
            "confidence": nlp_results["confidence"],
            "top_tweets": formatted_top_tweets
        }
    
    async def get_trending_tokens(self) -> List[Dict]:
        """Get trending tokens based on Twitter activity"""
        # Define common crypto and meme coin terms to search for
        search_terms = ["solana memecoin", "sol memecoin", "crypto meme", "solana gem", "sol token"]
        
        all_results = []
        for term in search_terms:
            tweets_data = await self.search_recent_tweets(term, max_results=50)
            if tweets_data and "data" in tweets_data:
                all_results.extend(tweets_data["data"])
        
        # Extract potential token symbols
        # Tokens often mentioned with $ or in hashtags
        token_mentions = {}
        
        for tweet in all_results:
            text = tweet["text"].upper()
            
            # Look for $SYMBOL pattern
            dollar_matches = [word for word in text.split() if word.startswith("$") and len(word) <= 6 and len(word) > 1]
            
            # Look for hashtags that might be tokens
            hashtags = tweet.get("entities", {}).get("hashtags", [])
            hashtag_texts = [tag["tag"].upper() for tag in hashtags if len(tag["tag"]) <= 5]
            
            # Count mentions
            for token in dollar_matches + hashtags:
                clean_token = token.replace("$", "").replace("#", "")
                if 2 <= len(clean_token) <= 5:  # Most meme tokens are 2-5 chars
                    token_mentions[clean_token] = token_mentions.get(clean_token, 0) + 1
        
        # Filter out common words that aren't tokens
        common_words = ["THE", "AND", "FOR", "THIS", "THAT", "WITH", "HAVE", "WILL"]
        for word in common_words:
            if word in token_mentions:
                del token_mentions[word]
        
        # Sort by mentions and return top 10
        sorted_tokens = sorted(token_mentions.items(), key=lambda x: x[1], reverse=True)
        
        # Format the response
        return [
            {"symbol": token, "mentions": count}
            for token, count in sorted_tokens[:10]
        ]
    
    async def clear_cache(self):
        """Clear the Twitter data cache"""
        self.cache = {}
        self.cache_expiry = {}