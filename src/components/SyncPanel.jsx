// src/components/SyncPanel.jsx
import { useState, useEffect } from 'react'
import { ACCOUNTS } from '../accounts.js'
import { fetchTrades } from '../connector/mtconnect.js'

// Props: onMerge(trades: Trade[]) — App merges into store + persists; T — theme tokens
export function SyncPanel({ onMerge, T }) {
  const [apiKey, setApiKey]       = useState(() => sessionStorage.getItem('mtc_apikey') || '')
  const [passwords, setPasswords] = useState({})
  const [syncing, setSyncing]     = useState(null)   // accountId | 'all' | null
  const [lastSynced, setLastSynced] = useState({})
  const [errors, setErrors]       = useState({})

  useEffect(() => {
    const restored = {}
    for (const acc of ACCOUNTS) {
      const pw = sessionStorage.getItem(`mtc_pw_${acc.id}`)
      if (pw) restored[acc.id] = pw
    }
    setPasswords(restored)
  }, [])

  function saveApiKey(val) {
    setApiKey(val)
    sessionStorage.setItem('mtc_apikey', val)
  }

  function setPassword(accountId, val) {
    setPasswords(prev => ({ ...prev, [accountId]: val }))
    sessionStorage.setItem(`mtc_pw_${accountId}`, val)
  }

  async function syncOne(account) {
    setErrors(e => ({ ...e, [account.id]: null }))
    setSyncing(account.id)
    try {
      const trades = await fetchTrades(account, { apiKey, investorPasswords: passwords })
      setLastSynced(prev => ({ ...prev, [account.id]: new Date().toISOString() }))
      onMerge(trades)
    } catch (err) {
      setErrors(e => ({ ...e, [account.id]: err.message }))
    } finally {
      setSyncing(null)
    }
  }

  async function syncAll() {
    setSyncing('all')
    for (const acc of ACCOUNTS) {
      await syncOne(acc)
    }
    setSyncing(null)
  }

  const ready = apiKey.length > 0

  return (
    <div style={{ padding: 16, background: T.surface, borderRadius: 8, marginBottom: 16 }}>
      <h3 style={{ color: T.text, marginBottom: 12 }}>MT5 Sync</h3>

      <label style={{ color: T.muted, fontSize: 12, display: 'block', marginBottom: 4 }}>
        mtconnectapi.com API Key
      </label>
      <input type="password" value={apiKey} onChange={e => saveApiKey(e.target.value)}
        placeholder="Paste API key"
        style={{ width: '100%', padding: '6px 10px', background: T.bg, color: T.text,
          border: `1px solid ${T.border}`, borderRadius: 4, marginBottom: 12 }} />

      {ACCOUNTS.map(acc => (
        <div key={acc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ color: T.text, flex: '0 0 140px', fontSize: 13 }}>{acc.label}</span>
          <input type="password" value={passwords[acc.id] || ''}
            onChange={e => setPassword(acc.id, e.target.value)}
            placeholder="Investor password"
            style={{ flex: 1, padding: '5px 8px', background: T.bg, color: T.text,
              border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 12 }} />
          <button onClick={() => syncOne(acc)}
            disabled={!ready || !passwords[acc.id] || syncing !== null}
            style={{ padding: '5px 12px', background: T.indigo, color: '#fff',
              border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12,
              opacity: syncing !== null ? 0.6 : 1 }}>
            {syncing === acc.id ? 'Syncing…' : 'Sync'}
          </button>
          {lastSynced[acc.id] && (
            <span style={{ color: T.muted, fontSize: 11 }}>
              {new Date(lastSynced[acc.id]).toLocaleTimeString()}
            </span>
          )}
          {errors[acc.id] && (
            <span style={{ color: T.red ?? '#f87171', fontSize: 11 }}>{errors[acc.id]}</span>
          )}
        </div>
      ))}

      <button onClick={syncAll} disabled={!ready || syncing !== null}
        style={{ marginTop: 8, padding: '6px 16px', background: T.surface,
          color: T.text, border: `1px solid ${T.border}`, borderRadius: 4,
          cursor: 'pointer', fontSize: 13, opacity: syncing !== null ? 0.6 : 1 }}>
        {syncing === 'all' ? 'Syncing all…' : 'Sync all accounts'}
      </button>
    </div>
  )
}
