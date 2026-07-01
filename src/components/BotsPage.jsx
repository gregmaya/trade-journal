// src/components/BotsPage.jsx
// Global bot registry — name, tradable pairs, lot size per 100k, strategy
// description placeholder. Replaces the old per-account `bots` list as the
// source of truth for daily bot assignment (see DailyBotLog.jsx).
import { useState } from 'react'
import { T, btn, Card } from '../utils/theme.jsx'

function Modal({ title, onClose, children, footer, width = 560 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: T.card, border: `0.5px solid ${T.border2}`, borderRadius: 'var(--border-radius-lg)', width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: '14px 18px', borderBottom: `0.5px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 500 }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, color: T.hint }}>×</button>
        </div>
        <div style={{ padding: '18px' }}>{children}</div>
        {footer && <div style={{ padding: '12px 18px', borderTop: `0.5px solid ${T.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>{footer}</div>}
      </div>
    </div>
  )
}

const inputStyle = { background: T.surface, color: T.text, border: `0.5px solid ${T.border}`, borderRadius: 4, padding: '6px 9px', fontFamily: 'var(--font-sans)', fontSize: 13, width: '100%', boxSizing: 'border-box' }
const labelStyle = { fontSize: 12, color: T.hint, display: 'block', marginBottom: 4 }

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2) }

const BOT_DEFAULTS = { id: '', name: '', pairs: '', lotSizes: {}, strategyDescription: '', magicNumbers: [] }

// Old bots only had a single lotSizePer100k applied to every pair — seed the
// per-pair map from it once so existing data isn't silently blanked out.
function seedLotSizes(bot) {
  if (!bot) return {}
  if (bot.lotSizes) return bot.lotSizes
  if (bot.lotSizePer100k == null) return {}
  return Object.fromEntries((bot.pairs || []).map(p => [p, bot.lotSizePer100k]))
}

function BotForm({ bot, onSave, onClose }) {
  const [f, setF] = useState({
    ...BOT_DEFAULTS,
    ...(bot ? { ...bot, pairs: (bot.pairs || []).join(', '), lotSizes: seedLotSizes(bot), magicNumbers: bot.magicNumbers ?? [] } : {}),
  })
  const s = (k, v) => setF(p => ({ ...p, [k]: v }))
  const canSave = f.name.trim().length > 0
  const parsedPairs = f.pairs.split(',').map(p => p.trim()).filter(Boolean)

  function setLotSize(pair, value) {
    setF(p => ({ ...p, lotSizes: { ...p.lotSizes, [pair]: value === '' ? null : +value } }))
  }

  function addMagicNumber(input) {
    const n = parseInt(input, 10)
    if (!isNaN(n) && !f.magicNumbers.includes(n)) {
      s('magicNumbers', [...f.magicNumbers, n])
    }
  }

  function removeMagicNumber(n) {
    s('magicNumbers', f.magicNumbers.filter(x => x !== n))
  }

  function handleSave() {
    onSave({
      id: f.id || uid(),
      name: f.name.trim(),
      pairs: parsedPairs,
      lotSizes: Object.fromEntries(parsedPairs.map(p => [p, f.lotSizes[p] ?? null])),
      strategyDescription: f.strategyDescription,
      magicNumbers: f.magicNumbers,
    })
  }

  return (
    <Modal title={f.id && bot ? 'Edit bot' : 'Add bot'} onClose={onClose}
      footer={<>
        <button style={btn('ghost')} onClick={onClose}>Cancel</button>
        <button style={btn()} disabled={!canSave} onClick={handleSave}>Save</button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={labelStyle}>Name</label>
          <input style={inputStyle} value={f.name} onChange={e => s('name', e.target.value)} placeholder="e.g. Forex Bank" />
        </div>
        <div>
          <label style={labelStyle}>Pairs (comma-separated)</label>
          <input style={inputStyle} value={f.pairs} onChange={e => s('pairs', e.target.value)} placeholder="e.g. EURUSD, GBPUSD" />
        </div>
        {parsedPairs.length > 0 && (
          <div>
            <label style={labelStyle}>Lot size per pair (per 100k account)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {parsedPairs.map(pair => (
                <div key={pair} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: T.hint, minWidth: 80 }}>{pair}</span>
                  <input style={inputStyle} type="number" step="0.01" min="0"
                    value={f.lotSizes[pair] ?? ''}
                    onChange={e => setLotSize(pair, e.target.value)}
                    placeholder="e.g. 1.0" />
                </div>
              ))}
            </div>
          </div>
        )}
        <div>
          <label style={labelStyle}>Strategy description</label>
          <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={f.strategyDescription} onChange={e => s('strategyDescription', e.target.value)} placeholder="Placeholder — describe the bot's strategy here." />
        </div>
        <div>
          <label style={labelStyle}>Magic Numbers</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
            {f.magicNumbers.map(n => (
              <span key={n} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: T.surface, border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 4 }}>
                {n}
                <button onClick={() => removeMagicNumber(n)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1, color: T.hint, padding: 0 }}>×</button>
              </span>
            ))}
          </div>
          <input
            style={inputStyle}
            type="number"
            placeholder="Type a magic number and press Enter"
            onKeyDown={e => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                addMagicNumber(e.target.value.trim())
                e.target.value = ''
                e.preventDefault()
              }
            }}
          />
        </div>
      </div>
    </Modal>
  )
}

export function BotsPage({ bots, onSave, onDelete }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editBot, setEditBot] = useState(null)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 18, fontWeight: 600 }}>Bots</span>
        <button style={btn()} onClick={() => { setEditBot(null); setModalOpen(true) }}>+ Add bot</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
        {bots.map(bot => (
          <Card key={bot.id} style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{bot.name}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={{ ...btn('ghost'), padding: '3px 8px', fontSize: 11 }} onClick={() => { setEditBot(bot); setModalOpen(true) }}>Edit</button>
                <button style={{ ...btn('danger'), padding: '3px 8px', fontSize: 11 }} onClick={() => onDelete(bot.id)}>Delete</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {(bot.pairs || []).map(p => (
                <span key={p} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: T.indigoBg, color: T.indigo }}>{p}</span>
              ))}
              {(bot.pairs || []).length === 0 && <span style={{ fontSize: 11, color: T.hint }}>No pairs set</span>}
            </div>
            {(bot.magicNumbers ?? []).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                {bot.magicNumbers.map(n => (
                  <span key={n} style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, background: T.surface, border: `0.5px solid ${T.border}`, color: T.hint }}>
                    #{n}
                  </span>
                ))}
              </div>
            )}
            <div style={{ fontSize: 12, color: T.hint, marginBottom: 8 }}>
              {(() => {
                const lotSizes = seedLotSizes(bot)
                const entries = (bot.pairs || []).map(p => [p, lotSizes[p]]).filter(([, v]) => v != null)
                return entries.length > 0
                  ? entries.map(([p, v]) => `${p}: ${v}`).join(' · ')
                  : 'No lot sizes set'
              })()}
            </div>
            <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
              {bot.strategyDescription || 'No strategy description yet.'}
            </div>
          </Card>
        ))}
        {bots.length === 0 && (
          <Card style={{ padding: 60, textAlign: 'center', gridColumn: '1/-1' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🤖</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>No bots yet</div>
            <div style={{ fontSize: 12, color: T.hint, marginTop: 4 }}>Click "+ Add bot" to register one</div>
          </Card>
        )}
      </div>
      {modalOpen && (
        <BotForm bot={editBot} onSave={b => { onSave(b); setModalOpen(false) }} onClose={() => setModalOpen(false)} />
      )}
    </div>
  )
}
