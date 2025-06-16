"use client"

import { useState } from "react"

interface Signal {
  timestamp: string
  message: string
  type: "normal" | "alert" | "emergency"
}

interface SignalSection {
  title: string
  signals: Signal[]
}

export default function SignalFeed() {
  const [signalSections] = useState<SignalSection[]>([
    {
      title: "Market Scanner",
      signals: [
        {
          timestamp: "11:32:45",
          message: "$MOONBURN DETECTED\n• MC: $120K | LP: $25K\n• B/S Ratio: 5.2:1\n• Contract: ✅ SAFU",
          type: "emergency",
        },
        {
          timestamp: "11:31:30",
          message: "$PEPENOMICS LAUNCH\n• MC: $85K | LP: $15K\n• Holders: 125 | Tax: 3/3\n• Risk Level: MEDIUM",
          type: "alert",
        },
      ],
    },
    {
      title: "Whale Tracker",
      signals: [
        {
          timestamp: "11:31:23",
          message: "WALLET: 3J87XYZ\n• Size: 150 SOL ($5000)\n• Token: $MOONBURN (12%)",
          type: "alert",
        },
        {
          timestamp: "11:30:45",
          message: "WHALE ACCUMULATION\n• 3 Wallets > 500 SOL\n• Target: $PEPENOMICS\n• Pattern: BULLISH",
          type: "emergency",
        },
      ],
    },
    {
      title: "Social Signals",
      signals: [
        {
          timestamp: "11:33:10",
          message: "$FROGO\n• Twitter: 8,950 (+250%)\n• Sentiment: 78% BULLISH",
          type: "normal",
        },
        {
          timestamp: "11:32:00",
          message: "$MOONBURN\n• TG Members: +2500 (15min)\n• Twitter Trend Score: 89\n• Influencer Alert: 3 MAJOR",
          type: "alert",
        },
      ],
    },
    {
      title: "Trade Signals",
      signals: [
        { timestamp: "11:40:03", message: "SL HIT\n• $ZOOMPEPE: -30%\n• Balance: $18.50", type: "emergency" },
        {
          timestamp: "11:39:15",
          message: "ENTRY SIGNAL\n• Token: $MOONBURN\n• Amount: $5 (20% Capital)\n• Target: +150% (2.5x)",
          type: "alert",
        },
      ],
    },
  ])

  return (
    <div className="border border-green-500 bg-black h-full overflow-hidden relative">
      <h2 className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-green-900/50 to-green-800/30 border-b border-green-500 px-2 py-1 text-sm font-normal">
        SIGNAL FEED
        <span className="float-right text-green-500 text-xs font-mono">24H: 2.4K » ACC: 92.4% » ALERTS: 18</span>
      </h2>

      <div className="absolute top-8 left-0 right-0 bottom-0 overflow-y-auto p-2 bg-green-500/5 scrollbar-hide">
        <div className="grid grid-cols-2 gap-2">
          {signalSections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="bg-green-500/5 border border-green-500/10 p-1">
              <div className="text-green-500 text-xs mb-1 uppercase tracking-wide">{section.title}</div>
              <div className="h-32 overflow-y-auto scrollbar-hide space-y-1">
                {section.signals.map((signal, signalIndex) => (
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
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
