"use client"

import { useState, useEffect } from "react"

export default function PortfolioStatus() {
  const [currentBalance] = useState(25.0)
  const [targetBalance] = useState(20000.0)
  const [gainNeeded, setGainNeeded] = useState(0)

  useEffect(() => {
    const needed = ((targetBalance - currentBalance) / currentBalance) * 100
    setGainNeeded(needed)
  }, [currentBalance, targetBalance])

  return (
    <div className="border border-green-500 bg-black h-full overflow-hidden relative">
      <h2 className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-green-900/50 to-green-800/30 border-b border-green-500 px-2 py-1 text-sm font-normal flex justify-between items-center">
        PORTFOLIO STATUS
        <div className="flex items-center gap-2">
          <div className="text-green-500 text-xs font-normal">TARGET: $20,000</div>
          <div className="w-20 h-1 bg-green-500/10 relative overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-400 animate-pulse"
              style={{ width: "0.125%" }}
            ></div>
          </div>
        </div>
      </h2>

      <div className="absolute top-8 left-0 right-0 bottom-0 overflow-y-auto p-2 bg-green-500/5 scrollbar-hide">
        <div className="space-y-3">
          {/* Balance Overview */}
          <div className="bg-black/30 border border-green-500/10 p-2">
            <div className="text-green-500 text-xs mb-2 flex items-center gap-1">💰 BALANCE STATUS</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center bg-black/30 border border-green-500/10 p-2">
                <div className="text-gray-400 text-xs mb-1">INITIAL</div>
                <div className="text-green-500 text-xs">$25.00</div>
              </div>
              <div className="text-center bg-black/30 border border-green-500/10 p-2 relative overflow-hidden">
                <div className="text-gray-400 text-xs mb-1">CURRENT</div>
                <div className="text-green-500 text-xs">${currentBalance.toFixed(2)}</div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-500/5 to-transparent animate-pulse"></div>
              </div>
              <div className="text-center bg-black/30 border border-green-500/10 p-2">
                <div className="text-gray-400 text-xs mb-1">TARGET</div>
                <div className="text-green-500 text-xs">${targetBalance.toLocaleString()}</div>
              </div>
              <div className="text-center bg-black/30 border border-green-500/10 p-2">
                <div className="text-gray-400 text-xs mb-1">NEEDED</div>
                <div className="text-yellow-500 text-xs animate-pulse">{gainNeeded.toFixed(0)}%</div>
              </div>
            </div>
          </div>

          {/* Funds Allocation */}
          <div className="bg-black/30 border border-green-500/10 p-2">
            <div className="text-green-500 text-xs mb-2 flex items-center gap-1">🎯 FUNDS ALLOCATION</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">AVAILABLE</span>
                <div className="flex-1 mx-2 h-1 bg-green-500/10 rounded overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-500 to-green-400 w-full"></div>
                </div>
                <span className="text-green-500 text-xs">$25.00</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">IN TRADES</span>
                <div className="flex-1 mx-2 h-1 bg-green-500/10 rounded overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 w-0"></div>
                </div>
                <span className="text-green-500 text-xs">$0.00</span>
              </div>
            </div>
          </div>

          {/* Performance Stats */}
          <div className="bg-black/30 border border-green-500/10 p-2">
            <div className="text-green-500 text-xs mb-2 flex items-center gap-1">📊 PERFORMANCE</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center">
                <div className="text-gray-400 text-xs">24H PROFIT</div>
                <div className="text-green-500 text-xs">0.00%</div>
              </div>
              <div className="text-center">
                <div className="text-gray-400 text-xs">TOTAL GAIN</div>
                <div className="text-green-500 text-xs">0.00%</div>
              </div>
              <div className="text-center">
                <div className="text-gray-400 text-xs">WIN RATE</div>
                <div className="text-green-500 text-xs">0/0</div>
              </div>
              <div className="text-center">
                <div className="text-gray-400 text-xs">AVG WIN</div>
                <div className="text-green-500 text-xs">0.00%</div>
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
