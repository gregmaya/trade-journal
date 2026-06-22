// src/components/Mt5AccountAnalytics.jsx
// Per-account analytics drill-down for a single MT5 account — shown when an
// account card in CrossAccountDashboard is clicked.
import { useState } from 'react'
import {
  computeStats, computeSymbolBreakdown,
  computeHourHeatmap, computeDailyPnl,
} from '../utils/analytics.js'
import { SymbolTable } from './SymbolTable.jsx'
import { HeatmapChart } from './HeatmapChart.jsx'
import { MonthlyCalendar } from './MonthlyCalendar.jsx'
import { DailyBotLog } from './DailyBotLog.jsx'

function Metric({ label, value, color, T }) {
  return (
    <div style={{ background: T.surface, borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: T.hint, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 500, color: color ?? T.text }}>{value}</div>
    </div>
  )
}

function fmtMs(ms) {
  if (!ms) return '—'
  const m = Math.round(ms / 60000)
  return m < 60 ? `${m}m` : `${Math.round(m / 60)}h`
}

export function Mt5AccountAnalytics({ account, trades, T, fmtDollars, dailyBotAssignments = {}, onAssignBots }) {
  const stats = computeStats(trades)
  const symbolBreakdown = computeSymbolBreakdown(trades)
  const heatmapCells = computeHourHeatmap(trades)
  const dailyPnl = computeDailyPnl(trades)

  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 500, color: T.text }}>{account.label}</div>
          <div style={{ fontSize: 12, color: T.hint }}>{account.propFirm} · {account.botName}</div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600, color: T.indigo, background: T.indigoBg,
          padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          Phase {account.phase}
        </span>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.hint, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>Stats</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
          <Metric label="Total Trades" value={stats.total} T={T} />
          <Metric label="Win Rate" value={stats.total > 0 ? `${Math.round(stats.winRate * 100)}%` : '—'} color={stats.winRate >= 0.5 ? T.green : T.red} T={T} />
          <Metric label="Profit Factor" value={stats.profitFactor != null ? stats.profitFactor.toFixed(2) : '—'} T={T} />
          <Metric label="Avg Win" value={fmtDollars(stats.avgWin)} color={T.green} T={T} />
          <Metric label="Avg Loss" value={fmtDollars(-stats.avgLoss)} color={T.red} T={T} />
          <Metric label="Expectancy" value={fmtDollars(stats.expectancy)} T={T} />
          <Metric label="Best Trade" value={fmtDollars(stats.bestTrade)} color={T.green} T={T} />
          <Metric label="Worst Trade" value={fmtDollars(stats.worstTrade)} color={T.red} T={T} />
          <Metric label="Avg Duration" value={fmtMs(stats.avgDurationMs)} T={T} />
        </div>
      </div>

      {trades.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: T.hint, fontSize: 13 }}>
          No trades imported for this account yet.
        </div>
      ) : (
        <>
          <SymbolTable breakdown={symbolBreakdown} T={T} />
          <HeatmapChart cells={heatmapCells} T={T} />

          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: T.hint, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>Calendar</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <select value={calMonth} onChange={e => setCalMonth(Number(e.target.value))}
                style={{ background: T.surface, color: T.text, border: `0.5px solid ${T.border}`, borderRadius: 4, padding: '4px 8px', fontFamily: 'var(--font-sans)', fontSize: 12 }}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
              <select value={calYear} onChange={e => setCalYear(Number(e.target.value))}
                style={{ background: T.surface, color: T.text, border: `0.5px solid ${T.border}`, borderRadius: 4, padding: '4px 8px', fontFamily: 'var(--font-sans)', fontSize: 12 }}>
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <MonthlyCalendar dailyPnl={dailyPnl} year={calYear} month={calMonth} T={T} />
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: T.hint, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>Bots by day</div>
            <DailyBotLog account={account} dailyPnl={dailyPnl} assignments={dailyBotAssignments} onChange={onAssignBots} T={T} />
          </div>
        </>
      )}
    </div>
  )
}
