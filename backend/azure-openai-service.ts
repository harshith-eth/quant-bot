import axios from 'axios';
import { logger } from './helpers';

export interface SignalData {
  type: 'market_scanner' | 'whale_activity' | 'risk_management' | 'portfolio' | 'trade_execution';
  rawData: any;
  timestamp: Date;
}

export interface HumanReadableSignal {
  timestamp: string;
  message: string;
  type: 'normal' | 'alert' | 'emergency';
  category: 'Market Scanner' | 'Whale Tracker' | 'Social Signals' | 'Trade Signals' | 'Risk Alerts';
}

export class AzureOpenAIService {
  private apiKey: string;
  private endpoint: string;
  private deployment: string;

  constructor() {
    this.apiKey = process.env.AZURE_OPENAI_API_KEY || '';
    this.endpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
    this.deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';

    if (!this.apiKey || !this.endpoint) {
      logger.warn('Azure OpenAI credentials not configured');
    }
  }

  async convertToHumanReadable(signalData: SignalData): Promise<HumanReadableSignal | null> {
    if (!this.apiKey || !this.endpoint) {
      return null;
    }

    try {
      const prompt = this.buildPrompt(signalData);
      
      const response = await axios.post(
        this.endpoint,
        {
          messages: [
            {
              role: 'system',
              content: `You are a crypto trading signal converter. Convert raw trading data into short, punchy, human-readable signals for a trading bot dashboard. 

RULES:
- Keep messages VERY SHORT (max 2-3 lines)
- Use crypto slang and trading terminology
- Include key metrics (MC, LP, ratios, etc.)
- Use emojis for visual impact
- Classify urgency: normal, alert, emergency
- Format like: "TOKEN DETECTED • MC: $120K | LP: $25K • B/S Ratio: 5.2:1 • Contract: ✅ SAFU"

CATEGORIES:
- Market Scanner: New token launches, market cap changes
- Whale Tracker: Large transactions, wallet movements  
- Social Signals: Twitter/TG activity, sentiment
- Trade Signals: Entry/exit signals, P&L updates
- Risk Alerts: Rug warnings, liquidations

Return ONLY a JSON object with: timestamp, message, type, category`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 200,
          temperature: 0.7
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'api-key': this.apiKey
          },
          timeout: 5000
        }
      );

      const content = response.data.choices[0]?.message?.content;
      if (!content) {
        return null;
      }

      // Try to parse JSON response
      try {
        const parsed = JSON.parse(content);
        return {
          timestamp: this.formatTimestamp(signalData.timestamp),
          message: parsed.message || 'Signal processed',
          type: parsed.type || 'normal',
          category: parsed.category || this.getCategoryFromType(signalData.type)
        };
      } catch (parseError) {
        // If JSON parsing fails, create a basic signal
        return {
          timestamp: this.formatTimestamp(signalData.timestamp),
          message: content.substring(0, 100) + '...',
          type: 'normal',
          category: this.getCategoryFromType(signalData.type)
        };
      }

    } catch (error) {
      logger.error('Azure OpenAI API error:', error);
      return null;
    }
  }

  private buildPrompt(signalData: SignalData): string {
    const { type, rawData } = signalData;

    switch (type) {
      case 'market_scanner':
        if (rawData.type === 'TOKEN_ACTIVITY') {
          return `Convert this token activity data to a trading signal:
Active Tokens: ${rawData.tokenCount}
Activity Level: ${rawData.activity}
Score: ${rawData.score}/100`;
        }
        if (rawData.mint) {
          return `Convert this token transfer to a trading signal:
Token Mint: ${rawData.mint}
Amount: ${rawData.amount || 0}
Estimated Value: $${rawData.estimatedValue || 0}
Wallet: ${rawData.wallet || 'Unknown'}`;
        }
        return `Convert this meme token scanner data to a trading signal:
Token: ${rawData.symbol || 'Unknown'}
Market Cap: $${rawData.marketCap || 0}
Liquidity: $${rawData.liquidity || 0}
Buy/Sell Ratio: ${rawData.buyRatio || 0}:${rawData.sellRatio || 1}
Volume 24h: $${rawData.volume24h || 0}
Price Change: ${rawData.priceChange24h || 0}%
Score: ${rawData.score || 0}
Age: ${Math.floor((rawData.age || 0) / 60)} minutes
Contract Safe: ${rawData.isContractSafe ? 'Yes' : 'No'}
LP Burned: ${rawData.isLiquidityBurned ? 'Yes' : 'No'}`;

      case 'whale_activity':
        if (rawData.type === 'MARKET_MOMENTUM') {
          return `Convert this market momentum data to a trading signal:
Activity Count: ${rawData.activityCount} large transactions
Total Value: $${rawData.totalValue || 0}
Sentiment: ${rawData.sentiment}
Trend Score: ${rawData.trendScore}/100`;
        }
        return `Convert this whale transaction to a trading signal:
Action: ${rawData.action || 'Unknown'}
Amount: ${rawData.amount || 0} ${rawData.tokenSymbol || 'SOL'}
USD Value: $${rawData.usdValue || 0}
Token: ${rawData.tokenSymbol || 'SOL'}
Impact: ${rawData.impact || 'Low'}
Wallet: ${rawData.wallet || 'Unknown'}`;

      case 'risk_management':
        return `Convert this risk data to a trading alert:
VaR 95%: $${rawData.var95 || 0}
Risk Level: ${rawData.riskLevel || 0}
Rug Probability: ${rawData.rugDetection?.rugProbability || 0}/10
LP Removal Risk: ${rawData.rugDetection?.lpRemovalRisk || 'LOW'}
FOMO Level: ${rawData.alphaSignals?.fomoLevel || 'LOW'}
Degen Score: ${rawData.alphaSignals?.degenScore || 0}/10`;

      case 'portfolio':
        return `Convert this portfolio update to a signal:
Total Balance: $${rawData.totalBalance || 0}
Day P&L: ${rawData.dayProfitPercent || 0}%
Win Rate: ${rawData.winRate || 0}%
Active Positions: ${rawData.activePositions || 0}
Available Balance: $${rawData.availableBalance || 0}`;

      case 'trade_execution':
        return `Convert this trade execution to a signal:
Action: ${rawData.action || 'Unknown'}
Token: ${rawData.token || 'Unknown'}
Amount: $${rawData.amount || 0}
Price: $${rawData.price || 0}
Status: ${rawData.status || 'Unknown'}
P&L: ${rawData.pnl || 0}%`;

      default:
        return `Convert this trading data to a human-readable signal: ${JSON.stringify(rawData)}`;
    }
  }

  private getCategoryFromType(type: string): 'Market Scanner' | 'Whale Tracker' | 'Social Signals' | 'Trade Signals' | 'Risk Alerts' {
    switch (type) {
      case 'market_scanner': return 'Market Scanner';
      case 'whale_activity': return 'Whale Tracker';
      case 'risk_management': return 'Risk Alerts';
      case 'portfolio': return 'Trade Signals';
      case 'trade_execution': return 'Trade Signals';
      default: return 'Market Scanner';
    }
  }

  private formatTimestamp(date: Date): string {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  // Batch convert multiple signals
  async convertBatch(signals: SignalData[]): Promise<HumanReadableSignal[]> {
    const results = await Promise.allSettled(
      signals.map(signal => this.convertToHumanReadable(signal))
    );

    return results
      .filter((result): result is PromiseFulfilledResult<HumanReadableSignal> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value);
  }
} 