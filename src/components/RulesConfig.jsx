// src/components/RulesConfig.jsx
// Props: rules (Rule[]), onChange(rules: Rule[]), T
import { DEFAULT_RULES } from '../utils/rules.js'

export function RulesConfig({ rules, onChange, T }) {
  function updateRule(id, val) {
    onChange(rules.map(r => r.id === id ? { ...r, value: Number(val) } : r))
  }

  return (
    <div style={{ padding: 16, background: T.surface, borderRadius: 8 }}>
      <h4 style={{ color: T.text, marginBottom: 12, fontSize: 13, fontWeight: 500 }}>Personal Rules</h4>
      {rules.map(rule => (
        <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <span style={{ flex: 1, color: T.text, fontSize: 13 }}>{rule.label}</span>
          <input
            type="number"
            value={rule.value}
            min={0}
            onChange={e => updateRule(rule.id, e.target.value)}
            style={{ width: 80, padding: '5px 8px', background: T.bg, color: T.text,
              border: `0.5px solid ${T.border}`, borderRadius: 4, fontSize: 13,
              fontFamily: 'var(--font-sans)' }}
          />
        </div>
      ))}
      <button onClick={() => onChange(DEFAULT_RULES)}
        style={{ marginTop: 4, fontSize: 12, color: T.hint, background: 'none',
          border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-sans)' }}>
        Reset to defaults
      </button>
    </div>
  )
}
