// src/components/DailyBotLog.jsx
// Props: account (with account.bots: string[]), dailyPnl ({[date]: pnl}),
// assignments ({[date]: string[]}), onChange(date, botNames), T
export function DailyBotLog({ account, dailyPnl, assignments = {}, onChange, T }) {
  const bots = account.bots || []
  const dates = Object.keys(dailyPnl).sort((a, b) => b.localeCompare(a))

  if (bots.length === 0) {
    return (
      <div style={{ fontSize: 12, color: T.hint, padding: '8px 0' }}>
        No bots configured for this account — add a `bots` list in accounts.js.
      </div>
    )
  }

  function toggleBot(date, bot) {
    const current = assignments[date] || []
    const next = current.includes(bot) ? current.filter(b => b !== bot) : [...current, bot]
    onChange(date, next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {dates.length === 0 && (
        <div style={{ fontSize: 12, color: T.hint, padding: '8px 0' }}>No trading days yet.</div>
      )}
      {dates.map(date => {
        const assigned = assignments[date] || []
        return (
          <div key={date} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
            background: T.surface, borderRadius: 6,
          }}>
            <span style={{ fontSize: 12, color: T.text, minWidth: 90 }}>{date}</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {bots.map(bot => {
                const active = assigned.includes(bot)
                return (
                  <button key={bot} onClick={() => toggleBot(date, bot)}
                    style={{
                      fontSize: 11, padding: '3px 9px', borderRadius: 4, cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      border: `0.5px solid ${active ? T.indigo : T.border}`,
                      background: active ? T.indigoBg : 'transparent',
                      color: active ? T.indigo : T.hint,
                    }}>
                    {bot}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
