import { describe, it, expect } from 'vitest'
import { mergeTrades, defaultData } from '../storage.js'

describe('mergeTrades', () => {
  it('deduplicates by id', () => {
    const existing = [{ id: 'a', pnl: 10 }, { id: 'b', pnl: 20 }]
    const incoming = [{ id: 'b', pnl: 20 }, { id: 'c', pnl: 30 }]
    const result = mergeTrades(existing, incoming)
    expect(result).toHaveLength(3)
    expect(result.map(t => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('existing trade wins on conflict (preserves manual annotations)', () => {
    const existing = [{ id: 'a', pnl: 10, notes: 'my note' }]
    const incoming = [{ id: 'a', pnl: 10, notes: '' }]
    expect(mergeTrades(existing, incoming)[0].notes).toBe('my note')
  })

  it('handles empty arrays', () => {
    expect(mergeTrades([], [])).toEqual([])
    expect(mergeTrades([{ id: 'x' }], [])).toHaveLength(1)
    expect(mergeTrades([], [{ id: 'y' }])).toHaveLength(1)
  })
})

describe('defaultData', () => {
  it('includes an empty mt5Accounts list for runtime-created accounts', () => {
    expect(defaultData().mt5Accounts).toEqual([])
  })
})
