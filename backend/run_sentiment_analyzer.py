#!/usr/bin/env python3
"""
Bridge script between TypeScript and Python for social sentiment analysis
"""

import sys
import json
import asyncio
from social_analysis.sentiment_analyzer import SentimentAnalyzer

async def main():
    analyzer = SentimentAnalyzer()
    await analyzer.initialize()
    
    while True:
        command = input()
        parts = command.strip().split(':')
        
        if parts[0] == 'get_signals':
            signals = await analyzer.get_sentiment_signals()
            print(json.dumps(signals))
            sys.stdout.flush()
        elif parts[0] == 'get_metrics' and len(parts) > 1:
            token = parts[1]
            metrics = await analyzer.get_social_metrics(token)
            print(json.dumps(metrics))
            sys.stdout.flush()
        elif parts[0] == 'get_trends':
            trends = analyzer.get_trend_analysis()
            print(json.dumps(trends))
            sys.stdout.flush()
        elif parts[0] == 'exit':
            break
        
        await asyncio.sleep(0.1)

if __name__ == "__main__":
    asyncio.run(main())