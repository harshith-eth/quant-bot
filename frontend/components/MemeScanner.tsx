"use client"

import { useState } from "react"

interface Token {
  name: string
  mc: string
  liq: string
  ratio: string
  ratioType: "positive" | "negative"
  holders: string
  age: string
  topWallet: string
}

interface Opportunity {
  name: string
  score: number
  mc: string
  liq: string
  age: string
  ratio: string
  checks: Array<{ label: string; status: "passed" | "warning" }>
  isHighPotential?: boolean
}

export default function MemeScanner() {
  const [tokens] = useState<Token[]>([
    {
      name: "$PEPE2",
      mc: "$147K",
      liq: "$12K",
      ratio: "5.2:1",
      ratioType: "positive",
      holders: "124",
      age: "2m",
      topWallet: "3.2%",
    },
    {
      name: "$WOJAK",
      mc: "$198K",
      liq: "$23K",
      ratio: "4.1:1",
      ratioType: "positive",
      holders: "89",
      age: "4m",
      topWallet: "4.8%",
    },
    {
      name: "$CHAD",
      mc: "$89K",
      liq: "$8K",
      ratio: "1.2:1",
      ratioType: "negative",
      holders: "45",
      age: "6m",
      topWallet: "8.9%",
    },
    {
      name: "$DOGE3",
      mc: "$167K",
      liq: "$18K",
      ratio: "3.8:1",
      ratioType: "positive",
      holders: "156",
      age: "8m",
      topWallet: "2.9%",
    },
    {
      name: "$SHIB2",
      mc: "$134K",
      liq: "$15K",
      ratio: "4.5:1",
      ratioType: "positive",
      holders: "112",
      age: "10m",
      topWallet: "3.5%",
    },
  ])

  const [opportunities] = useState<Opportunity[]>([
    {
      name: "$PEPE2",
      score: 94,
      mc: "$147K",
      liq: "$12K",
      age: "4m",
      ratio: "5.2:1",
      isHighPotential: true,
      checks: [
        { label: "🔒 LP", status: "passed" },
        { label: "📜 Contract", status: "passed" },
        { label: "👥 Holders", status: "passed" },
        { label: "🐋 Whales", status: "passed" },
        { label: "📈 Trend", status: "passed" },
        { label: "💬 Social", status: "passed" },
      ],
    },
    {
      name: "$WOJAK",
      score: 87,
      mc: "$198K",
      liq: "$23K",
      age: "5m",
      ratio: "4.1:1",
      checks: [
        { label: "🔒 LP", status: "passed" },
        { label: "📜 Contract", status: "passed" },
        { label: "👥 Holders", status: "warning" },
        { label: "🐋 Whales", status: "passed" },
        { label: "📈 Trend", status: "warning" },
        { label: "💬 Social", status: "passed" },
      ],
    },
  ])

  return (
    <div className="border border-green-500 bg-black h-full overflow-hidden relative">
      <h2 className="absolute top-0 left-0 right-0 z-10 bg-black border-b border-green-500 px-2 py-1 text-sm font-normal">
        MEME SCANNER
        <span className="float-right text-green-500 text-xs font-mono">5.2x 3SAFU 8WHALE 2PUMP 4RUG</span>
      </h2>

      <div className="absolute top-8 left-0 right-0 bottom-0 overflow-y-auto p-2 scrollbar-hide">
        {/* Token Stats */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="border border-green-800 p-1">
            <div className="text-green-500 text-xs mb-1">Token Stats</div>
            <div className="text-xs">
              New: <span>47</span>/hr
            </div>
            <div className="text-xs">
              Verified: <span>23</span>%
            </div>
            <div className="text-xs">
              Age: <span>4m 12s</span>
            </div>
          </div>
          <div className="border border-green-800 p-1">
            <div className="text-green-500 text-xs mb-1">Market Stats</div>
            <div className="text-xs">
              Avg MC: $<span>154K</span>
            </div>
            <div className="text-xs">
              Avg Vol: $<span>47K</span>
            </div>
            <div className="text-xs">
              Heat: <span className="bg-red-500/20 text-red-500 px-1">HIGH</span>
            </div>
          </div>
        </div>

        {/* Live Token Feed */}
        <div className="mb-3">
          <div className="text-green-500 text-xs mb-1">Live Token Feed</div>
          <div className="grid grid-cols-7 gap-1 text-xs text-green-600 mb-1 px-1">
            <div>Token</div>
            <div className="text-right">MC</div>
            <div className="text-right">Liq</div>
            <div className="text-center">B/S</div>
            <div className="text-right">Holders</div>
            <div className="text-center">Age</div>
            <div className="text-right">Top</div>
          </div>
          <div className="max-h-32 overflow-y-auto scrollbar-hide">
            {tokens.map((token, index) => (
              <div
                key={index}
                className="grid grid-cols-7 gap-1 items-center px-1 py-0.5 text-xs border-b border-green-900/20"
              >
                <div className="text-green-500">{token.name}</div>
                <div className="text-right">{token.mc}</div>
                <div className="text-right">{token.liq}</div>
                <div className={`text-center ${token.ratioType === "positive" ? "text-green-500" : "text-red-500"}`}>
                  {token.ratio}
                </div>
                <div className="text-right">{token.holders}</div>
                <div className="text-center">{token.age}</div>
                <div className="text-right">{token.topWallet}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Best Opportunities */}
        <div className="mb-3">
          <div className="text-green-500 text-xs mb-1">Current Best Opportunities</div>
          <div className="max-h-40 overflow-y-auto scrollbar-hide space-y-2">
            {opportunities.map((opp, index) => (
              <div
                key={index}
                className={`p-2 border ${opp.isHighPotential ? "border-green-500 bg-green-500/5" : "border-green-800 bg-green-500/2"}`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-green-500 text-xs font-bold">{opp.name}</span>
                  <span className="text-green-500 text-xs border border-green-600 px-1">{opp.score}/100</span>
                </div>
                <div className="grid grid-cols-4 gap-1 mb-1 text-xs">
                  <div>MC: {opp.mc}</div>
                  <div>Liq: {opp.liq}</div>
                  <div>Age: {opp.age}</div>
                  <div className="text-green-500">B/S: {opp.ratio}</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {opp.checks.map((check, checkIndex) => (
                    <span
                      key={checkIndex}
                      className={`text-xs px-1 border ${
                        check.status === "passed"
                          ? "border-green-600 text-green-500 bg-green-500/10"
                          : "border-yellow-600 text-yellow-500 bg-yellow-500/10"
                      }`}
                    >
                      {check.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Entry Criteria */}
        <div className="border border-red-800 p-2 mb-2">
          <div className="text-red-500 text-xs mb-1">STRICT ENTRY CRITERIA:</div>
          <div className="space-y-0.5 text-xs">
            <div className="text-green-500">✓ MC {"<"} $200K</div>
            <div className="text-green-500">✓ Liq $5K-$50K</div>
            <div className="text-green-500">✓ Buy/Sell {">"} 4:1</div>
            <div className="text-green-500">✓ {"<"} 15min old</div>
            <div className="text-green-500">✓ Liquidity Burned</div>
            <div className="text-green-500">✓ Contract Safe</div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-xs text-gray-400">
          <div>Blocks Scanned: 304,085,543</div>
          <div>
            Last Update: <span>2s ago</span>
          </div>
        </div>
      </div>
    </div>
  )
}
