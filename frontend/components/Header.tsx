"use client"

interface HeaderProps {
  botRunning: boolean
  onStartBot: () => void
  onStopBot: () => void
  currentTime: Date
}

export default function Header({ botRunning, onStartBot, onStopBot, currentTime }: HeaderProps) {
  return (
    <div className="col-span-4 flex justify-between items-center border-b border-green-500 px-3 py-2 h-12 text-sm">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-green-600">Network:</span> SOLANA
        </div>
        <div>
          <span className="text-green-600">Gas:</span>
          <span className="ml-1">0.000012 SOL</span>
        </div>
        <div>
          <span className="text-green-600">24H Vol:</span>
          <span className="ml-1">$5.92B</span>
        </div>
        <div>
          <span className="text-green-600">24H Txns:</span>
          <span className="ml-1">24,758,691</span>
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
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span>SYSTEM ACTIVE</span>
        </div>
        <div>
          <span className="text-green-600">Block:</span>
          <span className="ml-1">304,085,543</span>
          <span className="ml-2 text-green-600">4s ago</span>
        </div>
        <div>{currentTime.toLocaleTimeString()}</div>
      </div>
    </div>
  )
}
