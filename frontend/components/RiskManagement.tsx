"use client"

import { useState, useEffect } from "react"
import { LocalStorageCache, CACHE_KEYS, CACHE_DURATIONS } from "../utils/cache"

interface RiskManagementData {
  var95: number;
  riskLevel: number;
  rugDetection: {
    lpRemovalRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    sellPressure: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    rugProbability: number;
  };
  alphaSignals: {
    fomoLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
    degenScore: number;
    normieFear: 'LOW' | 'MODERATE' | 'HIGH';
    apeFactor: 'HODL' | 'SEND' | 'FULL SEND';
  };
  liquidationMatrix: {
    recentLiquidations: Array<{
      address: string;
      amount: number;
      timeAgo: string;
    }>;
    ngmiCount: number;
    copeLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'MAXIMUM';
  };
  portfolioRisk: {
    concentration: number;
    volatility: number;
    drawdown: number;
  };
}

export default function RiskManagement() {
  const [riskData, setRiskData] = useState<RiskManagementData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load cached data on component mount
  useEffect(() => {
    const cachedData = LocalStorageCache.get<RiskManagementData>(CACHE_KEYS.RISK_MANAGEMENT_DATA);
    
    if (cachedData) {
      setRiskData(cachedData);
      setLoading(false);
    } else {
      setLoading(true);
    }
  }, []);

  useEffect(() => {
    const fetchRiskData = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/risk-management');
        if (response.ok) {
          const data = await response.json();
          setRiskData(data);
          setError(null);
          
          // Cache the successful response
          LocalStorageCache.set(CACHE_KEYS.RISK_MANAGEMENT_DATA, data, CACHE_DURATIONS.RISK_MANAGEMENT);
        } else if (response.status === 503) {
          setError('Risk management service not available. Please check wallet configuration.');
        } else {
          setError('Failed to fetch risk management data');
        }
      } catch (error) {
        setError('Error connecting to backend');
        console.error('Error fetching risk management data:', error);
      } finally {
        setLoading(false);
      }
    };

    // Only fetch if we don't have cached data or if loading is true
    if (loading || !riskData) {
      fetchRiskData();
    }
    
    // Refresh every 3 minutes
    const interval = setInterval(fetchRiskData, 180000);
    
    return () => clearInterval(interval);
  }, [loading, riskData]);

  if (loading) {
    return (
      <div className="border border-green-500 bg-black h-full overflow-hidden relative">
        <h2 className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-green-900/50 to-green-800/30 border-b border-green-500 px-2 py-0.5 text-xs font-normal flex justify-between items-center">
          <span>RISK MANAGEMENT</span>
          <span className="text-green-500 text-xs animate-pulse">Loading...</span>
        </h2>
        <div className="absolute top-6 left-0 right-0 bottom-0 flex items-center justify-center">
          <div className="text-green-500 text-sm animate-pulse">📊 Calculating risk metrics...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-green-500 bg-black h-full overflow-hidden relative">
        <h2 className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-red-900/50 to-red-800/30 border-b border-red-500 px-2 py-0.5 text-xs font-normal">
          RISK MANAGEMENT - Error
        </h2>
        <div className="absolute top-6 left-0 right-0 bottom-0 flex items-center justify-center p-2">
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

  if (!riskData) {
    return (
      <div className="border border-green-500 bg-black h-full overflow-hidden relative">
        <h2 className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-green-900/50 to-green-800/30 border-b border-green-500 px-2 py-0.5 text-xs font-normal">
          RISK MANAGEMENT - No Data
        </h2>
      </div>
    );
  }

  // Helper function to get color for risk levels
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'text-red-500';
      case 'HIGH': return 'text-red-400';
      case 'MODERATE': return 'text-yellow-500';
      case 'LOW': return 'text-green-500';
      case 'EXTREME': return 'text-red-500';
      case 'MAXIMUM': return 'text-red-500';
      case 'FULL SEND': return 'text-green-500';
      case 'SEND': return 'text-yellow-500';
      case 'HODL': return 'text-blue-500';
      default: return 'text-gray-400';
    }
  };

  // Helper function to get progress bar color
  const getProgressColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'bg-red-500';
      case 'HIGH': return 'bg-red-400';
      case 'MODERATE': return 'bg-yellow-500';
      case 'LOW': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  // Helper function to get progress percentage
  const getProgressPercentage = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 90;
      case 'HIGH': return 70;
      case 'MODERATE': return 45;
      case 'LOW': return 20;
      default: return 0;
    }
  };

  return (
    <div className="border border-green-500 bg-black h-full overflow-hidden relative">
      <h2 className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-green-900/50 to-green-800/30 border-b border-green-500 px-2 py-0.5 text-xs font-normal flex justify-between items-center">
        <span>RISK MANAGEMENT</span>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-red-500 font-mono">VaR: ${(riskData.var95 / 1000).toFixed(1)}K</span>
          <span className="text-red-500 font-mono">RISK: {riskData.riskLevel}</span>
        </div>
      </h2>

      <div className="absolute top-6 left-0 right-0 bottom-0 overflow-y-auto p-1 bg-green-500/5 scrollbar-hide">
        <div className="space-y-2">
          {/* Rug Detection - Compact */}
          <div className="bg-red-900/20 border border-red-500/30 p-1">
            <div className="text-red-500 text-xs mb-1 flex items-center gap-1">🚨 RUG DETECTION</div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div className="flex justify-between">
                <span>LP RISK</span>
                <span className={getRiskColor(riskData.rugDetection.lpRemovalRisk)}>
                  {riskData.rugDetection.lpRemovalRisk}
                </span>
              </div>
              <div className="flex justify-between">
                <span>SELL</span>
                <span className={getRiskColor(riskData.rugDetection.sellPressure)}>
                  {riskData.rugDetection.sellPressure}
                </span>
              </div>
            </div>
            <div className="text-center bg-black/30 border border-red-500/20 p-1 mt-1">
              <span className="text-xs text-gray-400">RUG: </span>
              <span className="text-red-500 font-bold">{riskData.rugDetection.rugProbability.toFixed(1)}/10</span>
            </div>
          </div>

          {/* Alpha Signals - Compact */}
          <div className="bg-black/30 border border-green-500/10 p-1">
            <div className="text-green-500 text-xs mb-1 flex items-center gap-1">🎯 ALPHA GRID</div>
            <div className="grid grid-cols-2 gap-1">
              <div className="bg-black/30 p-1 text-center">
                <div className="text-xs text-gray-400">FOMO</div>
                <div className={`text-xs ${getRiskColor(riskData.alphaSignals.fomoLevel)} ${riskData.alphaSignals.fomoLevel === 'EXTREME' ? 'animate-pulse' : ''}`}>
                  {riskData.alphaSignals.fomoLevel}
                </div>
              </div>
              <div className="bg-black/30 p-1 text-center">
                <div className="text-xs text-gray-400">DEGEN</div>
                <div className="text-green-500 text-xs">{riskData.alphaSignals.degenScore.toFixed(1)}/10</div>
              </div>
              <div className="bg-black/30 p-1 text-center">
                <div className="text-xs text-gray-400">FEAR</div>
                <div className={`text-xs ${getRiskColor(riskData.alphaSignals.normieFear)}`}>
                  {riskData.alphaSignals.normieFear}
                </div>
              </div>
              <div className="bg-black/30 p-1 text-center">
                <div className="text-xs text-gray-400">APE</div>
                <div className={`text-xs ${getRiskColor(riskData.alphaSignals.apeFactor)} ${riskData.alphaSignals.apeFactor === 'FULL SEND' ? 'animate-pulse' : ''}`}>
                  {riskData.alphaSignals.apeFactor}
                </div>
              </div>
            </div>
          </div>

          {/* Liquidation Matrix - Compact */}
          <div className="bg-black/30 border border-green-500/10 p-1">
            <div className="text-green-500 text-xs mb-1 flex items-center gap-1">💀 LIQUIDATIONS</div>
            {riskData.liquidationMatrix.recentLiquidations.length > 0 ? (
              <div className="space-y-0.5 text-xs mb-1">
                {riskData.liquidationMatrix.recentLiquidations.slice(0, 1).map((liquidation, index) => (
                  <div key={index} className="flex justify-between">
                    <span className="text-red-400">{liquidation.address}</span>
                    <span className="text-red-500">${(liquidation.amount / 1000).toFixed(1)}K</span>
                    <span className="text-gray-400">{liquidation.timeAgo}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-1">
              <div className="text-center bg-black/30 p-1">
                <div className="text-xs text-gray-400">NGMI</div>
                <div className="text-red-500 text-xs">{riskData.liquidationMatrix.ngmiCount.toLocaleString()}</div>
              </div>
              <div className="text-center bg-black/30 p-1">
                <div className="text-xs text-gray-400">COPE</div>
                <div className={`text-xs ${getRiskColor(riskData.liquidationMatrix.copeLevel)} ${riskData.liquidationMatrix.copeLevel === 'MAXIMUM' ? 'animate-pulse' : ''}`}>
                  {riskData.liquidationMatrix.copeLevel}
                </div>
              </div>
            </div>
          </div>

          {/* Portfolio Risk - Compact */}
          <div className="bg-black/30 border border-green-500/10 p-1">
            <div className="text-green-500 text-xs mb-1 flex items-center gap-1">📊 PORTFOLIO RISK</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>CONCENTRATION</span>
                <span className="text-yellow-500">{riskData.portfolioRisk.concentration.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>VOLATILITY</span>
                <span className="text-red-500">{riskData.portfolioRisk.volatility.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>DRAWDOWN</span>
                <span className="text-red-500">{riskData.portfolioRisk.drawdown.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
