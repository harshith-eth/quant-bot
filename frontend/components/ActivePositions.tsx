"use client"

import { useState } from "react"

interface Position {
  token: string
  mc: string
  entry: string
  size: string
  pl: string
  plType: "profit" | "loss"
  time: string
  action: "TP1" | "MON"
  actionType: "tp-ready" | "monitoring"
}

export default function ActivePositions() {
  const [positions] = useState<Position[]>([
    {
      token: "$MOON",
      mc: "$156K",
      entry: "$0.00002145",
      size: "$8.00",
      pl: "+85%",
      plType: "profit",
      time: "8m",
      action: "TP1",
      actionType: "tp-ready",
    },
    {
      token: "$DOGE2",
      mc: "$178K",
      entry: "$0.00000567",
      size: "$12.00",
      pl: "-8%",
      plType: "loss",
      time: "15m",
      action: "MON",
      actionType: "monitoring",
    },
    {
      token: "$SHIB2",
      mc: "$92K",
      entry: "$0.00000123",
      size: "$7.50",
      pl: "+32%",
      plType: "profit",
      time: "6m",
      action: "MON",
      actionType: "monitoring",
    },
    {
      token: "$ELON",
      mc: "$145K",
      entry: "$0.00003891",
      size: "$15.00",
      pl: "+65%",
      plType: "profit",
      time: "10m",
      action: "TP1",
      actionType: "tp-ready",
    },
    {
      token: "$CHAD",
      mc: "$167K",
      entry: "$0.00005672",
      size: "$9.00",
      pl: "-15%",
      plType: "loss",
      time: "3m",
      action: "MON",
      actionType: "monitoring",
    },
  ])

  return (
    <div className="border border-green-500 bg-black h-full overflow-hidden relative">
      <h2 className="absolute top-0 left-0 right-0 z-10 bg-black border-b border-green-500 px-2 py-1 text-sm font-normal flex justify-between">
        ACTIVE POSITIONS
        <span className="text-green-500 text-xs font-mono">
          <span>{positions.length}/5</span>
        </span>
      </h2>

      <div className="absolute top-8 left-0 right-0 bottom-0 overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-black z-20 border-b border-green-800 px-2 py-1">
          <div className="grid grid-cols-7 gap-2 text-xs font-bold">
            <div>Token</div>
            <div className="text-right">MC</div>
            <div className="text-right">Entry</div>
            <div className="text-right">Size</div>
            <div className="text-right">P/L</div>
            <div className="text-center">Time</div>
            <div className="text-left">TP</div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="h-full overflow-y-auto scrollbar-hide">
          {positions.map((position, index) => (
            <div
              key={index}
              className="grid grid-cols-7 gap-2 items-center px-2 py-1 text-xs border-b border-green-900/20"
            >
              <div className="text-green-500 font-bold">{position.token}</div>
              <div className="text-right">{position.mc}</div>
              <div className="text-right">{position.entry}</div>
              <div className="text-right">{position.size}</div>
              <div className={`text-right ${position.plType === "profit" ? "text-green-500" : "text-red-500"}`}>
                {position.pl}
              </div>
              <div className="text-center text-xs">{position.time}</div>
              <div className="text-left">
                <button
                  className={`px-2 py-0.5 text-xs border ${
                    position.actionType === "tp-ready"
                      ? "bg-green-900/50 border-green-600 text-green-500"
                      : "bg-yellow-900/50 border-yellow-600 text-yellow-500"
                  }`}
                >
                  {position.action}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
