"use client"

import { useState, useEffect } from "react"

interface TokenData {
  mint: string;
  name: string;
  symbol: string;
  marketCap: number;
  liquidity: number;
  buyRatio: number;
  sellRatio: number;
  holders: number;
  age: number;
  topWalletPercent: number;
  isLiquidityBurned: boolean;
  isContractSafe: boolean;
  isMintRenounced: boolean;
  isFreezable: boolean;
  score: number;
  createdAt: string;
  lastTradeAt: string;
  volume24h: number;
  priceChange24h: number;
}

interface WhaleTransaction {
  signature: string;
  wallet: string;
  fullWallet: string;
  action: 'Buy' | 'Sell' | 'Transfer';
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  amount: number;
  usdValue: number;
  impact: 'Low' | 'Medium' | 'High' | 'Critical';
  timestamp: string;
  blockTime: number;
  slot: number;
}

interface WhaleStats {
  totalVolume24h: number;
  totalMoves24h: number;
  buyPressure: number;
  sellPressure: number;
  topToken: string;
  avgTransactionSize: number;
}

interface MemeScannerStats {
  newTokensPerHour: number;
  verifiedPercentage: number;
  avgMarketCap: number;
  avgVolume: number;
  heat: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  blocksScanned: number;
  lastUpdate: string;
}

interface MarketMetrics {
  fomoIndex: number;
  retardStrengthIndex: number;
  paperHandsRatio: number;
  diamondHandsRatio: number;
  marketCycle: 'STEALTH' | 'FOMO' | 'MOON' | 'DUMP';
  nextCycleTime: number;
  fibonacciLevels: {
    retracements: { level: number; price: number; label: string }[];
    extensions: { level: number; price: number; label: string }[];
  };
}

export default function MarketAnalysis() {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [whaleTransactions, setWhaleTransactions] = useState<WhaleTransaction[]>([]);
  const [whaleStats, setWhaleStats] = useState<WhaleStats | null>(null);
  const [scannerStats, setScannerStats] = useState<MemeScannerStats | null>(null);
  const [solPrice, setSolPrice] = useState<number>(157.5);
  const [marketMetrics, setMarketMetrics] = useState<MarketMetrics | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch SOL price
  const fetchSolPrice = async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
      const data = await response.json();
      if (data.solana?.usd) {
        setSolPrice(data.solana.usd);
      }
    } catch (error) {
      console.error('Failed to fetch SOL price:', error);
    }
  };

  // Fetch all data
  const fetchData = async () => {
    try {
      const [tokensRes, whaleTransRes, whaleStatsRes, scannerStatsRes] = await Promise.all([
        fetch('http://localhost:8000/api/meme-scanner/tokens'),
        fetch('http://localhost:8000/api/whale-tracker/transactions'),
        fetch('http://localhost:8000/api/whale-tracker/stats'),
        fetch('http://localhost:8000/api/meme-scanner/stats')
      ]);

      if (tokensRes.ok) {
        const tokensData = await tokensRes.json();
        const tokens = Array.isArray(tokensData) ? tokensData : tokensData.tokens || [];
        setTokens(tokens);
      }

      if (whaleTransRes.ok) {
        const whaleData = await whaleTransRes.json();
        setWhaleTransactions(Array.isArray(whaleData) ? whaleData : whaleData.transactions || []);
      }

      if (whaleStatsRes.ok) {
        const statsData = await whaleStatsRes.json();
        setWhaleStats(statsData);
      }

      if (scannerStatsRes.ok) {
        const scannerData = await scannerStatsRes.json();
        setScannerStats(scannerData);
      }

      setIsConnected(true);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setIsConnected(false);
    }
  };

  // Calculate market metrics
  const calculateMarketMetrics = (): MarketMetrics => {
    if (!tokens.length || !whaleStats || !scannerStats) {
      return {
        fomoIndex: 50,
        retardStrengthIndex: 50,
        paperHandsRatio: -50,
        diamondHandsRatio: 50,
        marketCycle: 'STEALTH',
        nextCycleTime: 300,
        fibonacciLevels: {
          retracements: [],
          extensions: []
        }
      };
    }

    // FOMO Index Algorithm (0-100)
    const tokenCreationRate = Math.min(scannerStats.newTokensPerHour / 100, 1); // Normalize to 0-1
    const whaleActivity = Math.min(whaleStats.totalMoves24h / 50, 1); // Normalize to 0-1
    const avgPriceChange = tokens.reduce((sum, t) => sum + Math.max(t.priceChange24h, 0), 0) / tokens.length;
    const priceChangeFactor = Math.min(avgPriceChange / 100, 1); // Normalize to 0-1
    const heatFactor = { 'LOW': 0.2, 'MEDIUM': 0.5, 'HIGH': 0.8, 'EXTREME': 1.0 }[scannerStats.heat];
    
    const fomoIndex = Math.round((tokenCreationRate * 30 + whaleActivity * 25 + priceChangeFactor * 25 + heatFactor * 20) * 100);

    // Retard Strength Index (0-100) - Based on buy pressure and momentum
    const avgBuyRatio = tokens.reduce((sum, t) => {
      const ratio = t.sellRatio > 0 ? t.buyRatio / t.sellRatio : t.buyRatio;
      return sum + Math.min(ratio, 10); // Cap at 10:1
    }, 0) / tokens.length;
    const buyPressureFactor = Math.min(whaleStats.buyPressure / 100, 1);
    const volumeFactor = Math.min(scannerStats.avgVolume / 50000, 1); // Normalize to $50K
    
    const retardStrengthIndex = Math.round((avgBuyRatio / 10 * 40 + buyPressureFactor * 35 + volumeFactor * 25) * 100);

    // Paper Hands vs Diamond Hands
    const sellPressure = whaleStats.sellPressure;
    const paperHandsRatio = Math.round(sellPressure - 50); // -50 to +50
    const diamondHandsRatio = Math.round(whaleStats.buyPressure - 50); // -50 to +50

    // Market Cycle Detection
    let marketCycle: 'STEALTH' | 'FOMO' | 'MOON' | 'DUMP' = 'STEALTH';
    let nextCycleTime = 300; // 5 minutes default

    if (fomoIndex >= 80 && retardStrengthIndex >= 70) {
      marketCycle = 'MOON';
      nextCycleTime = 120; // 2 minutes to dump
    } else if (fomoIndex >= 60 && retardStrengthIndex >= 50) {
      marketCycle = 'FOMO';
      nextCycleTime = 180; // 3 minutes to moon
    } else if (fomoIndex < 30 || retardStrengthIndex < 30) {
      marketCycle = 'DUMP';
      nextCycleTime = 600; // 10 minutes to stealth
    } else {
      marketCycle = 'STEALTH';
      nextCycleTime = 240; // 4 minutes to fomo
    }

    // Fibonacci Levels based on SOL price
    const currentPrice = solPrice;
    const high = currentPrice * 1.15; // Assume 15% recent high
    const low = currentPrice * 0.85; // Assume 15% recent low
    const range = high - low;

    const fibonacciLevels = {
      retracements: [
        { level: 1.000, price: high, label: '1.000' },
        { level: 0.786, price: high - (range * 0.786), label: '0.786' },
        { level: 0.618, price: high - (range * 0.618), label: '0.618' },
        { level: 0.500, price: high - (range * 0.500), label: '0.500' },
        { level: 0.382, price: high - (range * 0.382), label: '0.382' },
        { level: 0.236, price: high - (range * 0.236), label: '0.236' },
        { level: 0.000, price: low, label: '0.000' }
      ],
      extensions: [
        { level: 1.618, price: low + (range * 1.618), label: '1.618' },
        { level: 2.618, price: low + (range * 2.618), label: '2.618' },
        { level: 4.236, price: low + (range * 4.236), label: '4.236' }
      ]
    };

    return {
      fomoIndex: Math.min(fomoIndex, 100),
      retardStrengthIndex: Math.min(retardStrengthIndex, 100),
      paperHandsRatio,
      diamondHandsRatio,
      marketCycle,
      nextCycleTime,
      fibonacciLevels
    };
  };

  // Get top performing tokens for money flow
  const getTopTokens = () => {
    return tokens
      .filter(t => t.priceChange24h !== 0)
      .sort((a, b) => b.priceChange24h - a.priceChange24h)
      .slice(0, 4)
      .map(token => ({
        symbol: token.symbol,
        change: token.priceChange24h,
        isPositive: token.priceChange24h > 0
      }));
  };

  useEffect(() => {
    fetchSolPrice();
    fetchData();
    
    const interval = setInterval(() => {
      fetchData();
    }, 5000); // Update every 5 seconds

    const priceInterval = setInterval(() => {
      fetchSolPrice();
    }, 30000); // Update SOL price every 30 seconds

    return () => {
      clearInterval(interval);
      clearInterval(priceInterval);
    };
  }, []);

  useEffect(() => {
    if (tokens.length && whaleStats && scannerStats) {
      setMarketMetrics(calculateMarketMetrics());
    }
  }, [tokens, whaleStats, scannerStats, solPrice]);

  const topTokens = getTopTokens();
  const metrics = marketMetrics || calculateMarketMetrics();

  return (
    <div className="border border-green-500 bg-black h-full overflow-hidden relative">
      <h2 className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-green-900/50 to-green-800/30 border-b border-green-500 px-2 py-0.5 text-xs font-normal flex justify-between items-center">
        <span>MARKET ANALYSIS</span>
        <div className="flex items-center gap-2 text-xs">
          <span className={`font-mono ${metrics.fomoIndex >= 80 ? 'text-red-500' : metrics.fomoIndex >= 60 ? 'text-yellow-500' : 'text-green-500'}`}>
            FOMO: {metrics.fomoIndex}%
          </span>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </h2>

      <div className="absolute top-6 left-0 right-0 bottom-0 overflow-y-auto p-2 bg-green-500/5 scrollbar-hide">
        <div className="space-y-3">
          {/* Money Flow Heatmap */}
          <div className="bg-black/30 border border-green-500/10 p-1">
            <div className="text-green-500 text-xs mb-1 flex items-center gap-1">🤑 DEGEN MONEY FLOW</div>
            <div className="grid grid-cols-4 gap-1">
              {topTokens.length > 0 ? topTokens.map((token, index) => (
                <div key={index} className={`${token.isPositive ? 'bg-green-500/20' : 'bg-red-500/20'} p-1 text-center`}>
                  <div className="text-xs">{token.symbol}</div>
                  <div className={`${token.isPositive ? 'text-green-500' : 'text-red-500'} font-bold text-xs`}>
                    {token.change > 0 ? '+' : ''}{token.change.toFixed(0)}%
                  </div>
                </div>
              )) : (
                // Fallback data while loading
                ['PEPE', 'WOJAK', 'CHAD', 'ELON'].map((symbol, index) => (
                  <div key={index} className="bg-gray-500/20 p-1 text-center">
                    <div className="text-xs">{symbol}</div>
                    <div className="text-gray-500 font-bold text-xs">--</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Retard Strength Index */}
          <div className="bg-black/30 border border-green-500/10 p-2">
            <div className="text-green-500 text-xs mb-2 flex items-center gap-1">🦍 RETARD STRENGTH INDEX</div>
            <div className="mb-2">
              <div className="h-2 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 relative">
                <div 
                  className="absolute top-0 w-1 h-full bg-white"
                  style={{ left: `${metrics.retardStrengthIndex}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span>WEAK</span>
                <span>HODL</span>
                <span>STRONG</span>
                <span className="text-green-500 font-bold">RETARDED</span>
              </div>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Paper Hands Ratio:</span>
                <span className={metrics.paperHandsRatio < 0 ? 'text-green-500' : 'text-red-500'}>
                  {metrics.paperHandsRatio > 0 ? '+' : ''}{metrics.paperHandsRatio}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Diamond Hands:</span>
                <span className={metrics.diamondHandsRatio > 0 ? 'text-green-500' : 'text-red-500'}>
                  {metrics.diamondHandsRatio > 0 ? '+' : ''}{metrics.diamondHandsRatio}%
                </span>
              </div>
            </div>
          </div>

          {/* Market Cycle */}
          <div className="bg-black/30 border border-green-500/10 p-2">
            <div className="text-green-500 text-xs mb-2 flex items-center gap-1">🌊 MARKET CYCLE</div>
            <div className="flex justify-between items-center mb-2">
              <div className="text-center">
                <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${metrics.marketCycle === 'STEALTH' ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></div>
                <div className="text-xs">STEALTH</div>
                <div className="text-xs text-green-500">+10x</div>
              </div>
              <div className="text-center">
                <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${metrics.marketCycle === 'FOMO' ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></div>
                <div className="text-xs">FOMO</div>
                <div className="text-xs text-green-500">+50x</div>
              </div>
              <div className="text-center">
                <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${metrics.marketCycle === 'MOON' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-600'}`}></div>
                <div className="text-xs">MOON</div>
                <div className="text-xs text-green-500">+100x</div>
              </div>
              <div className="text-center">
                <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${metrics.marketCycle === 'DUMP' ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`}></div>
                <div className="text-xs">DUMP</div>
                <div className="text-xs text-red-500">-90%</div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-green-500 font-bold animate-pulse">
                NEXT: {metrics.marketCycle === 'STEALTH' ? 'FOMO' : 
                       metrics.marketCycle === 'FOMO' ? 'MOON' : 
                       metrics.marketCycle === 'MOON' ? 'DUMP' : 'STEALTH'}
              </div>
              <div className="text-xs text-yellow-500">
                ≈ {Math.floor(metrics.nextCycleTime / 60)}.{Math.floor((metrics.nextCycleTime % 60) / 6)} MINS
              </div>
            </div>
          </div>

          {/* Fibonacci Analysis */}
          <div className="bg-black/30 border border-green-500/10 p-2">
            <div className="text-green-500 text-xs mb-2 flex items-center gap-1">🌀 FIBONACCI QUANTUM MATRIX</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-green-600 mb-1">RETRACEMENT</div>
                <div className="space-y-0.5 text-xs">
                  {metrics.fibonacciLevels.retracements.slice(0, 4).map((level, index) => (
                    <div key={index} className={`flex justify-between ${
                      level.level === 0.618 ? 'text-yellow-500' : 
                      level.level === 0.500 ? 'text-green-500 font-bold' : ''
                    }`}>
                      <span>{level.label}</span>
                      <span>${level.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-green-600 mb-1">EXTENSION</div>
                <div className="space-y-0.5 text-xs">
                  {metrics.fibonacciLevels.extensions.map((level, index) => (
                    <div key={index} className={`flex justify-between ${
                      level.level === 1.618 ? 'text-cyan-500' : ''
                    }`}>
                      <span>{level.label}</span>
                      <span>${level.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
