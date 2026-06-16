// src/components/SymbolTable.jsx
// Props: breakdown — result of computeSymbolBreakdown(trades); T — theme tokens
export function SymbolTable({ breakdown, T }) {
  const rows = Object.values(breakdown).sort((a, b) => b.netPnl - a.netPnl)

  const fmtMs = ms => {
    const m = Math.round(ms / 60000)
    return m < 60 ? `${m}m` : `${Math.round(m / 60)}h`
  }

  return (
    <div>
      <h4 style={{ color: T.text, marginBottom: 8 }}>By Symbol</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {['Symbol', 'Trades', 'Win%', 'P&L', 'Avg hold'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: T.muted, fontWeight: 500, borderBottom: `1px solid ${T.border}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.symbol}>
              <td style={{ padding: '4px 8px', color: T.text }}>{r.symbol}</td>
              <td style={{ padding: '4px 8px', color: T.muted }}>{r.total}</td>
              <td style={{ padding: '4px 8px', color: T.muted }}>{Math.round(r.winRate * 100)}%</td>
              <td style={{ padding: '4px 8px', color: r.netPnl >= 0 ? T.green : T.red }}>
                ${r.netPnl.toFixed(2)}
              </td>
              <td style={{ padding: '4px 8px', color: T.muted }}>{fmtMs(r.avgHoldMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
