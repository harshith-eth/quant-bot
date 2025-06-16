"use client"

import { useState, useEffect } from "react"
import { LocalStorageCache, CACHE_KEYS, CACHE_DURATIONS } from "../utils/cache"

interface PortfolioMetrics {
  totalBalance: number;
  availableBalance: number;
  inTrades: number;
  totalGain: number;
  totalGainPercent: number;
  dayProfit: number;
  dayProfitPercent: number;
  winRate: number;
  avgWin: number;
  totalTrades: number;
  winningTrades: number;
  solBalance: number;
  solPrice: number;
}

export default function PortfolioStatus() {
  const [portfolioData, setPortfolioData] = useState<PortfolioMetrics | null>(null)
  const [loading, setLoading] = useState(false) // Start with false, will be set based on cache
  const [error, setError] = useState<string | null>(null)
  const [targetBalance] = useState(20000.0)
  const [initialBalance, setInitialBalance] = useState<number | null>(null)

  // Load cached data on component mount
  useEffect(() => {
    const cachedData = LocalStorageCache.get<PortfolioMetrics>(CACHE_KEYS.PORTFOLIO_DATA);
    
    if (cachedData) {
      setPortfolioData(cachedData);
      setLoading(false);
    } else {
      setLoading(true); // Only show loading if no cache
    }
  }, []);

  const resetInitialBalance = async () => {
    if (portfolioData?.totalBalance) {
      try {
        const response = await fetch('http://localhost:8000/api/initial-balance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ balance: portfolioData.totalBalance }),
        });
        
        if (response.ok) {
          setInitialBalance(portfolioData.totalBalance);
        }
      } catch (error) {
        console.error('Failed to reset initial balance:', error);
      }
    }
  }

  useEffect(() => {
    const fetchPortfolioData = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/portfolio');
        if (response.ok) {
          const data = await response.json();
          setPortfolioData(data);
          setError(null);
          
          // Cache the successful response
          LocalStorageCache.set(CACHE_KEYS.PORTFOLIO_DATA, data, CACHE_DURATIONS.PORTFOLIO);
        } else if (response.status === 503) {
          setError('Portfolio service not available. Please check wallet configuration.');
        } else {
          setError('Failed to fetch portfolio data');
        }
      } catch (error) {
        setError('Error connecting to backend');
        console.error('Error fetching portfolio data:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchInitialBalance = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/initial-balance');
        if (response.ok) {
          const data = await response.json();
          if (data.initialBalance !== null) {
            setInitialBalance(data.initialBalance);
          }
        }
      } catch (error) {
        console.error('Failed to fetch initial balance:', error);
      }
    };

    // Only fetch if we don't have cached data or if loading is true
    if (loading || !portfolioData) {
      fetchPortfolioData();
    }
    fetchInitialBalance();
    
    // Refresh every 2 minutes to save on Helius API costs
    const interval = setInterval(() => {
      fetchPortfolioData();
      // Only fetch initial balance every 10 minutes (it rarely changes)
    }, 120000);
    
    // Separate interval for initial balance (less frequent)
    const balanceInterval = setInterval(() => {
      fetchInitialBalance();
    }, 600000); // 10 minutes
    
    return () => {
      clearInterval(interval);
      clearInterval(balanceInterval);
    };
  }, [loading, portfolioData])

  if (loading) {
    return (
      <div className="border border-green-500 bg-black h-full overflow-hidden relative">
        <h2 className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-green-900/50 to-green-800/30 border-b border-green-500 px-2 py-1 text-sm font-normal">
          PORTFOLIO STATUS - Loading...
        </h2>
        <div className="absolute top-8 left-0 right-0 bottom-0 flex items-center justify-center">
          <div className="text-green-500 text-sm animate-pulse">📊 Fetching portfolio data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-green-500 bg-black h-full overflow-hidden relative">
        <h2 className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-red-900/50 to-red-800/30 border-b border-red-500 px-2 py-1 text-sm font-normal">
          PORTFOLIO STATUS - Error
        </h2>
        <div className="absolute top-8 left-0 right-0 bottom-0 flex items-center justify-center p-2">
          <div className="text-red-400 text-sm text-center">
            ⚠️ {error}
            <br />
            <span className="text-xs text-gray-500 mt-2 block">
              Ensure backend server is running and wallet is configured
            </span>
          </div>
        </div>
      </div>
    );
  }

  const currentBalance = portfolioData?.totalBalance || 0;
  const startingBalance = initialBalance || currentBalance;
  const gainNeeded = currentBalance > 0 ? ((targetBalance - currentBalance) / currentBalance) * 100 : 79900;
  const totalGainPercent = portfolioData?.totalGainPercent || 0;

  return (
    <div className="border border-green-500 bg-black h-full overflow-hidden relative">
      <h2 className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-green-900/50 to-green-800/30 border-b border-green-500 px-2 py-0.5 text-xs font-normal flex justify-between items-center">
        <span>PORTFOLIO STATUS</span>
        <div className="flex items-center gap-1 text-xs">
          <span>TARGET: ${targetBalance.toLocaleString()}</span>
          <div className="w-12 h-0.5 bg-green-500/10 relative overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-400"
              style={{ width: `${Math.min((currentBalance / targetBalance) * 100, 100)}%` }}
            ></div>
          </div>
          <span>{((currentBalance / targetBalance) * 100).toFixed(1)}%</span>
        </div>
      </h2>

              <div className="absolute top-6 left-0 right-0 bottom-0 overflow-y-auto p-2 bg-green-500/5 scrollbar-hide">
        <div className="space-y-3">
          {/* Balance Overview */}
          <div className="bg-black/30 border border-green-500/10 p-2">
            <div className="text-green-500 text-xs mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1">💰 BALANCE STATUS</span>
              <button 
                onClick={resetInitialBalance}
                className="text-xs text-gray-400 hover:text-green-500 transition-colors"
                title="Reset initial balance to current balance"
              >
                🔄 Reset
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center bg-black/30 border border-green-500/10 p-2">
                <div className="text-gray-400 text-xs mb-1">INITIAL SOL</div>
                <div className="text-green-500 text-xs">
                  {initialBalance && portfolioData?.solPrice ? (initialBalance / portfolioData.solPrice).toFixed(4) : '0.0000'} SOL
                </div>
              </div>
              <div className="text-center bg-black/30 border border-green-500/10 p-2 relative overflow-hidden">
                <div className="text-gray-400 text-xs mb-1">CURRENT SOL</div>
                <div className="text-green-500 text-xs">{(portfolioData?.solBalance || 0).toFixed(4)} SOL</div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-500/5 to-transparent animate-pulse"></div>
              </div>
              <div className="text-center bg-black/30 border border-green-500/10 p-2">
                <div className="text-gray-400 text-xs mb-1">TOTAL PORTFOLIO</div>
                <div className="text-green-500 text-xs">${currentBalance.toFixed(2)}</div>
              </div>
              <div className="text-center bg-black/30 border border-green-500/10 p-2">
                <div className="text-gray-400 text-xs mb-1">GAIN/LOSS</div>
                <div className={`text-xs animate-pulse ${totalGainPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {totalGainPercent >= 0 ? '+' : ''}{totalGainPercent.toFixed(2)}%
                </div>
              </div>
            </div>
          </div>

          {/* Funds Allocation */}
          <div className="bg-black/30 border border-green-500/10 p-2">
            <div className="text-green-500 text-xs mb-2 flex items-center gap-1">🎯 FUNDS ALLOCATION</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">SOL BALANCE</span>
                <div className="flex-1 mx-2 h-1 bg-green-500/10 rounded overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 to-green-400" 
                    style={{ width: `${currentBalance > 0 ? (portfolioData?.availableBalance || 0) / currentBalance * 100 : 0}%` }}
                  ></div>
                </div>
                <span className="text-green-500 text-xs">
                  {(portfolioData?.solBalance || 0).toFixed(4)} SOL
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">OTHER TOKENS</span>
                <div className="flex-1 mx-2 h-1 bg-green-500/10 rounded overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400" 
                    style={{ width: `${currentBalance > 0 ? (portfolioData?.inTrades || 0) / currentBalance * 100 : 0}%` }}
                  ></div>
                </div>
                <span className="text-green-500 text-xs">${(portfolioData?.inTrades || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Performance Stats */}
          <div className="bg-black/30 border border-green-500/10 p-2">
            <div className="text-green-500 text-xs mb-2 flex items-center gap-1">📊 PERFORMANCE</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center">
                <div className="text-gray-400 text-xs">24H PROFIT</div>
                <div className={`text-xs ${(portfolioData?.dayProfitPercent || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {(portfolioData?.dayProfitPercent || 0).toFixed(2)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-400 text-xs">TOTAL GAIN</div>
                <div className={`text-xs ${(portfolioData?.totalGain || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  ${(portfolioData?.totalGain || 0).toFixed(2)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-400 text-xs">WIN RATE</div>
                <div className="text-green-500 text-xs">
                  {portfolioData?.winningTrades || 0}/{portfolioData?.totalTrades || 0}
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-400 text-xs">AVG WIN</div>
                <div className="text-green-500 text-xs">{(portfolioData?.avgWin || 0).toFixed(2)}%</div>
              </div>
            </div>
          </div>

          {/* Take Profit Levels */}
          <div className="bg-black/30 border border-green-500/10 p-2">
            <div className="text-green-500 text-xs mb-2 flex items-center gap-1">🎯 TAKE PROFIT LEVELS</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-gray-400 text-xs">2X TARGET</div>
                <div className="text-yellow-500 text-xs animate-pulse">$50.00</div>
                <div className="text-gray-400 text-xs">Waiting</div>
              </div>
              <div className="text-center">
                <div className="text-gray-400 text-xs">5X TARGET</div>
                <div className="text-yellow-500 text-xs">$125.00</div>
                <div className="text-gray-400 text-xs">Waiting</div>
              </div>
              <div className="text-center">
                <div className="text-gray-400 text-xs">10X TARGET</div>
                <div className="text-yellow-500 text-xs">$250.00</div>
                <div className="text-gray-400 text-xs">Waiting</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
