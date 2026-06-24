// src/components/AccountsPage.jsx
// MT5 account settings/metadata — propFirm, phase/stage, original size, opened
// date — explicitly NOT performance data. Includes the deprecated-accounts
// section: accounts the user has manually retired, with their frozen
// days-survived/stage-reached snapshot still visible.
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

function daysSince(dateStr) {
  if (!dateStr) return null
  const ms = Date.now() - new Date(dateStr).getTime()
  return Math.max(0, Math.floor(ms / 86400000))
}

function AccountMetaForm({ account, onSave, onClose }) {
  const [f, setF] = useState({
    propFirm: account.propFirm || '',
    label: account.label || '',
    phase: account.phase ?? 1,
    initialBalance: account.initialBalance ?? 0,
    maxLossPct: account.maxLossPct ?? 0.10,
    phaseStartBalance: account.phaseStartBalance ?? account.initialBalance ?? 0,
    phaseTargetPct: account.phaseTargetPct ?? 0.10,
    openedDate: account.openedDate || '',
  })
  const s = (k, v) => setF(p => ({ ...p, [k]: v }))

  function handleSave() {
    onSave(account.id, {
      propFirm: f.propFirm.trim(),
      label: f.label.trim(),
      phase: +f.phase,
      initialBalance: +f.initialBalance,
      maxLossPct: +f.maxLossPct,
      phaseStartBalance: +f.phaseStartBalance,
      phaseTargetPct: +f.phaseTargetPct,
      openedDate: f.openedDate || null,
    })
  }

  return (
    <Modal title="Edit account settings" onClose={onClose}
      footer={<>
        <button style={btn('ghost')} onClick={onClose}>Cancel</button>
        <button style={btn()} onClick={handleSave}>Save</button>
      </>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Label</label>
          <input style={inputStyle} value={f.label} onChange={e => s('label', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Prop firm</label>
          <input style={inputStyle} value={f.propFirm} onChange={e => s('propFirm', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Opened date</label>
          <input style={inputStyle} type="date" value={f.openedDate} onChange={e => s('openedDate', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Phase / stage</label>
          <input style={inputStyle} type="number" min="1" value={f.phase} onChange={e => s('phase', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Original account size ($)</label>
          <input style={inputStyle} type="number" value={f.initialBalance} onChange={e => s('initialBalance', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Max loss % (drawdown floor)</label>
          <input style={inputStyle} type="number" step="0.01" value={f.maxLossPct} onChange={e => s('maxLossPct', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Phase start balance ($)</label>
          <input style={inputStyle} type="number" value={f.phaseStartBalance} onChange={e => s('phaseStartBalance', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Phase target %</label>
          <input style={inputStyle} type="number" step="0.01" value={f.phaseTargetPct} onChange={e => s('phaseTargetPct', e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}

function AccountMetaCard({ a, onEdit, onSetDeprecated, muted }) {
  return (
    <Card style={{ padding: 16, opacity: muted ? 0.6 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{a.label}</div>
          <div style={{ fontSize: 12, color: T.hint }}>{a.propFirm || '—'}</div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: T.indigo, background: T.indigoBg, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Phase {a.phase}
        </span>
      </div>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>Original size: {a.initialBalance != null ? `$${a.initialBalance.toLocaleString()}` : '—'}</div>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>
        {a.deprecated
          ? `Survived ${a.daysSurvived ?? '—'} days · reached stage ${a.stageAtDeprecation ?? '—'}`
          : `${daysSince(a.openedDate) ?? '—'} days since opening`}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={{ ...btn('ghost'), padding: '3px 8px', fontSize: 11 }} onClick={() => onEdit(a)}>Edit</button>
        <button style={{ ...btn(a.deprecated ? 'ghost' : 'danger'), padding: '3px 8px', fontSize: 11 }} onClick={() => onSetDeprecated(a.id, !a.deprecated)}>
          {a.deprecated ? 'Restore' : 'Mark deprecated'}
        </button>
      </div>
    </Card>
  )
}

export function AccountsPage({ accounts, onSaveOverride, onSetDeprecated }) {
  const [editingAccount, setEditingAccount] = useState(null)
  const active = accounts.filter(a => !a.deprecated)
  const deprecated = accounts.filter(a => a.deprecated)

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 18, fontWeight: 600 }}>Accounts</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
        {active.map(a => (
          <AccountMetaCard key={a.id} a={a} onEdit={setEditingAccount} onSetDeprecated={onSetDeprecated} />
        ))}
        {active.length === 0 && (
          <Card style={{ padding: 60, textAlign: 'center', gridColumn: '1/-1' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🏦</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>No active accounts</div>
          </Card>
        )}
      </div>

      {deprecated.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: T.hint, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12 }}>Deprecated</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
            {deprecated.map(a => (
              <AccountMetaCard key={a.id} a={a} onEdit={setEditingAccount} onSetDeprecated={onSetDeprecated} muted />
            ))}
          </div>
        </div>
      )}

      {editingAccount && (
        <AccountMetaForm account={editingAccount} onSave={(id, patch) => { onSaveOverride(id, patch); setEditingAccount(null) }} onClose={() => setEditingAccount(null)} />
      )}
    </div>
  )
}
