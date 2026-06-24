// src/components/TradePnlChart.jsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

// Props: trades (Trade[], any order), T (theme tokens)
export function TradePnlChart({ trades, T }) {
  const sorted = [...trades].sort((a, b) => (a.closeTime > b.closeTime ? 1 : -1))
  const data = sorted.map((t, i) => ({ index: i + 1, pnl: t.pnl, symbol: t.symbol, date: t.closeTime?.slice(0, 10) }))

  if (data.length === 0) {
    return (
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.hint, fontSize: 12, background: T.surface, borderRadius: 8 }}>
        No trades yet
      </div>
    )
  }

  return (
    <div style={{ background: T.surface, borderRadius: 8, padding: '12px 8px', height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="index" tick={{ fontSize: 10, fill: T.hint }} tickLine={false} axisLine={{ stroke: T.border }} />
          <YAxis tick={{ fontSize: 10, fill: T.hint }} tickLine={false} axisLine={{ stroke: T.border }} />
          <ReferenceLine y={0} stroke={T.border} />
          <Tooltip
            contentStyle={{ background: T.card, border: `0.5px solid ${T.border2}`, borderRadius: 6, fontSize: 12 }}
            labelFormatter={(i) => `Trade #${i}`}
            formatter={(value, _name, item) => [`$${value.toFixed(2)}`, item.payload.symbol]}
          />
          <Bar dataKey="pnl">
            {data.map((d, i) => (
              <Cell key={i} fill={d.pnl >= 0 ? T.green : T.red} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
