import React from 'react';

export default function AIAnalysis() {
  return (
    <div className="border border-green-500 bg-black h-full overflow-hidden relative">
      <h2 className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-green-900/50 to-green-800/30 border-b border-green-500 px-2 py-1 text-sm font-normal">
        AI ANALYSIS
        <span className="float-right text-green-500 text-xs font-mono">
          CONF: 92% | PTN: 89% | ACC: 95%
        </span>
      </h2>
      
      <div className="absolute top-8 left-0 right-0 bottom-0 overflow-y-auto p-2 bg-green-500/5 scrollbar-hide">
        <div className="space-y-3">
          {/* QWEN Neural Net */}
          <div className="bg-black/30 border border-green-500/10 p-2">
            <div className="text-green-500 text-xs mb-2 flex items-center gap-1">
              🤖 QWEN 2.5 NEURAL NET
            </div>
            <div className="bg-black/30 p-2">
              <div className="text-green-500 text-xs text-center mb-2">FIBONACCI MATRIX</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span>0.618</span>
                  <span>$123.45</span>
                  <div className="flex-1 mx-2 h-0.5 bg-green-500"></div>
                </div>
                <div className="flex justify-between items-center">
                  <span>0.5</span>
                  <span>$118.30</span>
                  <div className="flex-1 mx-2 h-0.5 bg-gray-600"></div>
                </div>
                <div className="flex justify-between items-center text-green-500">
                  <span>0.382</span>
                  <span>$110.25</span>
                  <div className="flex-1 mx-2 h-0.5 bg-green-500"></div>
                </div>
              </div>
              <div className="mt-2">
                <div className="h-1 bg-gray-800">
                  <div className="h-full bg-green-500 animate-pulse" style={{ width: '92%' }}></div>
                </div>
                <div className="text-right text-xs text-green-500 mt-1">Neural Confidence: 92%</div>
              </div>
            </div>
          </div>

          {/* LLAMA Analysis */}
          <div className="bg-black/30 border border-green-500/10 p-2">
            <div className="text-green-500 text-xs mb-2 flex items-center gap-1">
              🦙 LLAMA 3.1 QUANTUM ANALYSIS
            </div>
            <div className="bg-black/20 h-20 relative mb-2 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-500/10 to-transparent animate-pulse"></div>
              <div className="absolute bottom-2 left-2 text-xs">
                <div className="text-green-500">WAVE 3 OF 5 DETECTED</div>
                <div className="text-xs">WAVE 4 → $108.20</div>
                <div className="text-xs">WAVE 5 → $142.75</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span>RSI DIVERGENCE</span>
                <span className="text-green-500">BULLISH</span>
              </div>
              <div className="flex justify-between">
                <span>QUANTUM MOMENTUM</span>
                <span className="text-red-500">EXTREME</span>
              </div>
            </div>
          </div>

          {/* Pattern Recognition */}
          <div className="bg-black/30 border border-green-500/10 p-2">
            <div className="text-green-500 text-xs mb-2 flex items-center gap-1">
              🧠 NEURAL PATTERN MATRIX
            </div>
            <div className="grid grid-cols-3 gap-1">
              <div className="bg-green-500/20 border border-green-500 p-1 text-center">
                <div className="text-xs">HARMONIC BAT</div>
                <div className="text-green-500 text-xs">89%</div>
              </div>
              <div className="bg-yellow-500/20 border border-yellow-500 p-1 text-center">
                <div className="text-xs">GARTLEY</div>
                <div className="text-yellow-500 text-xs">76%</div>
              </div>
              <div className="bg-red-500/20 border border-red-500 p-1 text-center">
                <div className="text-xs">BUTTERFLY</div>
                <div className="text-red-500 text-xs">45%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
