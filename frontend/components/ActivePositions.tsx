"use client"

import { useState, useEffect } from "react"

interface Position {
  id: string
  mint: string
  symbol: string
  name: string
  amount: number | string
  entryPrice: number | string
  currentPrice: number | string
  marketCap: number | string
  unrealizedPnl: number | string
  unrealizedPnlPercent: number | string
  entryTime: string
  status: string
}

interface DisplayPosition {
  token: string
  mc: string
  entry: string
  size: string
  pl: string
  plType: "profit" | "loss"
  time: string
  action: "TP1" | "MON"
  actionType: "tp-ready" | "monitoring"
}

export default function ActivePositions() {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/positions');
        if (response.ok) {
          const data = await response.json();
          setPositions(data);
          setError(null);
        } else if (response.status === 503) {
          setError('Portfolio service not available. Please check wallet configuration.');
        } else {
          setError('Failed to fetch positions data');
        }
      } catch (error) {
        setError('Error connecting to backend');
        console.error('Error fetching positions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPositions();
    
    // Refresh every 2 minutes to save on API costs
    const interval = setInterval(fetchPositions, 120000);
    
    return () => clearInterval(interval);
  }, [])

  // Convert backend positions to display format
  const displayPositions: DisplayPosition[] = positions.map(position => {
    // Ensure all numeric values are properly converted to numbers
    const amount = Number(position.amount) || 0;
    const currentPrice = Number(position.currentPrice) || 0;
    const entryPrice = Number(position.entryPrice) || 0;
    const marketCap = Number(position.marketCap) || 0;
    const unrealizedPnlPercent = Number(position.unrealizedPnlPercent) || 0;
    
    const currentValue = amount * currentPrice;
    const timeAgo = getTimeAgo(new Date(position.entryTime || Date.now()));
    
    // Use the token name if available, otherwise fall back to symbol
    // Prioritize name over symbol for better readability (e.g., "FartCat" instead of "3DK9CN")
    let displayName = position.name && position.name !== position.symbol && position.name.length > 3 
      ? position.name 
      : position.symbol;
    
    // Clean up the display name - remove common prefixes/suffixes
    displayName = displayName.replace(/^(\$|Token|Coin)\s*/i, '').trim();
    
    // Add $ prefix if not already present
    const tokenDisplay = displayName.startsWith('$') ? displayName : `$${displayName}`;
    
    return {
      token: tokenDisplay,
      mc: marketCap > 0 ? formatMarketCap(marketCap) : formatMarketCap(currentValue),
      entry: entryPrice > 0 ? `$${entryPrice < 0.001 ? entryPrice.toExponential(2) : entryPrice.toFixed(6)}` : 'N/A',
      size: `$${currentValue.toFixed(2)}`,
      pl: `${unrealizedPnlPercent >= 0 ? '+' : ''}${unrealizedPnlPercent.toFixed(1)}%`,
      plType: unrealizedPnlPercent >= 0 ? "profit" : "loss",
      time: timeAgo,
      action: unrealizedPnlPercent > 50 ? "TP1" : "MON",
      actionType: unrealizedPnlPercent > 50 ? "tp-ready" : "monitoring"
    };
  });

  // Helper function to format market cap
  function formatMarketCap(value: number): string {
    if (value >= 1000000000) {
      return `$${(value / 1000000000).toFixed(1)}B`;
    } else if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    } else if (value >= 1) {
      return `$${value.toFixed(0)}`;
    } else {
      return `$${value.toFixed(3)}`;
    }
  }

  // Helper function to get time ago
  function getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins}m`;
    } else if (diffHours < 24) {
      return `${diffHours}h`;
    } else {
      return `${diffDays}d`;
    }
  }

  if (loading) {
    return (
      <div className="border border-green-500 bg-black h-full overflow-hidden relative">
        <h2 className="absolute top-0 left-0 right-0 z-10 bg-black border-b border-green-500 px-2 py-1 text-sm font-normal">
          ACTIVE POSITIONS - Loading...
        </h2>
        <div className="absolute top-8 left-0 right-0 bottom-0 flex items-center justify-center">
          <div className="text-green-500 text-sm animate-pulse">🔄 Fetching positions...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-green-500 bg-black h-full overflow-hidden relative">
        <h2 className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-red-900/50 to-red-800/30 border-b border-red-500 px-2 py-1 text-sm font-normal">
          ACTIVE POSITIONS - Error
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

  if (displayPositions.length === 0) {
    return (
      <div className="border border-green-500 bg-black h-full overflow-hidden relative">
        <h2 className="absolute top-0 left-0 right-0 z-10 bg-black border-b border-green-500 px-2 py-1 text-sm font-normal flex justify-between">
          ACTIVE POSITIONS
          <span className="text-green-500 text-xs font-mono">0 POSITIONS</span>
        </h2>
        <div className="absolute top-8 left-0 right-0 bottom-0 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="text-gray-400 text-sm mb-2">💸 NO MEME COINS TO SHOW</div>
            <div className="text-green-500 text-xs">
              Start trading and your active positions will reflect here
            </div>
            <div className="text-gray-500 text-xs mt-1">
              (Only showing non-SOL, non-stablecoin positions)
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-green-500 bg-black h-full overflow-hidden relative">
      <h2 className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-green-900/50 to-green-800/30 border-b border-green-500 px-2 py-0.5 text-xs font-normal flex justify-between items-center">
        <span>ACTIVE POSITIONS</span>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-green-500 font-mono">{displayPositions.length} ACTIVE</span>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400">LIVE</span>
          </div>
        </div>
      </h2>

      <div className="absolute top-6 left-0 right-0 bottom-0 overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-black z-20 border-b border-green-800 px-2 py-1">
          <div className="grid grid-cols-[2fr_1fr_1.5fr_1.5fr_1fr_0.8fr_1fr] gap-1 text-xs font-bold">
            <div className="truncate">Token</div>
            <div className="text-right">MC</div>
            <div className="text-right">Entry</div>
            <div className="text-right">Size</div>
            <div className="text-right">P/L</div>
            <div className="text-center">Time</div>
            <div className="text-center">TP</div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="h-full overflow-y-auto scrollbar-hide">
          {displayPositions.map((position, index) => (
            <div
              key={index}
              className="grid grid-cols-[2fr_1fr_1.5fr_1.5fr_1fr_0.8fr_1fr] gap-1 items-center px-2 py-1 text-xs border-b border-green-900/20"
            >
              <div className="text-green-500 font-bold truncate" title={position.token}>
                {position.token}
              </div>
              <div className="text-right text-yellow-400">{position.mc}</div>
              <div className="text-right text-gray-300">{position.entry}</div>
              <div className="text-right text-blue-400">{position.size}</div>
              <div className={`text-right font-bold ${position.plType === "profit" ? "text-green-500" : "text-red-500"}`}>
                {position.pl}
              </div>
              <div className="text-center text-gray-400">{position.time}</div>
              <div className="text-center">
                <button
                  className={`px-1.5 py-0.5 text-xs border rounded ${
                    position.actionType === "tp-ready"
                      ? "bg-green-900/50 border-green-600 text-green-500"
                      : "bg-yellow-900/50 border-yellow-600 text-yellow-500"
                  }`}
                >
                  {position.action}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
