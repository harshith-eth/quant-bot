"use client"

import { useState } from "react"

interface WhaleMove {
  wallet: string
  action: "Buy" | "Sell" | "Transfer"
  amount: string
  impact: "Low" | "Medium" | "High" | "Critical"
}

export default function WhaleActivity() {
  const [filter, setFilter] = useState<string>("All")
  const [whaleMoves] = useState<WhaleMove[]>([
    { wallet: "0x7a2...3f9b", action: "Buy", amount: "1,250 SOL", impact: "High" },
    { wallet: "0x9c4...8e2d", action: "Transfer", amount: "890 SOL", impact: "Medium" },
    { wallet: "0x3b5...7a1c", action: "Sell", amount: "2,100 SOL", impact: "High" },
    { wallet: "0x4d8...2e5f", action: "Buy", amount: "750 SOL", impact: "Medium" },
    { wallet: "0x6f1...9c3a", action: "Transfer", amount: "1,500 SOL", impact: "High" },
    { wallet: "0x8e2...4d1c", action: "Buy", amount: "3,200 SOL", impact: "High" },
    { wallet: "0x5a7...1b8d", action: "Sell", amount: "950 SOL", impact: "Medium" },
    { wallet: "0xaf3...9c2b", action: "Sell", amount: "4,500 SOL", impact: "Critical" },
  ])

  const filteredMoves =
    filter === "All"
      ? whaleMoves
      : whaleMoves.filter((move) => {
          if (filter === "Buys") return move.action === "Buy"
          if (filter === "Sells") return move.action === "Sell"
          if (filter === "Transfers") return move.action === "Transfer"
          return true
        })

  const getActionColor = (action: string) => {
    switch (action) {
      case "Buy":
        return "text-green-500"
      case "Sell":
        return "text-red-500"
      case "Transfer":
        return "text-yellow-500"
      default:
        return "text-white"
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "Critical":
        return "text-red-500 bg-red-500/10"
      case "High":
        return "text-red-400 bg-red-500/5"
      case "Medium":
        return "text-yellow-500 bg-yellow-500/10"
      case "Low":
        return "text-yellow-400 bg-yellow-500/5"
      default:
        return "text-white"
    }
  }

  return (
    <div className="border border-green-500 bg-black h-full overflow-hidden relative">
      <h2 className="absolute top-0 left-0 right-0 z-10 bg-black border-b border-green-500 px-2 py-1 text-sm font-normal">
        WHALE ACTIVITY
        <span className="float-right text-green-500 text-xs font-mono">25KVOL 47MOVES $PEPE2HOT</span>
      </h2>

      <div className="absolute top-8 left-0 right-0 bottom-0 flex flex-col">
        {/* Filters */}
        <div className="px-2 py-1 border-b border-green-800">
          <div className="flex gap-1">
            {["All", "Buys", "Sells", "Transfers"].map((filterOption) => (
              <button
                key={filterOption}
                onClick={() => setFilter(filterOption)}
                className={`px-2 py-0.5 text-xs border transition-all ${
                  filter === filterOption
                    ? "bg-green-900/50 border-green-500 text-green-500"
                    : "bg-green-900/20 border-green-800 text-green-500 hover:bg-green-900/30"
                }`}
              >
                {filterOption}
              </button>
            ))}
          </div>
        </div>

        {/* Header */}
        <div className="px-2 py-1 border-b border-green-800">
          <div className="grid grid-cols-4 gap-2 text-xs font-bold text-green-500">
            <div>Wallet</div>
            <div className="text-center">Action</div>
            <div className="text-right">Amount</div>
            <div className="text-center">Impact</div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {filteredMoves.map((move, index) => (
            <div
              key={index}
              className="grid grid-cols-4 gap-2 items-center px-2 py-1 text-xs border-b border-green-900/20 hover:bg-green-500/5"
            >
              <div className="text-green-500 font-mono">{move.wallet}</div>
              <div className={`text-center ${getActionColor(move.action)}`}>{move.action}</div>
              <div className="text-right">{move.amount}</div>
              <div className="text-center">
                <span className={`px-1 py-0.5 text-xs ${getImpactColor(move.impact)}`}>{move.impact}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Metrics */}
        <div className="px-2 py-1 border-t border-green-800 text-xs">
          <div className="mb-1">
            Buy Pressure: <span className="text-green-500">65%</span>
            <div className="w-full h-1 bg-green-500/10 mt-0.5">
              <div className="h-full bg-gradient-to-r from-green-500 to-green-400" style={{ width: "65%" }}></div>
            </div>
          </div>
          <div>
            Sell Pressure: <span className="text-red-500">35%</span>
            <div className="w-full h-1 bg-red-500/10 mt-0.5">
              <div className="h-full bg-gradient-to-r from-red-500 to-red-400" style={{ width: "35%" }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
