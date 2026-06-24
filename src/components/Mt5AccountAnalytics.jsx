// src/components/Mt5AccountAnalytics.jsx
// Per-account analytics drill-down for a single MT5 account — shown when an
// account card in CrossAccountDashboard is clicked, or via the Dashboard's
// single-select account picker.
import { useState } from 'react'
import {
  computeStats, computeSymbolBreakdown,
  computeHourHeatmap, computeDailyPnl,
} from '../utils/analytics.js'
import { SymbolTable } from './SymbolTable.jsx'
import { HeatmapChart } from './HeatmapChart.jsx'
import { MonthlyCalendar } from './MonthlyCalendar.jsx'
import { DailyBotLog } from './DailyBotLog.jsx'
import { Mt5TradeTable } from './Mt5TradeTable.jsx'
import { TradePnlChart } from './TradePnlChart.jsx'

function HeroMetric({ label, value, color, T }) {
  return (
    <div style={{ background: T.surface, borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: T.hint, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 500, color: color ?? T.text }}>{value}</div>
    </div>
  )
}

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

function daysSince(dateStr) {
  if (!dateStr) return null
  const ms = Date.now() - new Date(dateStr).getTime()
  return Math.max(0, Math.floor(ms / 86400000))
}

const SECTIONS = [
  ['analytics', 'Detailed Analytics'],
  ['symbols', 'Symbol Breakdown'],
  ['heatmap', 'Heatmap'],
  ['calendar', 'Calendar'],
  ['bots', 'Daily Bot Log'],
  ['trades', 'Trades'],
]

export function Mt5AccountAnalytics({ account, trades, T, fmtDollars, dailyBotAssignments = {}, onAssignBots, onBulkAssignBots, bots = [] }) {
  const stats = computeStats(trades)
  const symbolBreakdown = computeSymbolBreakdown(trades)
  const heatmapCells = computeHourHeatmap(trades)
  const dailyPnl = computeDailyPnl(trades)

  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1)
  const [activeSection, setActiveSection] = useState('analytics')

  const pnl = trades.reduce((s, t) => s + t.pnl, 0)
  const balance = account.initialBalance + pnl
  const pctProfit = account.initialBalance ? (pnl / account.initialBalance) * 100 : 0

  const ageLabel = account.deprecated
    ? `Survived ${account.daysSurvived ?? '—'} days · reached stage ${account.stageAtDeprecation ?? '—'}`
    : `${daysSince(account.openedDate) ?? '—'} days since opening`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 500, color: T.text }}>{account.label}</div>
          <div style={{ fontSize: 12, color: T.hint }}>#{account.login}</div>
          <div style={{ fontSize: 12, color: T.hint }}>{account.propFirm} · {account.botName}</div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600, color: T.indigo, background: T.indigoBg,
          padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          Phase {account.phase}
        </span>
      </div>

      {/* Pinned hero row — always visible regardless of active section */}
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
          <HeroMetric label="Balance" value={fmtDollars(balance)} T={T} />
          <HeroMetric label="Profit $" value={fmtDollars(pnl)} color={pnl >= 0 ? T.green : T.red} T={T} />
          <HeroMetric label="% Profit" value={`${pctProfit.toFixed(1)}%`} color={pnl >= 0 ? T.green : T.red} T={T} />
          <HeroMetric label="Win Rate" value={stats.total > 0 ? `${Math.round(stats.winRate * 100)}%` : '—'} color={stats.winRate >= 0.5 ? T.green : T.red} T={T} />
        </div>
        <div style={{ fontSize: 11, color: T.hint, marginTop: 8 }}>{ageLabel}</div>
      </div>

      {trades.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: T.hint, fontSize: 13 }}>
          No trades imported for this account yet.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 20 }}>
          {/* Side menu */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 150, flexShrink: 0 }}>
            {SECTIONS.map(([key, label]) => (
              <button key={key} onClick={() => setActiveSection(key)}
                style={{
                  textAlign: 'left', background: activeSection === key ? T.surface : 'transparent',
                  border: 'none', borderRadius: 6, padding: '8px 10px', fontSize: 12,
                  fontFamily: 'var(--font-sans)', cursor: 'pointer',
                  color: activeSection === key ? T.text : T.hint,
                  fontWeight: activeSection === key ? 500 : 400,
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* Active section content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {activeSection === 'analytics' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                  <Metric label="Total Trades" value={stats.total} T={T} />
                  <Metric label="Profit Factor" value={stats.profitFactor != null ? stats.profitFactor.toFixed(2) : '—'} T={T} />
                  <Metric label="Avg Win" value={fmtDollars(stats.avgWin)} color={T.green} T={T} />
                  <Metric label="Avg Loss" value={fmtDollars(-stats.avgLoss)} color={T.red} T={T} />
                  <Metric label="Expectancy" value={fmtDollars(stats.expectancy)} T={T} />
                  <Metric label="Best Trade" value={fmtDollars(stats.bestTrade)} color={T.green} T={T} />
                  <Metric label="Worst Trade" value={fmtDollars(stats.worstTrade)} color={T.red} T={T} />
                  <Metric label="Avg Duration" value={fmtMs(stats.avgDurationMs)} T={T} />
                </div>
                <TradePnlChart trades={trades} T={T} />
              </div>
            )}
            {activeSection === 'symbols' && <SymbolTable breakdown={symbolBreakdown} T={T} />}
            {activeSection === 'heatmap' && <HeatmapChart cells={heatmapCells} T={T} />}
            {activeSection === 'calendar' && (
              <div>
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
            )}
            {activeSection === 'bots' && (
              <DailyBotLog bots={bots} dailyPnl={dailyPnl} assignments={dailyBotAssignments} onChange={onAssignBots} onBulkAssign={onBulkAssignBots} T={T} />
            )}
            {activeSection === 'trades' && <Mt5TradeTable trades={trades} T={T} fmtDollars={fmtDollars} />}
          </div>
        </div>
      )}
    </div>
  )
}
