// src/components/HeatmapChart.jsx
// Props: cells — result of computeHourHeatmap(trades); T — theme tokens
import React from 'react'

export function HeatmapChart({ cells, T }) {
  const DAYS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const HOURS = Array.from({ length: 24 }, (_, i) => i)

  const cellMap = {}
  for (const c of cells) cellMap[`${c.day}-${c.hour}`] = c

  const maxCount = Math.max(...cells.map(c => c.count), 1)

  return (
    <div>
      <h4 style={{ color: T.text, marginBottom: 8 }}>Entry Heatmap</h4>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `40px repeat(${HOURS.length}, 20px)`, gap: 2 }}>
          {/* Hour headers */}
          <div />
          {HOURS.map(h => (
            <div key={h} style={{ fontSize: 9, color: T.muted, textAlign: 'center' }}>
              {h % 3 === 0 ? h : ''}
            </div>
          ))}
          {/* Rows */}
          {DAYS.map(day => (
            <React.Fragment key={day}>
              <div style={{ fontSize: 11, color: T.muted, display: 'flex', alignItems: 'center' }}>
                {day}
              </div>
              {HOURS.map(h => {
                const c = cellMap[`${day}-${h}`]
                const opacity = c ? 0.15 + 0.85 * (c.count / maxCount) : 0.1
                const color = c ? (c.pnl >= 0 ? T.green : T.red) : T.border
                return (
                  <div key={h} title={c ? `${c.count} trades, $${c.pnl.toFixed(0)}` : ''}
                    style={{ width: 20, height: 20, borderRadius: 2, background: color, opacity }} />
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
