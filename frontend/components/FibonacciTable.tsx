"use client"

import { useState, useEffect } from "react"

interface FibonacciLevel {
  level: number;
  percentage: string;
  price: number;
  distance: number;
  status: 'support' | 'resistance' | 'neutral';
}

interface TokenFibonacci {
  mint: string;
  symbol: string;
  name: string;
  currentPrice: number;
  high24h: number;
  low24h: number;
  change24h: number;
  levels: FibonacciLevel[];
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: number;
}

const FIBONACCI_RATIOS = [
  { level: 0, percentage: "0.0%" },
  { level: 0.236, percentage: "23.6%" },
  { level: 0.382, percentage: "38.2%" },
  { level: 0.5, percentage: "50.0%" },
  { level: 0.618, percentage: "61.8%" },
  { level: 0.786, percentage: "78.6%" },
  { level: 1.0, percentage: "100.0%" }
];

export default function FibonacciTable() {
  const [tokenFibs, setTokenFibs] = useState<TokenFibonacci[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Calculate Fibonacci levels for a token
  const calculateFibonacciLevels = (high: number, low: number, currentPrice: number): FibonacciLevel[] => {
    const range = high - low;
    
    return FIBONACCI_RATIOS.map(ratio => {
      const price = high - (range * ratio.level);
      const distance = Math.abs(currentPrice - price);
      const relativeDistance = (distance / currentPrice) * 100;
      
      let status: 'support' | 'resistance' | 'neutral' = 'neutral';
      
      if (currentPrice > price && relativeDistance < 2) {
        status = 'support';
      } else if (currentPrice < price && relativeDistance < 2) {
        status = 'resistance';
      }
      
      return {
        level: ratio.level,
        percentage: ratio.percentage,
        price,
        distance: relativeDistance,
        status
      };
    });
  };

  // Fetch token data and calculate Fibonacci levels
  const fetchTokenData = async () => {
    try {
      setIsLoading(true);
      
      // Get portfolio positions to analyze
      const portfolioResponse = await fetch('http://localhost:8000/api/portfolio');
      const portfolioData = await portfolioResponse.json();
      
      if (portfolioData.positions && portfolioData.positions.length > 0) {
        const fibonacciData: TokenFibonacci[] = [];
        
        for (const position of portfolioData.positions.slice(0, 5)) {
          // Simulate price data (in real implementation, fetch from price API)
          const currentPrice = position.currentPrice;
          const high24h = currentPrice * (1 + Math.random() * 0.2); // +20% max
          const low24h = currentPrice * (1 - Math.random() * 0.2); // -20% max
          const change24h = (Math.random() - 0.5) * 20; // ±10%
          
          const levels = calculateFibonacciLevels(high24h, low24h, currentPrice);
          
          // Determine trend based on current price position
          let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
          const midPoint = (high24h + low24h) / 2;
          
          if (currentPrice > midPoint) {
            trend = 'bullish';
          } else if (currentPrice < midPoint) {
            trend = 'bearish';
          }
          
          // Calculate strength based on proximity to key levels
          const keyLevels = levels.filter(l => l.level === 0.618 || l.level === 0.382);
          const avgDistance = keyLevels.reduce((acc, l) => acc + l.distance, 0) / keyLevels.length;
          const strength = Math.max(0, Math.min(100, 100 - avgDistance * 5));
          
          fibonacciData.push({
            mint: position.mint,
            symbol: position.symbol,
            name: position.name || position.symbol,
            currentPrice,
            high24h,
            low24h,
            change24h,
            levels,
            trend,
            strength
          });
        }
        
        setTokenFibs(fibonacciData);
        if (fibonacciData.length > 0 && !selectedToken) {
          setSelectedToken(fibonacciData[0].mint);
        }
      }
      
    } catch (error) {
      console.error('Error fetching Fibonacci data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTokenData();
    const interval = setInterval(fetchTokenData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const selectedTokenData = tokenFibs.find(token => token.mint === selectedToken);

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'bullish': return 'text-green-400';
      case 'bearish': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'support': return 'bg-green-500/20 text-green-400 border-green-500';
      case 'resistance': return 'bg-red-500/20 text-red-400 border-red-500';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500';
    }
  };

  return (
    <div className="h-full bg-black border border-green-500/20 rounded">
      <div className="p-2 border-b border-green-500/20">
        <div className="text-green-400 text-sm font-mono flex items-center gap-2">
          📐 FIBONACCI RETRACEMENT
          <div className="flex-1 h-px bg-green-500/20"></div>
          <span className="text-xs bg-green-500/10 border border-green-500/30 px-2 py-1 rounded">
            {tokenFibs.length} TOKENS
          </span>
        </div>
        <div className="text-green-300/60 text-xs mt-1">
          Key support and resistance levels
        </div>
      </div>
      <div className="p-2 space-y-2">
        {isLoading ? (
          <div className="text-center text-green-400 text-xs py-4">
            🔄 Loading Fibonacci data...
          </div>
        ) : tokenFibs.length === 0 ? (
          <div className="text-center text-green-400/60 text-xs py-4">
            📈 No positions available for analysis
          </div>
        ) : (
          <>
            {/* Token Selector */}
            <div className="flex gap-1 mb-2">
              {tokenFibs.map((token) => (
                <button
                  key={token.mint}
                  onClick={() => setSelectedToken(token.mint)}
                  className={`px-2 py-1 text-xs rounded border transition-all ${
                    selectedToken === token.mint
                      ? 'bg-green-500/20 text-green-400 border-green-500'
                      : 'bg-gray-500/10 text-gray-400 border-gray-500/30 hover:border-green-500/50'
                  }`}
                >
                  {token.symbol}
                </button>
              ))}
            </div>

            {/* Selected Token Analysis */}
            {selectedTokenData && (
              <div className="space-y-2">
                {/* Token Header */}
                <div className="flex justify-between items-center p-2 bg-green-500/5 rounded border border-green-500/20">
                  <div>
                    <div className="text-green-400 text-xs font-mono">
                      {selectedTokenData.symbol}
                    </div>
                    <div className="text-green-300/60 text-xs">
                      ${selectedTokenData.currentPrice.toFixed(6)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-mono ${getTrendColor(selectedTokenData.trend)}`}>
                      {selectedTokenData.trend.toUpperCase()}
                    </div>
                    <div className="text-xs text-green-300/60">
                      {selectedTokenData.change24h > 0 ? '+' : ''}{selectedTokenData.change24h.toFixed(2)}%
                    </div>
                  </div>
                </div>

                {/* Fibonacci Strength */}
                <div className="p-2 bg-gray-500/5 rounded border border-gray-500/20">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-300">Fibonacci Strength</span>
                    <span className="text-xs text-green-400">{selectedTokenData.strength.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-500/20 rounded-full h-1">
                    <div 
                      className="bg-green-500 h-1 rounded-full transition-all"
                      style={{ width: `${selectedTokenData.strength}%` }}
                    ></div>
                  </div>
                </div>

                {/* Fibonacci Levels Table */}
                <div className="space-y-1">
                  <div className="text-xs text-green-300/60 mb-1">Fibonacci Levels:</div>
                  {selectedTokenData.levels.map((level, index) => (
                    <div
                      key={index}
                      className={`flex justify-between items-center p-1 rounded text-xs ${
                        level.status !== 'neutral' 
                          ? 'bg-green-500/10 border border-green-500/20' 
                          : 'bg-gray-500/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-green-400 font-mono w-12">
                          {level.percentage}
                        </span>
                        <span className={`text-xs px-1 py-0 rounded border ${getStatusColor(level.status)}`}>
                          {level.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-green-300">
                          ${level.price.toFixed(6)}
                        </div>
                        <div className="text-green-300/60">
                          {level.distance.toFixed(1)}% away
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Price Range */}
                <div className="p-2 bg-gray-500/5 rounded border border-gray-500/20">
                  <div className="flex justify-between text-xs">
                    <div>
                      <span className="text-green-300/60">24H High: </span>
                      <span className="text-green-400">${selectedTokenData.high24h.toFixed(6)}</span>
                    </div>
                    <div>
                      <span className="text-green-300/60">24H Low: </span>
                      <span className="text-red-400">${selectedTokenData.low24h.toFixed(6)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}