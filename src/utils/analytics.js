// src/utils/analytics.js
// Pure functions — take Trade[] and return computed stats. No side effects.

/** Core win/loss statistics for a trade array */
export function computeStats(trades) {
  const wins   = trades.filter(t => t.classification === 'win')
  const losses = trades.filter(t => t.classification === 'loss')
  const total  = trades.length
  const winCount  = wins.length
  const lossCount = losses.length

  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0)
  const grossLoss   = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))
  const netPnl      = trades.reduce((s, t) => s + t.pnl, 0)

  const avgWin  = winCount  ? grossProfit / winCount  : 0
  const avgLoss = lossCount ? grossLoss   / lossCount : 0
  const winRate = (winCount + lossCount) > 0 ? winCount / (winCount + lossCount) : 0

  return {
    total,
    winCount,
    lossCount,
    winRate,           // 0–1
    grossProfit,
    grossLoss,
    netPnl,
    avgWin,            // USD
    avgLoss,           // USD, positive number
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    expectancy: winRate * avgWin - (1 - winRate) * avgLoss,
    bestTrade:  wins.length  ? Math.max(...wins.map(t => t.pnl))   : 0,
    worstTrade: losses.length ? Math.min(...losses.map(t => t.pnl)) : 0,
    avgDurationMs: total ? avgDuration(trades) : 0,
  }
}

function avgDuration(trades) {
  const durations = trades
    .filter(t => t.openTime && t.closeTime)
    .map(t => new Date(t.closeTime) - new Date(t.openTime))
  return durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
}

/** P&L and win rate by day of week */
export function computeDayOfWeekBreakdown(trades) {
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const groups = Object.fromEntries(DAYS.map(d => [d, []]))
  for (const t of trades) {
    const day = DAYS[new Date(t.openTime).getUTCDay()]
    groups[day].push(t)
  }
  return Object.fromEntries(DAYS.map(d => [d, computeStats(groups[d])]))
}

/** Hour-of-day × day-of-week entry heatmap (raw recorded time — no timezone conversion) */
export function computeHourHeatmap(trades) {
  const cells = {}
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  for (const t of trades) {
    const d = new Date(t.openTime)
    const hour = d.getUTCHours()
    const day  = DAYS[d.getUTCDay()]
    const key  = `${day}-${hour}`
    if (!cells[key]) cells[key] = { day, hour, count: 0, pnl: 0 }
    cells[key].count++
    cells[key].pnl += t.pnl
  }
  return Object.values(cells)
}

/** P&L, win rate, avg hold time per symbol */
export function computeSymbolBreakdown(trades) {
  const groups = {}
  for (const t of trades) {
    if (!groups[t.symbol]) groups[t.symbol] = []
    groups[t.symbol].push(t)
  }
  return Object.fromEntries(
    Object.entries(groups).map(([sym, grp]) => [sym, {
      ...computeStats(grp),
      symbol: sym,
      avgHoldMs: grp.length ? avgDuration(grp) : 0,
    }])
  )
}

/** Daily P&L keyed by YYYY-MM-DD for monthly calendar view */
export function computeDailyPnl(trades) {
  const days = {}
  for (const t of trades) {
    const day = t.openTime.slice(0, 10)
    days[day] = (days[day] ?? 0) + t.pnl
  }
  return days // { '2024-06-15': 125.50, ... }
}

/**
 * Cumulative profit % series for an account, keyed by date.
 * pct = cumulativePnl / account.initialBalance * 100 (static denominator,
 * matching the static drawdown-floor model used elsewhere for this account type).
 */
export function computeProfitPctSeries(account, trades) {
  const daily = computeDailyPnl(trades)
  const dates = Object.keys(daily).sort()
  let cum = 0
  return dates.map(date => {
    cum += daily[date]
    return { date, pct: (cum / account.initialBalance) * 100 }
  })
}
