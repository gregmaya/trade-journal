import { useState, useMemo } from 'react'
import { T, Card } from '../utils/theme.jsx'
import { BotsPage } from './BotsPage.jsx'
import { resolveBotForTrade } from '../utils/botUtils.js'
import { computeStats, computeCumulativePctSeries } from '../utils/analytics.js'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const BOT_COLOURS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export function BotsAnalyticsPage({ bots, trades, accounts, onSaveBot, onDeleteBot }) {
  const [selectedId, setSelectedId] = useState('overview')

  // Group trades by bot
  const { tradesByBot, botsWithTrades, botsWithoutTrades } = useMemo(() => {
    const map = {}
    for (const t of trades) {
      const bot = resolveBotForTrade(t, bots)
      if (!bot) continue
      if (!map[bot.id]) map[bot.id] = []
      map[bot.id].push(t)
    }
    return {
      tradesByBot: map,
      botsWithTrades: bots.filter(b => map[b.id]?.length > 0),
      botsWithoutTrades: bots.filter(b => !map[b.id]?.length),
    }
  }, [trades, bots])

  const sidebarItemStyle = (active) => ({
    padding: '7px 12px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 500 : 400,
    background: active ? T.indigoBg : 'transparent',
    color: active ? T.indigo : T.text,
    border: 'none',
    width: '100%',
    textAlign: 'left',
    display: 'block',
  })

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      {/* Sidebar */}
      <aside style={{ width: 180, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button style={sidebarItemStyle(selectedId === 'overview')} onClick={() => setSelectedId('overview')}>
          Overview
        </button>
        {botsWithTrades.length > 0 && (
          <div style={{ fontSize: 10, color: T.hint, padding: '10px 12px 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Bots
          </div>
        )}
        {botsWithTrades.map(bot => (
          <button key={bot.id} style={sidebarItemStyle(selectedId === bot.id)} onClick={() => setSelectedId(bot.id)}>
            {bot.name}
          </button>
        ))}
        {botsWithoutTrades.map(bot => (
          <button key={bot.id}
            style={{ ...sidebarItemStyle(selectedId === bot.id), color: T.hint }}
            onClick={() => setSelectedId(bot.id)}>
            {bot.name}
          </button>
        ))}
        <div style={{ marginTop: 24, paddingTop: 12, borderTop: `0.5px solid ${T.border}` }}>
          <button style={sidebarItemStyle(selectedId === 'manage')} onClick={() => setSelectedId('manage')}>
            Manage Bots
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {selectedId === 'overview' && (
          <OverviewView botsWithTrades={botsWithTrades} tradesByBot={tradesByBot} accounts={accounts} />
        )}
        {selectedId === 'manage' && (
          <BotsPage bots={bots} onSave={onSaveBot} onDelete={onDeleteBot} />
        )}
        {selectedId !== 'overview' && selectedId !== 'manage' && (() => {
          const bot = bots.find(b => b.id === selectedId)
          if (!bot) return null
          return (
            <BotDetailView
              bot={bot}
              trades={tradesByBot[bot.id] ?? []}
              accounts={accounts}
            />
          )
        })()}
      </div>
    </div>
  )
}

// ─── Overview ────────────────────────────────────────────────────────────────

function OverviewView({ botsWithTrades, tradesByBot, accounts }) {
  // Build multi-bot equity curve data for Recharts
  const equityData = useMemo(() => {
    if (botsWithTrades.length === 0) return []
    // Compute per-bot series
    const seriesMap = {}
    for (const bot of botsWithTrades) {
      const series = computeCumulativePctSeries(tradesByBot[bot.id] ?? [], accounts)
      seriesMap[bot.id] = Object.fromEntries(series.map(p => [p.date, p.pct]))
    }
    // Collect all dates (reuse seriesMap instead of recomputing)
    const allDates = [...new Set(
      botsWithTrades.flatMap(bot => Object.keys(seriesMap[bot.id] ?? {}))
    )].sort()
    // Forward-fill each bot's value across all dates
    const result = []
    const lastVal = Object.fromEntries(botsWithTrades.map(b => [b.id, 0]))
    for (const date of allDates) {
      const entry = { date }
      for (const bot of botsWithTrades) {
        if (seriesMap[bot.id][date] !== undefined) lastVal[bot.id] = seriesMap[bot.id][date]
        entry[bot.id] = lastVal[bot.id]
      }
      result.push(entry)
    }
    return result
  }, [botsWithTrades, tradesByBot, accounts])

  if (botsWithTrades.length === 0) {
    return (
      <Card style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>No bot trades yet</div>
        <div style={{ fontSize: 12, color: T.hint, marginTop: 4 }}>
          Import a QuantAnalyzer CSV and map magic numbers to bots to see analytics here.
        </div>
      </Card>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary table */}
      <Card style={{ padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Bot Comparison</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `0.5px solid ${T.border}` }}>
                {['Bot', 'Trades', 'Win Rate', 'Net % Return', 'Avg % / Trade', 'Profit Factor', 'Best Day %', 'Worst Day %'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Bot' ? 'left' : 'right', color: T.hint, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const balanceFor = Object.fromEntries(accounts.map(a => [a.id, a.initialBalance]))
                return botsWithTrades
                .map(bot => ({ bot, stats: computeStats(tradesByBot[bot.id] ?? []), botTrades: tradesByBot[bot.id] ?? [] }))
                .sort((a, b) => {
                  const netA = a.botTrades.reduce((s, t) => s + (t.pnl / (balanceFor[t.accountId] ?? 10000)) * 100, 0)
                  const netB = b.botTrades.reduce((s, t) => s + (t.pnl / (balanceFor[t.accountId] ?? 10000)) * 100, 0)
                  return netB - netA
                })
                .map(({ bot, stats, botTrades }, i) => (() => {
                  const netPct = botTrades.reduce((s, t) => s + (t.pnl / (balanceFor[t.accountId] ?? 10000)) * 100, 0)
                  const avgPct = botTrades.length ? netPct / botTrades.length : 0
                  // Best/worst day by %
                  const dayPct = {}
                  for (const t of botTrades) {
                    const d = (t.closeTime ?? '').slice(0, 10)
                    dayPct[d] = (dayPct[d] ?? 0) + (t.pnl / (balanceFor[t.accountId] ?? 10000)) * 100
                  }
                  const dayVals = Object.values(dayPct)
                  const bestDay = dayVals.length ? Math.max(...dayVals) : 0
                  const worstDay = dayVals.length ? Math.min(...dayVals) : 0
                  return (
                    <tr key={bot.id} style={{ borderBottom: `0.5px solid ${T.border}` }}>
                      <td style={{ padding: '8px 10px', fontWeight: 500 }}>{bot.name}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{stats.total}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{(stats.winRate * 100).toFixed(1)}%</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: netPct >= 0 ? T.green : T.red, fontWeight: 500 }}>{netPct.toFixed(2)}%</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: avgPct >= 0 ? T.green : T.red }}>{avgPct.toFixed(3)}%</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{stats.profitFactor != null ? stats.profitFactor.toFixed(2) : '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: T.green }}>{bestDay >= 0 ? '+' : ''}{bestDay.toFixed(2)}%</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: T.red }}>{worstDay.toFixed(2)}%</td>
                    </tr>
                  )
                })())
              })()}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Multi-line equity curve */}
      {equityData.length > 0 && (
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Cumulative % Return</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={equityData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: T.hint }} />
              <YAxis tickFormatter={v => `${v.toFixed(1)}%`} tick={{ fontSize: 11, fill: T.hint }} />
              <Tooltip formatter={(v) => `${v.toFixed(2)}%`} contentStyle={{ background: T.card, border: `0.5px solid ${T.border}`, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {botsWithTrades.map((bot, i) => (
                <Line key={bot.id} type="monotone" dataKey={bot.id} name={bot.name}
                  stroke={BOT_COLOURS[i % BOT_COLOURS.length]} dot={false} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}

// ─── Per-bot detail ───────────────────────────────────────────────────────────

function BotDetailView({ bot, trades, accounts }) {
  const stats = useMemo(() => computeStats(trades), [trades])
  const balanceFor = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a.initialBalance])), [accounts])
  const equitySeries = useMemo(() => computeCumulativePctSeries(trades, accounts), [trades, accounts])

  const netPct = trades.reduce((s, t) => s + (t.pnl / (balanceFor[t.accountId] ?? 10000)) * 100, 0)
  const avgPct = trades.length ? netPct / trades.length : 0
  const avgWinPct = stats.winCount ? trades.filter(t => t.classification === 'win').reduce((s, t) => s + (t.pnl / (balanceFor[t.accountId] ?? 10000)) * 100, 0) / stats.winCount : 0
  const avgLossPct = stats.lossCount ? Math.abs(trades.filter(t => t.classification === 'loss').reduce((s, t) => s + (t.pnl / (balanceFor[t.accountId] ?? 10000)) * 100, 0) / stats.lossCount) : 0
  const bestTradePct = trades.length ? Math.max(...trades.map(t => (t.pnl / (balanceFor[t.accountId] ?? 10000)) * 100)) : 0
  const worstTradePct = trades.length ? Math.min(...trades.map(t => (t.pnl / (balanceFor[t.accountId] ?? 10000)) * 100)) : 0

  const sortedTrades = [...trades].sort((a, b) => new Date(b.closeTime) - new Date(a.closeTime))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header card */}
      <Card style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{bot.name}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {(bot.magicNumbers ?? []).map(n => (
                <span key={n} style={{ fontSize: 11, padding: '1px 7px', borderRadius: 3, background: T.surface, border: `0.5px solid ${T.border}`, color: T.hint }}>#{n}</span>
              ))}
              {(bot.pairs ?? []).map(p => (
                <span key={p} style={{ fontSize: 11, padding: '1px 7px', borderRadius: 3, background: T.indigoBg, color: T.indigo }}>{p}</span>
              ))}
            </div>
          </div>
        </div>
        {bot.strategyDescription && (
          <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6, marginBottom: 12 }}>{bot.strategyDescription}</div>
        )}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Trades', value: stats.total },
            { label: 'Win Rate', value: `${(stats.winRate * 100).toFixed(1)}%` },
            { label: 'Net % Return', value: `${netPct.toFixed(2)}%`, color: netPct >= 0 ? T.green : T.red },
            { label: 'Profit Factor', value: stats.profitFactor != null ? stats.profitFactor.toFixed(2) : '—' },
            { label: 'Expectancy', value: `${avgPct.toFixed(3)}% / trade` },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: T.hint, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: color ?? T.text }}>{value}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Two-column section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Equity curve */}
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Cumulative % Return</div>
          {equitySeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={equitySeries} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: T.hint }} />
                <YAxis tickFormatter={v => `${v.toFixed(1)}%`} tick={{ fontSize: 10, fill: T.hint }} />
                <Tooltip formatter={v => `${v.toFixed(2)}%`} contentStyle={{ background: T.card, border: `0.5px solid ${T.border}`, fontSize: 11 }} />
                <Line type="monotone" dataKey="pct" stroke={BOT_COLOURS[0]} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', color: T.hint, fontSize: 12, paddingTop: 60 }}>No data</div>
          )}
        </Card>

        {/* Breakdown */}
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Breakdown</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Wins', value: stats.winCount, color: T.green },
              { label: 'Losses', value: stats.lossCount, color: T.red },
              { label: 'Avg Win %', value: `${avgWinPct >= 0 ? '+' : ''}${avgWinPct.toFixed(3)}%`, color: T.green },
              { label: 'Avg Loss %', value: `-${avgLossPct.toFixed(3)}%`, color: T.red },
              { label: 'Best Trade %', value: `${bestTradePct >= 0 ? '+' : ''}${bestTradePct.toFixed(2)}%`, color: T.green },
              { label: 'Worst Trade %', value: `${worstTradePct.toFixed(2)}%`, color: T.red },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: T.hint }}>{label}</span>
                <span style={{ fontWeight: 500, color }}>{value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Trade table */}
      <Card style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Trades ({trades.length})</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `0.5px solid ${T.border}` }}>
                {['Date', 'Account', 'Symbol', 'Dir', 'PnL ($)', 'PnL (%)', 'Result'].map(h => (
                  <th key={h} style={{ padding: '5px 8px', textAlign: h === 'Date' || h === 'Account' || h === 'Symbol' || h === 'Dir' ? 'left' : 'right', color: T.hint, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedTrades.map(t => {
                const acct = accounts.find(a => a.id === t.accountId)
                const pct = (t.pnl / (acct?.initialBalance ?? 10000)) * 100
                return (
                  <tr key={t.id} style={{ borderBottom: `0.5px solid ${T.border}` }}>
                    <td style={{ padding: '6px 8px' }}>{(t.closeTime ?? '').slice(0, 10)}</td>
                    <td style={{ padding: '6px 8px', color: T.hint }}>{acct?.label ?? t.accountId}</td>
                    <td style={{ padding: '6px 8px' }}>{t.symbol}</td>
                    <td style={{ padding: '6px 8px', color: t.direction === 'BUY' ? T.green : T.red }}>{t.direction}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: t.pnl >= 0 ? T.green : T.red }}>{t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: pct >= 0 ? T.green : T.red }}>{pct >= 0 ? '+' : ''}{pct.toFixed(3)}%</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: t.classification === 'win' ? T.green : T.red }}>{t.classification}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
