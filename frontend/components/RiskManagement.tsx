export default function RiskManagement() {
  return (
    <div className="border border-green-500 bg-black h-full overflow-hidden relative">
      <h2 className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-green-900/50 to-green-800/30 border-b border-green-500 px-2 py-1 text-sm font-normal">
        RISK MANAGEMENT
        <span className="float-right text-green-500 text-xs font-mono">VaR: -$25.4K | SHARPE: 1.2 | RISK: 7.5</span>
      </h2>

      <div className="absolute top-8 left-0 right-0 bottom-0 overflow-y-auto p-2 bg-green-500/5 scrollbar-hide">
        <div className="space-y-3">
          {/* Rug Detection */}
          <div className="bg-red-900/20 border border-red-500/30 p-2">
            <div className="text-red-500 text-xs mb-2 flex items-center gap-1">🚨 RUG DETECTION MATRIX</div>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>LP REMOVAL RISK</span>
                  <span className="text-red-500">CRITICAL</span>
                </div>
                <div className="h-1 bg-gray-800">
                  <div className="h-full bg-red-500 animate-pulse" style={{ width: "75%" }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>SELL PRESSURE</span>
                  <span className="text-yellow-500">MODERATE</span>
                </div>
                <div className="h-1 bg-gray-800">
                  <div className="h-full bg-yellow-500" style={{ width: "45%" }}></div>
                </div>
              </div>
              <div className="text-center bg-black/30 border border-red-500/20 p-2">
                <div className="text-xs text-gray-400">RUG PROBABILITY</div>
                <div className="text-red-500 font-bold">7.5/10</div>
              </div>
            </div>
          </div>

          {/* Alpha Signals */}
          <div className="bg-black/30 border border-green-500/10 p-2">
            <div className="text-green-500 text-xs mb-2 flex items-center gap-1">🎯 ALPHA DETECTION GRID</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-red-500/20 p-2 text-center">
                <div className="text-xs text-gray-400">FOMO LEVEL</div>
                <div className="text-red-500 font-bold animate-pulse">EXTREME</div>
              </div>
              <div className="bg-black/30 p-2 text-center">
                <div className="text-xs text-gray-400">DEGEN SCORE</div>
                <div className="text-green-500">9.2/10</div>
              </div>
              <div className="bg-yellow-500/20 p-2 text-center">
                <div className="text-xs text-gray-400">NORMIE FEAR</div>
                <div className="text-yellow-500">HIGH</div>
              </div>
              <div className="bg-green-500/20 p-2 text-center">
                <div className="text-xs text-gray-400">APE FACTOR</div>
                <div className="text-green-500 font-bold animate-pulse">FULL SEND</div>
              </div>
            </div>
          </div>

          {/* Liquidation Matrix */}
          <div className="bg-black/30 border border-green-500/10 p-2">
            <div className="text-green-500 text-xs mb-2 flex items-center gap-1">💀 LIQUIDATION MATRIX</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between border-b border-red-500/20 pb-1">
                <span className="text-red-400">0x7d..ff3</span>
                <span className="text-red-500 font-bold animate-pulse">-$42.0K</span>
                <span className="text-gray-400">2m ago</span>
              </div>
              <div className="flex justify-between border-b border-red-500/20 pb-1">
                <span className="text-red-400">0x3a..b21</span>
                <span className="text-red-500">-$69.4K</span>
                <span className="text-gray-400">5m ago</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="text-center bg-black/30 p-1">
                <div className="text-xs text-gray-400">NGMI COUNT</div>
                <div className="text-red-500">1,337</div>
              </div>
              <div className="text-center bg-black/30 p-1">
                <div className="text-xs text-gray-400">COPE LEVEL</div>
                <div className="text-red-500 animate-pulse">MAXIMUM</div>
              </div>
            </div>
          </div>

          {/* Portfolio Risk */}
          <div className="bg-black/30 border border-green-500/10 p-2">
            <div className="text-green-500 text-xs mb-2 flex items-center gap-1">📊 QUANTUM RISK MATRIX</div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>VALUE AT RISK (VaR)</span>
                <span className="text-red-500 animate-pulse">-$25,420 (95% CI)</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>SHARPE RATIO</span>
                <span className="text-yellow-500">1.2</span>
              </div>
              <div className="h-2 bg-gray-800 flex">
                <div className="bg-green-500" style={{ width: "30%" }}></div>
                <div className="bg-yellow-500" style={{ width: "45%" }}></div>
                <div className="bg-red-500" style={{ width: "25%" }}></div>
              </div>
              <div className="flex justify-between text-xs">
                <span>Low Risk</span>
                <span>Medium</span>
                <span>High Risk</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
