// src/components/SessionChart.jsx
// Props: breakdown — result of computeSessionBreakdown(trades); T — theme tokens
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from 'recharts'

export function SessionChart({ breakdown, T }) {
  const data = ['london', 'overlap', 'new_york', 'other'].map(s => ({
    session: { london: 'London', overlap: 'Overlap', new_york: 'New York', other: 'Other' }[s],
    pnl: breakdown[s]?.netPnl ?? 0,
    winRate: Math.round((breakdown[s]?.winRate ?? 0) * 100),
    trades: breakdown[s]?.total ?? 0,
  }))

  return (
    <div>
      <h4 style={{ color: T.text, marginBottom: 8 }}>P&L by Session</h4>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
          <XAxis dataKey="session" tick={{ fill: T.muted, fontSize: 12 }} />
          <YAxis tickFormatter={v => `$${v}`} tick={{ fill: T.muted, fontSize: 11 }} />
          <Tooltip
            formatter={(val, name) => [name === 'pnl' ? `$${val.toFixed(2)}` : `${val}%`, name === 'pnl' ? 'P&L' : 'Win Rate']}
            contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, color: T.text }}
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
