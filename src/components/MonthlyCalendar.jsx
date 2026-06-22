// src/components/MonthlyCalendar.jsx
// Props: dailyPnl ({ [YYYY-MM-DD]: number }); year, month (number 1-12); T — theme tokens
export function MonthlyCalendar({ dailyPnl, year, month, T }) {
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDow    = new Date(year, month - 1, 1).getDay() // 0=Sun

  const pad = n => String(n).padStart(2, '0')
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const dd   = pad(i + 1)
    const key  = `${year}-${pad(month)}-${dd}`
    const pnl  = dailyPnl[key]
    return { dd, pnl }
  })

  return (
    <div>
      <h4 style={{ color: T.text, marginBottom: 8 }}>
        {new Date(year, month - 1).toLocaleString('default', { month: 'long' })} {year}
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, color: T.muted, paddingBottom: 4 }}>{d}</div>
        ))}
        {Array.from({ length: firstDow }, (_, i) => <div key={`pad-${i}`} />)}
        {days.map(({ dd, pnl }) => (
          <div key={dd} style={{
            padding: '6px 4px', textAlign: 'center', borderRadius: 4, fontSize: 12,
            background: pnl == null ? 'transparent' : pnl >= 0 ? T.greenBg : T.redBg,
            border: `1px solid ${pnl == null ? T.border : pnl >= 0 ? T.green : T.red}`,
          }}>
            <div style={{ color: T.muted, fontSize: 10 }}>{dd}</div>
            {pnl != null && (
              <div style={{ color: pnl >= 0 ? T.green : T.red, fontSize: 11, fontWeight: 600 }}>
                ${Math.round(pnl)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
