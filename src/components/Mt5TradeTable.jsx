// src/components/Mt5TradeTable.jsx
// Read-only trade list for a single MT5 account — replaces the old standalone
// Trades tab, now scoped per-account at the bottom of the Dashboard page.
import { Card } from '../utils/theme.jsx'

function TH({ children, T }) {
  return <th style={{ textAlign: 'left', padding: '7px 10px', borderBottom: `0.5px solid ${T.border}`, color: T.hint, fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap' }}>{children}</th>
}
function TD({ children, style = {} }) {
  return <td style={{ padding: '7px 10px', fontSize: 12, ...style }}>{children}</td>
}

function fmtDuration(openTime, closeTime) {
  if (!openTime || !closeTime) return '—'
  const ms = new Date(closeTime) - new Date(openTime)
  const m = Math.round(ms / 60000)
  return m < 60 ? `${m}m` : `${Math.round(m / 60)}h`
}

export function Mt5TradeTable({ trades, T, fmtDollars }) {
  const sorted = [...trades].sort((a, b) => b.openTime.localeCompare(a.openTime))

  return (
    <Card>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <TH T={T}>Date</TH>
              <TH T={T}>Symbol</TH>
              <TH T={T}>Dir</TH>
              <TH T={T}>Volume</TH>
              <TH T={T}>Net P&amp;L</TH>
              <TH T={T}>Outcome</TH>
              <TH T={T}>Duration</TH>
            </tr>
          </thead>
          <tbody>
            {sorted.map(t => (
              <tr key={t.id} style={{ borderBottom: `0.5px solid ${T.border}` }}>
                <TD>{t.openTime?.slice(0, 10)}</TD>
                <TD style={{ fontWeight: 500 }}>{t.symbol}</TD>
                <TD style={{ color: t.direction === 'BUY' ? T.green : T.red, fontWeight: 500 }}>{t.direction === 'BUY' ? '▲ Buy' : '▼ Sell'}</TD>
                <TD style={{ color: T.muted }}>{t.volume}</TD>
                <TD style={{ color: t.pnl >= 0 ? T.green : T.red, fontWeight: 500 }}>{fmtDollars(t.pnl)}</TD>
                <TD style={{ color: t.classification === 'win' ? T.green : T.red }}>{t.classification}</TD>
                <TD style={{ color: T.muted }}>{fmtDuration(t.openTime, t.closeTime)}</TD>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: T.hint, fontSize: 12 }}>No trades for this account yet.</div>
        )}
      </div>
    </Card>
  )
}
