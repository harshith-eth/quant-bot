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

interface MemeScannerStats {
  newTokensPerHour: number;
  verifiedPercentage: number;
  avgMarketCap: number;
  avgVolume: number;
  heat: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  blocksScanned: number;
  lastUpdate: string;
  connection?: {
    isConnected: boolean;
    tokenCount: number;
  };
}

export default function MemeScanner() {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [opportunities, setOpportunities] = useState<TokenData[]>([]);
  const [stats, setStats] = useState<MemeScannerStats>({
    newTokensPerHour: 0,
    verifiedPercentage: 0,
    avgMarketCap: 0,
    avgVolume: 0,
    heat: 'LOW',
    blocksScanned: 0,
    lastUpdate: new Date().toISOString(),
  });
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Fetch data from backend
  const fetchData = async () => {
    try {
      const [statsRes, tokensRes, opportunitiesRes] = await Promise.all([
        fetch('http://localhost:8000/api/meme-scanner/stats'),
        fetch('http://localhost:8000/api/meme-scanner/tokens'),
        fetch('http://localhost:8000/api/meme-scanner/opportunities')
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
        setIsConnected(statsData.connection?.isConnected || false);
      }

      if (tokensRes.ok) {
        const tokensData = await tokensRes.json();
        setTokens(tokensData);
      }

      if (opportunitiesRes.ok) {
        const opportunitiesData = await opportunitiesRes.json();
        setOpportunities(opportunitiesData);
      }

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch MEME SCANNER data:', error);
      setIsConnected(false);
    }
  };

  // Initial fetch and set up polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000); // Update every 3 seconds
    return () => clearInterval(interval);
  }, []);

  // Format numbers for display
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  // Format age in seconds to readable format
  const formatAge = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  // Calculate time since last update
  const getTimeSinceUpdate = (): string => {
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000);
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    return `${diffMinutes}m ago`;
  };

  // Get connection status indicator
  const getConnectionStatus = () => {
    if (isConnected) {
      return <span className="text-green-500">●</span>;
    }
    return <span className="text-red-500">●</span>;
  };

  // Get heat color
  const getHeatColor = (heat: string) => {
    switch (heat) {
      case 'EXTREME': return 'bg-red-600/30 text-red-400';
      case 'HIGH': return 'bg-red-500/20 text-red-500';
      case 'MEDIUM': return 'bg-yellow-500/20 text-yellow-500';
      default: return 'bg-green-500/20 text-green-500';
    }
  };

  // Open token links
  const openDexScreener = (mint: string) => {
    window.open(`https://dexscreener.com/solana/${mint}`, '_blank');
  };

  const openPumpFun = (mint: string) => {
    window.open(`https://pump.fun/${mint}`, '_blank');
  };

  return (
    <div className="border border-green-500 bg-black h-full overflow-hidden relative">
      <h2 className="absolute top-0 left-0 right-0 z-10 bg-black border-b border-green-500 px-2 py-1 text-sm font-normal">
        MEME SCANNER {getConnectionStatus()}
        <span className="float-right text-green-500 text-xs font-mono">
          {stats.connection?.tokenCount || 0} TRACKED
        </span>
      </h2>

      <div className="absolute top-8 left-0 right-0 bottom-0 overflow-y-auto p-2 scrollbar-hide">
        {/* Token Stats */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="border border-green-800 p-1">
            <div className="text-green-500 text-xs mb-1">Token Stats</div>
            <div className="text-xs">
              New: <span className="text-green-400">{stats.newTokensPerHour}</span>/hr
            </div>
            <div className="text-xs">
              Verified: <span className="text-green-400">{stats.verifiedPercentage.toFixed(0)}</span>%
            </div>
            <div className="text-xs">
              Tracked: <span className="text-green-400">{stats.connection?.tokenCount || 0}</span>
            </div>
          </div>
          <div className="border border-green-800 p-1">
            <div className="text-green-500 text-xs mb-1">Market Stats</div>
            <div className="text-xs">
              Avg MC: <span className="text-green-400">${formatNumber(stats.avgMarketCap)}</span>
            </div>
            <div className="text-xs">
              Avg Vol: <span className="text-green-400">${formatNumber(stats.avgVolume)}</span>
            </div>
            <div className="text-xs">
              Heat: <span className={`px-1 ${getHeatColor(stats.heat)}`}>{stats.heat}</span>
            </div>
          </div>
        </div>

        {/* Live Token Feed */}
        <div className="mb-3">
          <div className="text-green-500 text-xs mb-1">Live Token Feed <span className="text-gray-500 text-xs">(Click: DexScreener | Right-click: Pump.fun)</span></div>
          <div className="grid grid-cols-7 gap-1 text-xs text-green-600 mb-1 px-1">
            <div>Token</div>
            <div className="text-right">MC</div>
            <div className="text-right">Liq</div>
            <div className="text-center">B/S</div>
            <div className="text-right">Score</div>
            <div className="text-center">Age</div>
            <div className="text-right">Vol</div>
          </div>
          <div className="max-h-32 overflow-y-auto scrollbar-hide">
            {tokens.length === 0 ? (
              <div className="text-center text-gray-500 text-xs py-4">
                {isConnected ? 'Scanning for tokens...' : 'Connecting to scanner...'}
              </div>
            ) : (
              tokens.slice(0, 10).map((token, index) => {
                const buyToSellRatio = token.sellRatio > 0 ? token.buyRatio / token.sellRatio : token.buyRatio;
                return (
                  <div
                    key={token.mint}
                    className="grid grid-cols-7 gap-1 items-center px-1 py-0.5 text-xs border-b border-green-900/20 hover:bg-green-500/10 cursor-pointer group"
                    onClick={() => openDexScreener(token.mint)}
                    title={`${token.name} (${token.mint})\nClick to view on DexScreener\nRight-click for Pump.fun`}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      openPumpFun(token.mint);
                    }}
                  >
                    <div className="text-green-500 truncate group-hover:text-green-300 font-medium">
                      {token.symbol}
                    </div>
                    <div className="text-right">${formatNumber(token.marketCap)}</div>
                    <div className="text-right">${formatNumber(token.liquidity)}</div>
                    <div className={`text-center ${buyToSellRatio >= 4 ? "text-green-500" : "text-yellow-500"}`}>
                      {buyToSellRatio.toFixed(1)}:1
                    </div>
                    <div className="text-right">
                      <span className={`px-1 text-xs ${token.score >= 80 ? 'text-green-400' : token.score >= 60 ? 'text-yellow-400' : 'text-gray-400'}`}>
                        {token.score}
                      </span>
                    </div>
                    <div className="text-center">{formatAge(token.age)}</div>
                    <div className="text-right">${formatNumber(token.volume24h)}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Best Opportunities */}
        <div className="mb-3">
          <div className="text-green-500 text-xs mb-1">Current Best Opportunities <span className="text-gray-500 text-xs">(Click: DexScreener | Right-click: Pump.fun)</span></div>
          <div className="max-h-40 overflow-y-auto scrollbar-hide space-y-2">
            {opportunities.length === 0 ? (
              <div className="text-center text-gray-500 text-xs py-4 border border-green-800">
                No high-scoring opportunities found
              </div>
            ) : (
              opportunities.map((opp, index) => {
                const buyToSellRatio = opp.sellRatio > 0 ? opp.buyRatio / opp.sellRatio : opp.buyRatio;
                return (
                  <div
                    key={opp.mint}
                    className={`p-2 border ${opp.score >= 90 ? "border-green-500 bg-green-500/10" : "border-green-800 bg-green-500/5"} hover:bg-green-500/15 cursor-pointer group`}
                    onClick={() => openDexScreener(opp.mint)}
                    title={`${opp.name} (${opp.mint})\nClick to view on DexScreener\nRight-click for Pump.fun`}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      openPumpFun(opp.mint);
                    }}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-green-500 text-xs font-bold group-hover:text-green-300">{opp.symbol}</span>
                      <span className="text-green-500 text-xs border border-green-600 px-1">{opp.score}/100</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 mb-1 text-xs">
                      <div>MC: ${formatNumber(opp.marketCap)}</div>
                      <div>Liq: ${formatNumber(opp.liquidity)}</div>
                      <div>Age: {formatAge(opp.age)}</div>
                      <div className="text-green-500">B/S: {buyToSellRatio.toFixed(1)}:1</div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <span className={`text-xs px-1 border ${opp.isLiquidityBurned ? "border-green-600 text-green-500 bg-green-500/10" : "border-red-600 text-red-500 bg-red-500/10"}`}>
                        🔒 LP {opp.isLiquidityBurned ? '✓' : '✗'}
                      </span>
                      <span className={`text-xs px-1 border ${opp.isContractSafe ? "border-green-600 text-green-500 bg-green-500/10" : "border-red-600 text-red-500 bg-red-500/10"}`}>
                        📜 Safe {opp.isContractSafe ? '✓' : '✗'}
                      </span>
                      <span className={`text-xs px-1 border ${opp.isMintRenounced ? "border-green-600 text-green-500 bg-green-500/10" : "border-yellow-600 text-yellow-500 bg-yellow-500/10"}`}>
                        🔑 Mint {opp.isMintRenounced ? '✓' : '?'}
                      </span>
                      <span className={`text-xs px-1 border ${!opp.isFreezable ? "border-green-600 text-green-500 bg-green-500/10" : "border-red-600 text-red-500 bg-red-500/10"}`}>
                        ❄️ Freeze {!opp.isFreezable ? '✓' : '✗'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Entry Criteria */}
        <div className="border border-red-800 p-2 mb-2">
          <div className="text-red-500 text-xs mb-1">STRICT ENTRY CRITERIA:</div>
          <div className="space-y-0.5 text-xs">
            <div className="text-green-500">✓ MC {"<"} $200K</div>
            <div className="text-green-500">✓ Liq $5K-$50K</div>
            <div className="text-green-500">✓ Buy/Sell {">"} 4:1</div>
            <div className="text-green-500">✓ {"<"} 15min old</div>
            <div className="text-green-500">✓ Liquidity Burned</div>
            <div className="text-green-500">✓ Contract Safe</div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-xs text-gray-400">
          <div>Blocks Scanned: {stats.blocksScanned.toLocaleString()}</div>
          <div>
            Last Update: <span className={isConnected ? "text-green-400" : "text-red-400"}>{getTimeSinceUpdate()}</span>
          </div>
          <div className="text-xs mt-1">
            Status: <span className={isConnected ? "text-green-400" : "text-red-400"}>
              {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
