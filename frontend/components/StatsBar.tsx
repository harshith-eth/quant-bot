export default function StatsBar() {
  return (
    <div className="col-span-4 flex justify-between items-center px-4 py-1 border border-green-500 bg-black h-8 text-sm">
      <div>
        Trades: <span>0</span>/5
      </div>
      <div>
        Win Rate: <span>0</span>%
      </div>
      <div>
        Avg. Profit: <span>0</span>%
      </div>
      <div>
        Drawdown: <span>0</span>%
      </div>
      <div>
        Heat: <span>LOW</span>
      </div>
    </div>
  )
}
