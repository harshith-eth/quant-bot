/**
 * Social Sentiment Integration for quant-bot
 * 
 * This file provides integration between the TypeScript-based trading engine
 * and the Python-based social sentiment analysis module.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as logger from './helpers/logger';

interface SentimentData {
  token: string;
  sentiment_score: number;
  sentiment_change: number;
  tweet_count: number;
  engagement_score: number;
  positive_ratio: number;
  top_tweets: Array<{
    text: string;
    username: string;
    likes: number;
    retweets: number;
    created_at: string;
  }>;
  last_update: string;
}

interface SentimentSignal {
  id: string;
  type: string;
  token: string;
  source: string;
  confidence: number;
  priority: string;
  reasoning: string;
  time_ago: string;
  created_at: Date;
}

export class SocialSentimentIntegration {
  private pythonProcess: any = null;
  private sentimentData: Map<string, SentimentData> = new Map();
  private sentimentSignals: SentimentSignal[] = [];
  private lastUpdate: Date = new Date();
  private isInitialized: boolean = false;
  private pythonScriptPath: string = path.join(__dirname, 'run_sentiment_analyzer.py');
  
  constructor() {
    // Create Python bridge script if it doesn't exist
    this.createPythonBridgeScript();
    logger.info('Social Sentiment Integration initialized');
  }
  
  private createPythonBridgeScript(): void {
    const scriptContent = `
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
`;
    
    fs.writeFileSync(this.pythonScriptPath, scriptContent);
  }
  
  public async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    
    try {
      this.pythonProcess = spawn('python', [this.pythonScriptPath]);
      
      this.pythonProcess.stdout.on('data', (data: Buffer) => {
        try {
          const output = data.toString().trim();
          if (output && output.startsWith('{')) {
            const jsonData = JSON.parse(output);
            this.handlePythonOutput(jsonData);
          }
        } catch (err) {
          logger.error(`Error parsing Python output: ${err}`);
        }
      });
      
      this.pythonProcess.stderr.on('data', (data: Buffer) => {
        logger.error(`Python error: ${data.toString()}`);
      });
      
      this.pythonProcess.on('close', (code: number) => {
        logger.info(`Python process exited with code ${code}`);
        this.isInitialized = false;
      });
      
      this.isInitialized = true;
      logger.info('Social sentiment analyzer initialized');
      return true;
    } catch (err) {
      logger.error(`Failed to initialize social sentiment: ${err}`);
      return false;
    }
  }
  
  private handlePythonOutput(data: any): void {
    if (Array.isArray(data) && data.length > 0 && data[0].source === 'SOCIAL_SENTIMENT') {
      // This is a signals response
      this.sentimentSignals = data;
      this.lastUpdate = new Date();
    } else if (data.token && data.sentiment_score !== undefined) {
      // This is a metrics response
      this.sentimentData.set(data.token, data as SentimentData);
      this.lastUpdate = new Date();
    } else if (data.trending_tokens) {
      // This is a trends response
      // Handle trends data
      this.lastUpdate = new Date();
    }
  }
  
  public async getSignals(): Promise<SentimentSignal[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.pythonProcess) {
      this.pythonProcess.stdin.write('get_signals\n');
      
      // Wait for the response to be processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return this.sentimentSignals;
    }
    
    // Return mock signals if Python process is not available
    return this.generateMockSignals();
  }
  
  private generateMockSignals(): SentimentSignal[] {
    const mockTokens = [
      { symbol: 'BONK', sentiment: 0.75, confidence: 0.85 },
      { symbol: 'WIF', sentiment: 0.62, confidence: 0.78 },
      { symbol: 'MYRO', sentiment: -0.23, confidence: 0.69 },
      { symbol: 'BOME', sentiment: 0.89, confidence: 0.92 },
      { symbol: 'SLERF', sentiment: -0.45, confidence: 0.73 }
    ];
    
    return mockTokens.map(token => ({
      id: `signal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: token.sentiment > 0.5 ? 'BUY' : token.sentiment < -0.3 ? 'SELL' : 'HOLD',
      token: token.symbol,
      source: 'SOCIAL_SENTIMENT',
      confidence: token.confidence,
      priority: token.confidence > 0.8 ? 'HIGH' : token.confidence > 0.6 ? 'MEDIUM' : 'LOW',
      reasoning: this.generateReasoning(token.sentiment, token.confidence),
      time_ago: this.getTimeAgo(new Date(Date.now() - Math.random() * 300000)), // Random time in last 5 minutes
      created_at: new Date()
    }));
  }
  
  private generateReasoning(sentiment: number, confidence: number): string {
    if (sentiment > 0.7) {
      return `Strong bullish sentiment detected. High engagement and positive mentions across social platforms. Confidence: ${(confidence * 100).toFixed(0)}%`;
    } else if (sentiment > 0.3) {
      return `Moderate bullish sentiment. Positive social media activity with increasing mentions. Confidence: ${(confidence * 100).toFixed(0)}%`;
    } else if (sentiment < -0.3) {
      return `Bearish sentiment detected. Negative social indicators and declining engagement. Confidence: ${(confidence * 100).toFixed(0)}%`;
    } else {
      return `Neutral sentiment. Mixed social signals with balanced positive and negative mentions. Confidence: ${(confidence * 100).toFixed(0)}%`;
    }
  }
  
  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  }
  
  public async getTokenMetrics(token: string): Promise<SentimentData | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.pythonProcess) {
      this.pythonProcess.stdin.write(`get_metrics:${token}\n`);
      
      // Wait for the response to be processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return this.sentimentData.get(token) || null;
    }
    
    return null;
  }
  
  public async getTrends(): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.pythonProcess) {
      this.pythonProcess.stdin.write('get_trends\n');
      
      // Wait for the response to be processed  
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return null;
  }
  
  public async shutdown(): Promise<void> {
    if (this.pythonProcess) {
      this.pythonProcess.stdin.write('exit\n');
      this.isInitialized = false;
    }
  }
}

// Export a singleton instance
export const socialSentiment = new SocialSentimentIntegration();