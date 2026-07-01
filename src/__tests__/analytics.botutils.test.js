import { describe, it, expect } from 'vitest'
import { computeCumulativePctSeries } from '../utils/analytics.js'

describe('computeCumulativePctSeries', () => {
  it('returns empty array for no trades', () => {
    expect(computeCumulativePctSeries([], [])).toEqual([])
  })

  it('normalises pnl to account initialBalance', () => {
    const accounts = [{ id: 'acc-1', initialBalance: 10000 }]
    const trades = [
      { accountId: 'acc-1', pnl: 100, closeTime: '2026-06-22T10:00:00Z' },
      { accountId: 'acc-1', pnl: -50, closeTime: '2026-06-23T10:00:00Z' },
    ]
    const result = computeCumulativePctSeries(trades, accounts)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ date: '2026-06-22', pct: 1 })
    expect(result[1]).toEqual({ date: '2026-06-23', pct: 0.5 })
  })

  it('normalises across different account sizes', () => {
    const accounts = [
      { id: 'acc-small', initialBalance: 5000 },
      { id: 'acc-large', initialBalance: 50000 },
    ]
    const trades = [
      { accountId: 'acc-small', pnl: 50,  closeTime: '2026-06-22T10:00:00Z' }, // 1%
      { accountId: 'acc-large', pnl: 500, closeTime: '2026-06-23T10:00:00Z' }, // 1%
    ]
    const result = computeCumulativePctSeries(trades, accounts)
    expect(result[0].pct).toBeCloseTo(1)
    expect(result[1].pct).toBeCloseTo(2)
  })

  it('sorts by closeTime ascending', () => {
    const accounts = [{ id: 'a', initialBalance: 1000 }]
    const trades = [
      { accountId: 'a', pnl: 10, closeTime: '2026-06-23T10:00:00Z' },
      { accountId: 'a', pnl: 10, closeTime: '2026-06-22T10:00:00Z' },
    ]
    const result = computeCumulativePctSeries(trades, accounts)
    expect(result[0].date).toBe('2026-06-22')
    expect(result[1].date).toBe('2026-06-23')
  })

  it('falls back to 10000 if account not found', () => {
    const trades = [
      { accountId: 'unknown', pnl: 100, closeTime: '2026-06-22T10:00:00Z' },
    ]
    const result = computeCumulativePctSeries(trades, [])
    expect(result[0].pct).toBeCloseTo(1)
  })
})
