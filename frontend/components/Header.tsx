"use client"

import { useState, useEffect } from "react"

interface HeaderProps {
  botRunning: boolean
  onStartBot: () => void
  onStopBot: () => void
  currentTime: Date
}

interface NetworkStats {
  network: string
  gasPrice: number
  volume24h: number
  transactions24h: number
  lastBlock: number
  timeSinceLastBlock: number
  systemActive: boolean
  lastUpdated: string
}

export default function Header({ botRunning, onStartBot, onStopBot, currentTime }: HeaderProps) {
  const [networkStats, setNetworkStats] = useState<NetworkStats>({
    network: 'SOLANA',
    gasPrice: 0.000012,
    volume24h: 0,
    transactions24h: 0,
    lastBlock: 0,
    timeSinceLastBlock: 0,
    systemActive: true,
    lastUpdated: new Date().toISOString(),
  })
  const [loading, setLoading] = useState(true)

  // Fetch network statistics
  useEffect(() => {
    const fetchNetworkStats = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/network-stats')
        if (response.ok) {
          const data = await response.json()
          setNetworkStats(data)
        } else {
          console.error('Failed to fetch network stats:', response.statusText)
        }
      } catch (error) {
        console.error('Error fetching network stats:', error)
      } finally {
        setLoading(false)
      }
    }

    // Fetch immediately
    fetchNetworkStats()

    // Update every 10 seconds
    const interval = setInterval(fetchNetworkStats, 10000)

    return () => clearInterval(interval)
  }, [])

  const formatNumber = (num: number): string => {
    if (num >= 1e9) {
      return `$${(num / 1e9).toFixed(2)}B`
    } else if (num >= 1e6) {
      return `$${(num / 1e6).toFixed(2)}M`
    } else if (num >= 1e3) {
      return `${(num / 1e3).toFixed(0)}K`
    }
    return num.toLocaleString()
  }

  const formatTransactions = (num: number): string => {
    if (num >= 1e6) {
      return `${(num / 1e6).toFixed(1)}M`
    } else if (num >= 1e3) {
      return `${(num / 1e3).toFixed(0)}K`
    }
    return num.toLocaleString()
  }

  return (
    <div className="col-span-4 flex justify-between items-center border-b border-green-500 px-3 py-2 h-12 text-sm">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${networkStats.systemActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-green-600">Network:</span> {loading ? 'Loading...' : networkStats.network}
        </div>
        <div>
          <span className="text-green-600">Gas:</span>
          <span className="ml-1">{loading ? '...' : `${networkStats.gasPrice} SOL`}</span>
        </div>
        <div>
          <span className="text-green-600">24H Vol:</span>
          <span className="ml-1">{loading ? '...' : formatNumber(networkStats.volume24h)}</span>
        </div>
        <div>
          <span className="text-green-600">24H Txns:</span>
          <span className="ml-1">{loading ? '...' : formatTransactions(networkStats.transactions24h)}</span>
        </div>
      </div>

      {/* Bot Control Panel */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${botRunning ? "bg-green-500 animate-pulse" : "bg-red-500 animate-pulse"}`}
          ></div>
          <span className="font-bold text-sm">{botRunning ? "BOT RUNNING" : "BOT STOPPED"}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onStartBot}
            disabled={botRunning}
            className="bg-green-900/40 border border-green-500 text-green-500 px-3 py-1 text-xs font-bold hover:bg-green-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            START BOT
          </button>
          <button
            onClick={onStopBot}
            disabled={!botRunning}
            className="bg-red-900/40 border border-red-500 text-red-500 px-3 py-1 text-xs font-bold hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            STOP BOT
          </button>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${networkStats.systemActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span>{networkStats.systemActive ? 'SYSTEM ACTIVE' : 'SYSTEM INACTIVE'}</span>
        </div>
        <div>
          <span className="text-green-600">Block:</span>
          <span className="ml-1">{loading ? '...' : networkStats.lastBlock.toLocaleString()}</span>
          <span className="ml-2 text-green-600">{loading ? '...' : `${networkStats.timeSinceLastBlock}s ago`}</span>
        </div>
        <div>{currentTime.toLocaleTimeString()}</div>
      </div>
    </div>
  )
}
