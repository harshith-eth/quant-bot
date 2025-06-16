"use client"

import { useState, useEffect } from "react"

interface Signal {
  timestamp: string
  message: string
  type: "normal" | "alert" | "emergency"
  category: string
}

interface SignalSection {
  title: string
  signals: Signal[]
}

interface SignalFeedStats {
  totalSignals24h: number
  accuracy: number
  isLive: boolean
}

export default function SignalFeed() {
  const [signalSections, setSignalSections] = useState<SignalSection[]>([])
  const [stats, setStats] = useState<SignalFeedStats>({
    totalSignals24h: 2400,
    accuracy: 92.4,
    isLive: true
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch signals from backend
  const fetchSignals = async () => {
    try {
      const [signalsRes, statsRes] = await Promise.all([
        fetch('http://localhost:8000/api/signal-feed/signals-grouped'),
        fetch('http://localhost:8000/api/signal-feed/stats')
      ])

      if (signalsRes.ok) {
        const groupedSignals = await signalsRes.json()
        
        // Convert grouped signals to sections format
        const sections: SignalSection[] = [
          {
            title: "Market Scanner",
            signals: groupedSignals['Market Scanner'] || []
          },
          {
            title: "Whale Tracker", 
            signals: groupedSignals['Whale Tracker'] || []
          },
          {
            title: "Social Signals",
            signals: groupedSignals['Social Signals'] || []
          },
          {
            title: "Trade Signals",
            signals: groupedSignals['Trade Signals'] || []
          }
        ]

        setSignalSections(sections)
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }

      setError(null)
    } catch (error) {
      console.error('Failed to fetch signals:', error)
      setError('Failed to connect to signal feed')
      
      // Use fallback demo data
      setSignalSections([
        {
          title: "Market Scanner",
          signals: [
            {
              timestamp: "11:32:45",
              message: "$MOONBURN DETECTED\n• MC: $120K | LP: $25K\n• B/S Ratio: 5.2:1\n• Contract: ✅ SAFU",
              type: "emergency",
              category: "Market Scanner"
            },
            {
              timestamp: "11:31:30",
              message: "$PEPENOMICS LAUNCH\n• MC: $85K | LP: $15K\n• Holders: 125 | Tax: 3/3\n• Risk Level: MEDIUM",
              type: "alert",
              category: "Market Scanner"
            }
          ]
        },
        {
          title: "Whale Tracker",
          signals: [
            {
              timestamp: "11:31:23",
              message: "WALLET: 3J87XYZ\n• Size: 150 SOL ($5000)\n• Token: $MOONBURN (12%)",
              type: "alert",
              category: "Whale Tracker"
            },
            {
              timestamp: "11:30:45",
              message: "WHALE ACCUMULATION\n• 3 Wallets > 500 SOL\n• Target: $PEPENOMICS\n• Pattern: BULLISH",
              type: "emergency",
              category: "Whale Tracker"
            }
          ]
        },
        {
          title: "Social Signals",
          signals: [
            {
              timestamp: "11:33:10",
              message: "$FROGO\n• Twitter: 8,950 (+250%)\n• Sentiment: 78% BULLISH",
              type: "normal",
              category: "Social Signals"
            },
            {
              timestamp: "11:32:00",
              message: "$MOONBURN\n• TG Members: +2500 (15min)\n• Twitter Trend Score: 89\n• Influencer Alert: 3 MAJOR",
              type: "alert",
              category: "Social Signals"
            }
          ]
        },
        {
          title: "Trade Signals",
          signals: [
            { 
              timestamp: "11:40:03", 
              message: "SL HIT\n• $ZOOMPEPE: -30%\n• Balance: $18.50", 
              type: "emergency",
              category: "Trade Signals"
            },
            {
              timestamp: "11:39:15",
              message: "ENTRY SIGNAL\n• Token: $MOONBURN\n• Amount: $5 (20% Capital)\n• Target: +150% (2.5x)",
              type: "alert",
              category: "Trade Signals"
            }
          ]
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch and set up polling
  useEffect(() => {
    fetchSignals()
    const interval = setInterval(fetchSignals, 5000) // Update every 5 seconds
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="border border-green-500 bg-black h-full overflow-hidden relative">
        <h2 className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-green-900/50 to-green-800/30 border-b border-green-500 px-2 py-0.5 text-xs font-normal flex justify-between items-center">
          <span>SIGNAL FEED</span>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-green-500 font-mono">LOADING...</span>
          </div>
        </h2>
        <div className="absolute top-6 left-0 right-0 bottom-0 flex items-center justify-center">
          <div className="text-center text-gray-500 text-xs">
            Loading signals...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-green-500 bg-black h-full overflow-hidden relative">
      <h2 className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-green-900/50 to-green-800/30 border-b border-green-500 px-2 py-0.5 text-xs font-normal flex justify-between items-center">
        <span>SIGNAL FEED</span>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-green-500 font-mono">●{(stats.totalSignals24h / 1000).toFixed(1)}K 24H</span>
          <span className="text-green-500 font-mono">{stats.accuracy.toFixed(1)}% ACC</span>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${stats.isLive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className={stats.isLive ? 'text-green-400' : 'text-red-400'}>
              {stats.isLive ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </h2>

      <div className="absolute top-6 left-0 right-0 bottom-0 overflow-y-auto p-2 bg-green-500/5 scrollbar-hide">
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 p-2 mb-2 text-red-300 text-xs">
            ⚠️ {error} - Using demo data
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-2">
          {signalSections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="bg-green-500/5 border border-green-500/10 p-1">
              <div className="text-green-500 text-xs mb-1 uppercase tracking-wide">{section.title}</div>
              <div className="h-32 overflow-y-auto scrollbar-hide space-y-1">
                {section.signals.length === 0 ? (
                  <div className="text-center text-gray-500 text-xs py-4">
                    No signals yet...
                  </div>
                ) : (
                  section.signals.map((signal, signalIndex) => (
                    <div
                      key={signalIndex}
                      className={`p-1 text-xs leading-tight ${
                        signal.type === "emergency"
                          ? "bg-red-900/20 text-red-300"
                          : signal.type === "alert"
                            ? "bg-yellow-900/20 text-yellow-300"
                            : "bg-green-900/20 text-green-300"
                      }`}
                    >
                      <span
                        className={`font-bold ${
                          signal.type === "emergency"
                            ? "text-red-500"
                            : signal.type === "alert"
                              ? "text-yellow-500"
                              : "text-green-500"
                        }`}
                      >
                        [{signal.timestamp}]
                      </span>{" "}
                      »{" "}
                      {signal.message.split("\n").map((line, lineIndex) => (
                        <span key={lineIndex}>
                          {line}
                          {lineIndex < signal.message.split("\n").length - 1 && <br />}
                        </span>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
