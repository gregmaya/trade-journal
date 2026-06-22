import { useState } from 'react'
import { computeStats, computeDailyPnl, computeProfitPctSeries } from '../utils/analytics.js'
import { MonthlyCalendar } from './MonthlyCalendar.jsx'
import { CombinedProfitChart } from './CombinedProfitChart.jsx'

// Small local Metric chip — do NOT import KpiCard (it doesn't exist in this codebase)
function Metric({ label, value, color, T }) {
  const resolvedColor = color ?? T.text
  return (
    <div style={{ background: T.surface, borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: T.hint, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: resolvedColor }}>{value}</div>
    </div>
  )
}

export function CrossAccountDashboard({ accounts, allTrades, T, fmtDollars, onSelectAccount }) {
  // Only use MT5-format trades (openTime field distinguishes them from Tradovate)
  const mt5Trades = allTrades.filter(t => t.openTime !== undefined)

  const dailyPnl = computeDailyPnl(mt5Trades)

  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1)

  // Reference lines for the combined chart — derived from the first account's
  // phase/loss percentages, since all current accounts share the same 10%/10%.
  const refAccount = accounts[0]
  const profitPct = refAccount ? refAccount.phaseTargetPct * 100 : null
  const drawdownPct = refAccount ? -refAccount.maxLossPct * 100 : null
  const seriesByAccount = Object.fromEntries(
    accounts.map(acc => [acc.id, computeProfitPctSeries(acc, mt5Trades.filter(t => t.accountId === acc.id))])
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Combined profit % chart */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.hint, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12 }}>Profit % — All Accounts</div>
        <CombinedProfitChart accounts={accounts} seriesByAccount={seriesByAccount} profitPct={profitPct} drawdownPct={drawdownPct} T={T} />
      </div>

      {/* Per-account status cards */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.hint, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>Account Status</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {accounts.map(acc => {
            const trades = mt5Trades.filter(t => t.accountId === acc.id)
            const pnl = trades.reduce((s, t) => s + t.pnl, 0)
            const balance = acc.initialBalance + pnl
            const stats = computeStats(trades)

            // Static drawdown floor — fixed % of initialBalance, never moves with peak balance
            const floor = acc.initialBalance * (1 - acc.maxLossPct)
            const maxLossAmount = acc.initialBalance * acc.maxLossPct
            const ddUsed = Math.max(acc.initialBalance - balance, 0)
            const ddPct = maxLossAmount > 0 ? ddUsed / maxLossAmount : 0

            // Phase target — measured from the current phase's own starting balance
            const gainedSincePhaseStart = balance - acc.phaseStartBalance
            const targetGap = acc.phaseStartBalance * acc.phaseTargetPct
            const targetProgress = targetGap > 0 ? Math.min(Math.max(gainedSincePhaseStart / targetGap, 0), 1) : 0

            const status = gainedSincePhaseStart >= targetGap ? 'passed'
              : ddPct >= 1 ? 'blown'
              : ddPct >= 0.7 ? 'at_risk'
              : pnl < 0 ? 'in_drawdown'
              : 'on_track'

            const statusColors = {
              passed: T.green, on_track: T.indigo,
              in_drawdown: T.yellow, at_risk: T.red, blown: T.red,
            }

            return (
              <div key={acc.id} onClick={() => onSelectAccount(acc.id)}
                style={{ background: T.surface, borderRadius: 8, padding: 14, border: `0.5px solid ${T.border}`, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{acc.label}</div>
                    <div style={{ fontSize: 11, color: T.hint }}>{acc.propFirm} · {acc.botName}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: pnl >= 0 ? T.green : T.red }}>
                      {fmtDollars(pnl)}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.indigo, background: T.indigoBg, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Phase {acc.phase}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: statusColors[status], background: statusColors[status] + '18', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {status.replaceAll('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Profit target progress */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.hint, marginBottom: 3 }}>
                    <span>Profit target</span>
                    <span>{fmtDollars(gainedSincePhaseStart)} / {fmtDollars(targetGap)}</span>
                  </div>
                  <div style={{ height: 5, background: T.border, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${targetProgress * 100}%`, background: T.green, borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                </div>

                {/* Drawdown usage */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.hint, marginBottom: 3 }}>
                    <span>Drawdown used</span>
                    <span>{fmtDollars(ddUsed)} / {fmtDollars(maxLossAmount)}</span>
                  </div>
                  <div style={{ height: 5, background: T.border, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(ddPct * 100, 100)}%`, background: ddPct >= 0.7 ? T.red : T.yellow, borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8, marginTop: 10 }}>
                  <Metric label="Win Rate" value={stats.total > 0 ? `${Math.round(stats.winRate * 100)}%` : '—'} color={stats.winRate >= 0.5 ? T.green : T.red} T={T} />
                  <Metric label="Profit Factor" value={stats.profitFactor != null ? stats.profitFactor.toFixed(2) : '—'} color={stats.profitFactor != null ? (stats.profitFactor >= 1.5 ? T.green : stats.profitFactor >= 1 ? T.yellow : T.red) : T.hint} T={T} />
                  <Metric label="Avg Win" value={fmtDollars(stats.avgWin)} color={T.green} T={T} />
                  <Metric label="Avg Loss" value={fmtDollars(-stats.avgLoss)} color={T.red} T={T} />
                </div>

                <div style={{ fontSize: 11, color: T.hint, marginTop: 8 }}>
                  {trades.length} trades · Balance: {fmtDollars(balance)}
                </div>
              </div>
            )
          })}
          {accounts.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: T.hint, fontSize: 13 }}>
              No accounts configured in accounts.js
            </div>
          )}
        </div>
      </div>

      {/* Combined calendar */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.hint, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>Combined Calendar</div>
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
    </div>
  )
}
