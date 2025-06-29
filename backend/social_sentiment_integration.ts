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
    
    return [];
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