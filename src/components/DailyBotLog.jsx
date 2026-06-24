// src/components/DailyBotLog.jsx
// Props: bots (global registry [{id, name, ...}]), dailyPnl ({[date]: pnl}),
// assignments ({[date]: string[]} — bot NAMES, not ids), onChange(date, botNames), T
import { useState } from 'react'

export function DailyBotLog({ bots = [], dailyPnl, assignments = {}, onChange, onBulkAssign, T }) {
  const dates = Object.keys(dailyPnl).sort((a, b) => b.localeCompare(a))
  const [selectedDates, setSelectedDates] = useState([])
  const [bulkBot, setBulkBot] = useState(bots[0]?.name ?? '')

  if (bots.length === 0) {
    return (
      <div style={{ fontSize: 12, color: T.hint, padding: '8px 0' }}>
        No bots in the registry yet — add one in the Bots tab.
      </div>
    )
  }

  function toggleBot(date, botName) {
    const current = assignments[date] || []
    const next = current.includes(botName) ? current.filter(b => b !== botName) : [...current, botName]
    onChange(date, next)
  }

  function toggleDateSelected(date) {
    setSelectedDates(prev => prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date])
  }

  function toggleSelectAll() {
    setSelectedDates(prev => prev.length === dates.length ? [] : [...dates])
  }

  function assignToSelected() {
    if (!bulkBot || selectedDates.length === 0) return
    onBulkAssign(selectedDates, bulkBot)
    setSelectedDates([])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {dates.length === 0 && (
        <div style={{ fontSize: 12, color: T.hint, padding: '8px 0' }}>No trading days yet.</div>
      )}
      {dates.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
          background: T.surface, borderRadius: 6, marginBottom: 4,
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.hint, cursor: 'pointer' }}>
            <input type="checkbox" checked={selectedDates.length === dates.length} onChange={toggleSelectAll} />
            Select all
          </label>
          <select value={bulkBot} onChange={e => setBulkBot(e.target.value)}
            style={{ background: T.card, color: T.text, border: `0.5px solid ${T.border}`, borderRadius: 4, padding: '4px 8px', fontFamily: 'var(--font-sans)', fontSize: 12 }}>
            {bots.map(bot => <option key={bot.id} value={bot.name}>{bot.name}</option>)}
          </select>
          <button onClick={assignToSelected} disabled={selectedDates.length === 0}
            style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 4, cursor: selectedDates.length === 0 ? 'default' : 'pointer',
              fontFamily: 'var(--font-sans)', border: `0.5px solid ${T.indigo}`,
              background: selectedDates.length === 0 ? 'transparent' : T.indigoBg,
              color: T.indigo, opacity: selectedDates.length === 0 ? 0.5 : 1,
            }}>
            Assign to selected ({selectedDates.length})
          </button>
        </div>
      )}
      {dates.map(date => {
        const assigned = assignments[date] || []
        return (
          <div key={date} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
            background: T.surface, borderRadius: 6,
          }}>
            <input type="checkbox" checked={selectedDates.includes(date)} onChange={() => toggleDateSelected(date)} />
            <span style={{ fontSize: 12, color: T.text, minWidth: 90 }}>{date}</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {bots.map(bot => {
                const active = assigned.includes(bot.name)
                return (
                  <button key={bot.id} onClick={() => toggleBot(date, bot.name)}
                    style={{
                      fontSize: 11, padding: '3px 9px', borderRadius: 4, cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      border: `0.5px solid ${active ? T.indigo : T.border}`,
                      background: active ? T.indigoBg : 'transparent',
                      color: active ? T.indigo : T.hint,
                    }}>
                    {bot.name}
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
