export default function MarketAnalysis() {
  return (
    <div className="border border-green-500 bg-black h-full overflow-hidden relative">
      <h2 className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-green-900/50 to-green-800/30 border-b border-green-500 px-2 py-1 text-sm font-normal">
        MARKET ANALYSIS
        <span className="float-right text-green-500 text-xs font-mono">FOMO: 85% » TREND: MOON » RSI: 92</span>
      </h2>

      <div className="absolute top-8 left-0 right-0 bottom-0 overflow-y-auto p-2 bg-green-500/5 scrollbar-hide">
        <div className="space-y-3">
          {/* Money Flow Heatmap */}
          <div className="bg-black/30 border border-green-500/10 p-2">
            <div className="text-green-500 text-xs mb-2 flex items-center gap-1">🤑 DEGEN MONEY FLOW</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-red-500/20 p-2 text-center">
                <div className="text-xs">PEPE</div>
                <div className="text-red-500 font-bold">+420%</div>
              </div>
              <div className="bg-yellow-500/20 p-2 text-center">
                <div className="text-xs">WOJAK</div>
                <div className="text-yellow-500 font-bold">+169%</div>
              </div>
              <div className="bg-red-900/20 p-2 text-center">
                <div className="text-xs">CHAD</div>
                <div className="text-red-500 font-bold">-99%</div>
              </div>
              <div className="bg-green-500/20 p-2 text-center">
                <div className="text-xs">ELON</div>
                <div className="text-green-500 font-bold">+1337%</div>
              </div>
            </div>
          </div>

          {/* Retard Strength Index */}
          <div className="bg-black/30 border border-green-500/10 p-2">
            <div className="text-green-500 text-xs mb-2 flex items-center gap-1">🦍 RETARD STRENGTH INDEX</div>
            <div className="mb-2">
              <div className="h-2 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 relative">
                <div className="absolute right-4 top-0 w-1 h-full bg-white"></div>
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
                <span className="text-red-500">-69%</span>
              </div>
              <div className="flex justify-between">
                <span>Diamond Hands:</span>
                <span className="text-green-500">+420%</span>
              </div>
            </div>
          </div>

          {/* Market Cycle */}
          <div className="bg-black/30 border border-green-500/10 p-2">
            <div className="text-green-500 text-xs mb-2 flex items-center gap-1">🌊 MARKET CYCLE</div>
            <div className="flex justify-between items-center mb-2">
              <div className="text-center">
                <div className="w-3 h-3 bg-gray-600 rounded-full mx-auto mb-1"></div>
                <div className="text-xs">STEALTH</div>
                <div className="text-xs text-green-500">+10x</div>
              </div>
              <div className="text-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mb-1 animate-pulse"></div>
                <div className="text-xs text-green-500 font-bold">FOMO</div>
                <div className="text-xs text-green-500">+50x</div>
              </div>
              <div className="text-center">
                <div className="w-3 h-3 bg-yellow-500 rounded-full mx-auto mb-1 animate-pulse"></div>
                <div className="text-xs">MOON</div>
                <div className="text-xs text-green-500">+100x</div>
              </div>
              <div className="text-center">
                <div className="w-3 h-3 bg-gray-600 rounded-full mx-auto mb-1"></div>
                <div className="text-xs">DUMP</div>
                <div className="text-xs text-red-500">-90%</div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-green-500 font-bold animate-pulse">NEXT: ULTRA MOON</div>
              <div className="text-xs text-yellow-500">≈ 2.5 MINS</div>
            </div>
          </div>

          {/* Fibonacci Analysis */}
          <div className="bg-black/30 border border-green-500/10 p-2">
            <div className="text-green-500 text-xs mb-2 flex items-center gap-1">🌀 FIBONACCI QUANTUM MATRIX</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-green-600 mb-1">RETRACEMENT</div>
                <div className="space-y-0.5 text-xs">
                  <div className="flex justify-between">
                    <span>1.000</span>
                    <span>$138.20</span>
                  </div>
                  <div className="flex justify-between text-yellow-500">
                    <span>0.618</span>
                    <span>$126.80</span>
                  </div>
                  <div className="flex justify-between text-green-500 font-bold">
                    <span>0.655</span>
                    <span>$124.30</span>
                  </div>
                  <div className="flex justify-between">
                    <span>0.500</span>
                    <span>$121.10</span>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs text-green-600 mb-1">EXTENSION</div>
                <div className="space-y-0.5 text-xs">
                  <div className="flex justify-between">
                    <span>4.236</span>
                    <span>$248.90</span>
                  </div>
                  <div className="flex justify-between">
                    <span>2.618</span>
                    <span>$193.30</span>
                  </div>
                  <div className="flex justify-between text-cyan-500">
                    <span>1.618</span>
                    <span>$159.50</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
