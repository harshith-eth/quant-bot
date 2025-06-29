"""
Test script for NLP sentiment analyzer
====================================
Run this script to test the NLP sentiment analyzer functionality
"""

import asyncio
import os
import json
from nlp_sentiment import NLPSentimentAnalyzer

# Sample tweets for testing
sample_tweets = [
    {"text": "This $BONK token is going to the moon! Just bought a big bag. Bullish AF! 🚀🚀🚀"},
    {"text": "Avoid $SCAM at all costs. Looks like another rug pull in the making. Devs are anonymous."},
    {"text": "Interesting project, not sure if it's worth investing in yet. Waiting for more info."},
    {"text": "Just made 10x on $GEM overnight! This is just the beginning, get in now!"},
    {"text": "$DUMP is crashing hard. Liquidity being pulled. GET OUT NOW!!!"},
]

async def test_nlp_analyzer():
    """Test the NLP sentiment analyzer with sample tweets"""
    print("🧠 Testing NLP Sentiment Analyzer")
    print("=" * 50)
    
    # Initialize the analyzer
    analyzer = NLPSentimentAnalyzer()
    
    # Set API key if available
    api_key = os.environ.get("HUGGINGFACE_API_KEY")
    if api_key:
        print("✅ Hugging Face API key found")
        analyzer.set_api_key(api_key)
    else:
        print("⚠️ No Hugging Face API key found. Will use fallback methods.")
    
    # Test individual tweet analysis
    print("\n📝 Testing individual tweet analysis:")
    for i, tweet in enumerate(sample_tweets, 1):
        print(f"\nTweet {i}: {tweet['text'][:50]}...")
        result = await analyzer.analyze_text(tweet["text"])
        print(f"  Sentiment score: {result['score']} ({result['polarity']})")
        print(f"  Confidence: {result['confidence']}")
        if "transformer_score" in result:
            print(f"  Transformer score: {result.get('transformer_score', 'N/A')}")
        if "vader_score" in result:
            print(f"  VADER score: {result.get('vader_score', 'N/A')}")
        if "keyword_score" in result:
            print(f"  Keyword score: {result.get('keyword_score', 'N/A')}")
    
    # Test batch tweet analysis
    print("\n📊 Testing batch tweet analysis:")
    batch_result = await analyzer.analyze_tweets(sample_tweets)
    print(json.dumps(batch_result, indent=2))
    
    print("\n✅ Testing complete!")

if __name__ == "__main__":
    asyncio.run(test_nlp_analyzer())