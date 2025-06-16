"use client"

import { useState, useEffect } from "react"

interface WhaleTransaction {
  signature: string
  wallet: string
  action: "Buy" | "Sell" | "Transfer"
  tokenMint: string
  tokenSymbol: string
  tokenName: string
  amount: number
  usdValue: number
  impact: "Low" | "Medium" | "High" | "Critical"
  timestamp: string
  blockTime: number
  slot: number
}

interface WhaleStats {
  totalVolume24h: number
  totalMoves24h: number
  buyPressure: number
  sellPressure: number
  topToken: string
  avgTransactionSize: number
}

export default function WhaleActivity() {
  const [filter, setFilter] = useState<string>("All")
  const [whaleTransactions, setWhaleTransactions] = useState<WhaleTransaction[]>([])
  const [whaleStats, setWhaleStats] = useState<WhaleStats>({
    totalVolume24h: 0,
    totalMoves24h: 0,
    buyPressure: 50,
    sellPressure: 50,
    topToken: 'SOL',
    avgTransactionSize: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  // Fetch whale data from backend
  const fetchWhaleData = async () => {
    try {
      const [transactionsRes, statsRes, statusRes] = await Promise.all([
        fetch('http://localhost:8000/api/whale-tracker/transactions?limit=20'),
        fetch('http://localhost:8000/api/whale-tracker/stats'),
        fetch('http://localhost:8000/api/whale-tracker/status')
      ])

      if (transactionsRes.ok) {
        const transactions = await transactionsRes.json()
        setWhaleTransactions(transactions)
      }

      if (statsRes.ok) {
        const stats = await statsRes.json()
        setWhaleStats(stats)
      }

      if (statusRes.ok) {
        const status = await statusRes.json()
        setIsConnected(status.isActive)
      }

      setError(null)
    } catch (error) {
      console.error('Failed to fetch whale data:', error)
      setError('Failed to connect to whale tracker')
      setIsConnected(false)
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch and set up polling
  useEffect(() => {
    fetchWhaleData()
    const interval = setInterval(fetchWhaleData, 5000) // Update every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const filteredMoves = filter === "All"
    ? whaleTransactions
    : whaleTransactions.filter((move) => {
        if (filter === "Buys") return move.action === "Buy"
        if (filter === "Sells") return move.action === "Sell"
        if (filter === "Transfers") return move.action === "Transfer"
        return true
      })

  const formatNumber = (num: number): string => {
    if (num >= 1000000000) return `$${(num / 1000000000).toFixed(2)}B`
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`
    return `$${num.toFixed(2)}`
  }

  const formatAmount = (amount: number, symbol: string): string => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(2)}M ${symbol}`
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K ${symbol}`
    return `${amount.toFixed(2)} ${symbol}`
  }

  const getTimeAgo = (timestamp: string): string => {
    const now = new Date()
    const txTime = new Date(timestamp)
    const diffMs = now.getTime() - txTime.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${Math.floor(diffHours / 24)}d ago`
  }

  const openWalletOnSolscan = (wallet: string) => {
    // Open the wallet address on Solscan explorer
    const solscanUrl = `https://solscan.io/account/${wallet}`
    window.open(solscanUrl, '_blank')
  }

  const openTransactionOnSolscan = (signature: string) => {
    const solscanUrl = `https://solscan.io/tx/${signature}`
    window.open(solscanUrl, '_blank')
  }

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

  if (loading) {
    return (
      <div className="border border-green-500 bg-black h-full overflow-hidden relative">
        <h2 className="absolute top-0 left-0 right-0 z-10 bg-black border-b border-green-500 px-2 py-1 text-sm font-normal">
          WHALE ACTIVITY - Loading...
        </h2>
        <div className="absolute top-8 left-0 right-0 bottom-0 flex items-center justify-center">
          <div className="text-green-500 text-sm animate-pulse">🐋 Scanning for whales...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="border border-green-500 bg-black h-full overflow-hidden relative">
        <h2 className="absolute top-0 left-0 right-0 z-10 bg-black border-b border-red-500 px-2 py-1 text-sm font-normal">
          WHALE ACTIVITY - Error
        </h2>
        <div className="absolute top-8 left-0 right-0 bottom-0 flex items-center justify-center p-2">
          <div className="text-red-400 text-sm text-center">
            ⚠️ {error}
            <br />
            <span className="text-xs text-gray-500 mt-2 block">
              Ensure backend server is running
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-green-500 bg-black h-full overflow-hidden relative">
      <h2 className="absolute top-0 left-0 right-0 z-10 bg-black border-b border-green-500 px-2 py-1 text-sm font-normal">
        WHALE ACTIVITY {isConnected ? '🟢' : '🔴'}
        <span className="float-right text-green-500 text-xs font-mono">
          {formatNumber(whaleStats.totalVolume24h)} {whaleStats.totalMoves24h}MOVES ${whaleStats.topToken}
        </span>
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
          {filteredMoves.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500 text-xs">
                {isConnected ? 'No whale activity detected' : 'Connecting to whale tracker...'}
              </div>
            </div>
          ) : (
            filteredMoves.map((move, index) => (
              <div
                key={move.signature}
                className="grid grid-cols-4 gap-2 items-center px-2 py-1 text-xs border-b border-green-900/20 hover:bg-green-500/10 cursor-pointer transition-all"
                title={`${move.tokenName} (${move.tokenSymbol})\nSignature: ${move.signature}\nUSD Value: ${formatNumber(move.usdValue)}\nTime: ${getTimeAgo(move.timestamp)}\n\nClick wallet: View on Solscan\nClick transaction: View on Solscan`}
                onClick={() => openTransactionOnSolscan(move.signature)}
              >
                <div 
                  className="text-green-500 font-mono hover:text-green-300 hover:underline"
                  onClick={(e) => {
                    e.stopPropagation()
                    openWalletOnSolscan(move.wallet)
                  }}
                >
                  {move.wallet}
                </div>
                <div className={`text-center ${getActionColor(move.action)}`}>{move.action}</div>
                <div className="text-right font-mono">{formatAmount(move.amount, move.tokenSymbol)}</div>
                <div className="text-center">
                  <span className={`px-1 py-0.5 text-xs rounded ${getImpactColor(move.impact)}`}>{move.impact}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Metrics */}
        <div className="px-2 py-1 border-t border-green-800 text-xs">
          <div className="mb-1">
            Buy Pressure: <span className="text-green-500">{whaleStats.buyPressure.toFixed(0)}%</span>
            <div className="w-full h-1 bg-green-500/10 mt-0.5">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-green-400" 
                style={{ width: `${whaleStats.buyPressure}%` }}
              ></div>
            </div>
          </div>
          <div>
            Sell Pressure: <span className="text-red-500">{whaleStats.sellPressure.toFixed(0)}%</span>
            <div className="w-full h-1 bg-red-500/10 mt-0.5">
              <div 
                className="h-full bg-gradient-to-r from-red-500 to-red-400" 
                style={{ width: `${whaleStats.sellPressure}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
