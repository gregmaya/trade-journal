// src/components/Mt5ImportModal.jsx
import { useState, useRef } from 'react'
import { parseMt5XlsxReport } from '../utils/parseMt5Report.js'
import { fmtDollars } from '../utils/compute.js'
import { T, btn, Card } from '../utils/theme.jsx'

// Minimal self-contained modal wrapper (mirrors the Modal() function in App.jsx,
// duplicated here since that one is a local, unexported function).
function Modal({ title, onClose, children, footer, width = 620 }) {
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

function classificationColor(c) {
  return c === 'win' ? T.green : c === 'loss' ? T.red : T.yellow
}

// Props: accounts (ACCOUNTS array from accounts.js — id, label fields), onImport(trades), onClose
export function Mt5ImportModal({ accounts, onImport, onClose }) {
  const [step, setStep] = useState('upload')
  const [parsed, setParsed] = useState([])
  const [accountId, setAccountId] = useState(accounts[0]?.id || '')
  const [drag, setDrag] = useState(false)
  const [parseErr, setParseErr] = useState('')
  const fileRef = useRef()

  function handleFile(file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const trades = parseMt5XlsxReport(e.target.result, accountId)
        if (trades.length === 0) {
          setParseErr('No closed positions found in this report.')
          return
        }
        setParsed(trades)
        setParseErr('')
        setStep('preview')
      } catch (err) {
        setParseErr(err.message || 'Failed to parse file. Make sure it is an MT5 "Save as Report" .xlsx export.')
      }
    }
    reader.onerror = () => setParseErr('Failed to read file.')
    reader.readAsArrayBuffer(file)
  }

  function handleConfirm() {
    onImport(parsed)
  }

  const canUpload = accounts.length > 0 && !!accountId
  const selectedAccount = accounts.find(a => a.id === accountId)

  return (
    <Modal title="Import MT5 Report" onClose={onClose} width={780}
      footer={<>
        <button style={btn('ghost')} onClick={onClose}>Cancel</button>
        {step === 'preview' && (
          <button style={btn()} disabled={parsed.length === 0} onClick={handleConfirm}>
            Import {parsed.length} trade{parsed.length !== 1 ? 's' : ''}
          </button>
        )}
      </>}>
      {step === 'upload' && <>
        <div style={{ marginBottom: 14, padding: 12, background: T.surface, borderRadius: 8, fontSize: 12, lineHeight: 1.7, color: T.muted }}>
          <strong style={{ color: T.text }}>How to export from MT5:</strong><br />
          1. Open the MT5 terminal → Toolbox → History<br />
          2. Right-click → Save as Report<br />
          3. Upload the resulting .xlsx file below
        </div>
        {accounts.length === 0 ? (
          <div style={{ marginBottom: 14, padding: 12, background: T.redBg, borderRadius: 8, fontSize: 13, color: T.red, lineHeight: 1.6 }}>
            <strong>No accounts found.</strong> Add an account to accounts.js before importing trades.
          </div>
        ) : (
          <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: T.text, whiteSpace: 'nowrap' }}>Assign to account</label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)} style={{ flex: 1 }}>
              <option value="">— Select account —</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
        )}
        {parseErr && (
          <div style={{ color: T.red, fontSize: 12, marginBottom: 12, padding: '8px 12px', background: T.redBg, borderRadius: 6 }}>
            {parseErr}
          </div>
        )}
        <div
          style={{ border: `2px dashed ${drag ? T.green : (canUpload ? T.border2 : T.border)}`, borderRadius: 10, padding: '50px 40px', textAlign: 'center', cursor: canUpload ? 'pointer' : 'not-allowed', background: drag ? T.greenBg : 'transparent', transition: 'all 0.15s', opacity: canUpload ? 1 : 0.45 }}
          onDragOver={e => { if (!canUpload) return; e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); if (!canUpload) return; const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onClick={() => { if (canUpload) fileRef.current.click() }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📂</div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Drop xlsx file here or click to browse</div>
          <div style={{ fontSize: 12, color: T.hint }}>{canUpload ? 'MT5 "Save as Report" .xlsx export' : 'Select an account above to continue'}</div>
          <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f) handleFile(f) }} />
        </div>
      </>}
      {step === 'preview' && <>
        <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: T.muted }}>
            <strong style={{ color: T.text }}>{parsed.length}</strong> trade{parsed.length !== 1 ? 's' : ''} parsed
          </span>
          {selectedAccount && (
            <span style={{ marginLeft: 'auto', fontSize: 12, padding: '3px 10px', background: T.surface, borderRadius: 6, color: T.muted }}>
              Account: <strong style={{ color: T.text }}>{selectedAccount.label}</strong>
            </span>
          )}
          <button style={btn('ghost')} onClick={() => setStep('upload')}>← Back</button>
        </div>
        <div style={{ maxHeight: 340, overflow: 'auto', border: `0.5px solid ${T.border}`, borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                {['Date', 'Symbol', 'Dir', 'Volume', 'Net P&L', 'Classification'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '7px 10px', borderBottom: `0.5px solid ${T.border}`, color: T.hint, fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: T.card }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.slice(0, 100).map((t, i) => {
                const c = classificationColor(t.classification)
                return (
                  <tr key={t.id || i} style={{ borderBottom: `0.5px solid ${T.border}` }}>
                    <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{t.openTime?.slice(0, 10) || '—'}</td>
                    <td style={{ padding: '6px 10px', fontWeight: 500 }}>{t.symbol}</td>
                    <td style={{ padding: '6px 10px', color: t.direction === 'BUY' ? T.green : T.red, fontWeight: 500 }}>{t.direction === 'BUY' ? '▲ Buy' : '▼ Sell'}</td>
                    <td style={{ padding: '6px 10px', color: T.muted }}>{t.volume}</td>
                    <td style={{ padding: '6px 10px', color: c, fontWeight: 500 }}>{fmtDollars(t.pnl)}</td>
                    <td style={{ padding: '6px 10px' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: c, background: c + '18', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {t.classification}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {parsed.length > 100 && (
          <div style={{ fontSize: 11, color: T.hint, marginTop: 6 }}>Showing first 100 of {parsed.length}</div>
        )}
      </>}
    </Modal>
  )
}
