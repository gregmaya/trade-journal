import { useState, useMemo } from 'react'
import { T, Card } from '../utils/theme.jsx'
import { BotsPage } from './BotsPage.jsx'
import { resolveBotForTrade } from '../utils/botUtils.js'
import { computeStats, computeCumulativePctSeries, computeHourHeatmap } from '../utils/analytics.js'
import { HeatmapChart } from './HeatmapChart.jsx'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const BOT_COLOURS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export function BotsAnalyticsPage({ bots, trades, accounts, onSaveBot, onDeleteBot }) {
  const [selectedId, setSelectedId] = useState('overview')

  const { botPairEntries, botsWithoutTrades } = useMemo(() => {
    const byBotPair = {}
    for (const t of trades) {
      const resolved = resolveBotForTrade(t, bots)
      if (!resolved) continue
      const { bot, pair } = resolved
      const key = `${bot.id}:${pair}`
      if (!byBotPair[key]) byBotPair[key] = { bot, pair, trades: [] }
      byBotPair[key].trades.push(t)
    }
    const entries = Object.values(byBotPair)
    const botIdsWithTrades = new Set(entries.map(e => e.bot.id))
    return {
      botPairEntries: entries,
      botsWithoutTrades: bots.filter(b => !botIdsWithTrades.has(b.id)),
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
        {botPairEntries.length > 0 && (
          <div style={{ fontSize: 10, color: T.hint, padding: '10px 12px 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Bots
          </div>
        )}
        {botPairEntries.map(({ bot, pair }) => {
          const key = `${bot.id}:${pair}`
          return (
            <button key={key} style={sidebarItemStyle(selectedId === key)} onClick={() => setSelectedId(key)}>
              {bot.name} / {pair}
            </button>
          )
        })}
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
          <OverviewView botPairEntries={botPairEntries} accounts={accounts} />
        )}
        {selectedId === 'manage' && (
          <BotsPage bots={bots} onSave={onSaveBot} onDelete={onDeleteBot} />
        )}
        {selectedId !== 'overview' && selectedId !== 'manage' && (() => {
          const entry = botPairEntries.find(e => `${e.bot.id}:${e.pair}` === selectedId)
          if (!entry) return null
          return (
            <BotPairDetailView
              bot={entry.bot}
              pair={entry.pair}
              trades={entry.trades}
              accounts={accounts}
            />
          )
        })()}
      </div>
    </div>
  )
}

// ─── Overview ────────────────────────────────────────────────────────────────

function OverviewView({ botPairEntries, accounts }) {
  const equityData = useMemo(() => {
    if (botPairEntries.length === 0) return []
    const seriesMap = {}
    for (const { bot, pair, trades } of botPairEntries) {
      const key = `${bot.id}:${pair}`
      const series = computeCumulativePctSeries(trades, accounts)
      seriesMap[key] = Object.fromEntries(series.map(p => [p.date, p.pct]))
    }
    const allDates = [...new Set(
      botPairEntries.flatMap(({ bot, pair }) => Object.keys(seriesMap[`${bot.id}:${pair}`] ?? {}))
    )].sort()
    const lastVal = Object.fromEntries(botPairEntries.map(({ bot, pair }) => [`${bot.id}:${pair}`, 0]))
    return allDates.map(date => {
      const entry = { date }
      for (const { bot, pair } of botPairEntries) {
        const key = `${bot.id}:${pair}`
        if (seriesMap[key][date] !== undefined) lastVal[key] = seriesMap[key][date]
        entry[key] = lastVal[key]
      }
      return entry
    })
  }, [botPairEntries, accounts])

  if (botPairEntries.length === 0) {
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
      <Card style={{ padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Bot / Pair Comparison</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `0.5px solid ${T.border}` }}>
                {['Bot', 'Pair', 'Trades', 'Win Rate', 'Net % Return', 'Avg % / Trade', 'Profit Factor', 'Best Day %', 'Worst Day %'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Bot' || h === 'Pair' ? 'left' : 'right', color: T.hint, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const balanceFor = Object.fromEntries(accounts.map(a => [a.id, a.initialBalance]))
                return [...botPairEntries]
                  .map(({ bot, pair, trades: t }) => {
                    const stats = computeStats(t)
                    const netPct = t.reduce((s, tr) => s + (tr.pnl / (balanceFor[tr.accountId] ?? 10000)) * 100, 0)
                    const avgPct = t.length ? netPct / t.length : 0
                    const dayPct = {}
                    for (const tr of t) {
                      const d = (tr.closeTime ?? '').slice(0, 10)
                      dayPct[d] = (dayPct[d] ?? 0) + (tr.pnl / (balanceFor[tr.accountId] ?? 10000)) * 100
                    }
                    const dayVals = Object.values(dayPct)
                    return { bot, pair, stats, netPct, avgPct, bestDay: dayVals.length ? Math.max(...dayVals) : 0, worstDay: dayVals.length ? Math.min(...dayVals) : 0 }
                  })
                  .sort((a, b) => b.netPct - a.netPct)
                  .map(({ bot, pair, stats, netPct, avgPct, bestDay, worstDay }) => (
                    <tr key={`${bot.id}:${pair}`} style={{ borderBottom: `0.5px solid ${T.border}` }}>
                      <td style={{ padding: '8px 10px', fontWeight: 500 }}>{bot.name}</td>
                      <td style={{ padding: '8px 10px', color: T.hint }}>{pair}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{stats.total}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{(stats.winRate * 100).toFixed(1)}%</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: netPct >= 0 ? T.green : T.red, fontWeight: 500 }}>{netPct >= 0 ? '+' : ''}{netPct.toFixed(2)}%</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: avgPct >= 0 ? T.green : T.red }}>{avgPct >= 0 ? '+' : ''}{avgPct.toFixed(3)}%</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{stats.profitFactor != null ? stats.profitFactor.toFixed(2) : '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: T.green }}>{bestDay >= 0 ? '+' : ''}{bestDay.toFixed(2)}%</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: T.red }}>{worstDay.toFixed(2)}%</td>
                    </tr>
                  ))
              })()}
            </tbody>
          </table>
        </div>
      </Card>

      {equityData.length > 0 && (
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Cumulative % Return</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={equityData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: T.hint }} />
              <YAxis tickFormatter={v => `${v.toFixed(1)}%`} tick={{ fontSize: 11, fill: T.hint }} />
              <Tooltip formatter={v => `${v.toFixed(2)}%`} contentStyle={{ background: T.card, border: `0.5px solid ${T.border}`, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {botPairEntries.map(({ bot, pair }, i) => (
                <Line key={`${bot.id}:${pair}`} type="monotone" dataKey={`${bot.id}:${pair}`}
                  name={`${bot.name} / ${pair}`}
                  stroke={BOT_COLOURS[i % BOT_COLOURS.length]} dot={false} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}

// ─── Per-bot-pair detail ──────────────────────────────────────────────────────

function BotPairDetailView({ bot, pair, trades, accounts }) {
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
      <Card style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 600 }}>{bot.name}</span>
              <span style={{ fontSize: 13, padding: '2px 10px', borderRadius: 4, background: T.indigoBg, color: T.indigo, fontWeight: 500 }}>{pair}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {(bot.pairMagicNumbers?.[pair] ?? []).map(n => (
                <span key={n} style={{ fontSize: 11, padding: '1px 7px', borderRadius: 3, background: T.surface, border: `0.5px solid ${T.border}`, color: T.hint }}>#{n}</span>
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
            { label: 'Net % Return', value: `${netPct >= 0 ? '+' : ''}${netPct.toFixed(2)}%`, color: netPct >= 0 ? T.green : T.red },
            { label: 'Profit Factor', value: stats.profitFactor != null ? stats.profitFactor.toFixed(2) : '—' },
            { label: 'Expectancy', value: `${avgPct >= 0 ? '+' : ''}${avgPct.toFixed(3)}% / trade` },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: T.hint, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: color ?? T.text }}>{value}</div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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

      <Card style={{ padding: 16 }}>
        <HeatmapChart cells={computeHourHeatmap(trades)} T={T} />
      </Card>

      <Card style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Trades ({trades.length})</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `0.5px solid ${T.border}` }}>
                {['Date', 'Account', 'Dir', 'PnL ($)', 'PnL (%)', 'Result'].map(h => (
                  <th key={h} style={{ padding: '5px 8px', textAlign: h === 'Date' || h === 'Account' || h === 'Dir' ? 'left' : 'right', color: T.hint, fontWeight: 500 }}>{h}</th>
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
