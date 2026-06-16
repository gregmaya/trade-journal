import { describe, it, expect } from 'vitest'
import { applyRules, computeAdherence, DEFAULT_RULES } from '../utils/rules.js'

const mkTrade = (id, openTime, sessionLabel, pnl) => ({
  id, openTime, closeTime: openTime, sessionLabel, pnl,
  classification: pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'be',
  ruleViolations: [], accountId: 'x', platform: 'mt5',
  symbol: 'EURUSD', direction: 'BUY', volume: 0.01,
  commission: 0, swap: 0, pips: 0, rMultiple: null,
  tags: [], notes: '', syncSource: 'mtconnect', syncedAt: openTime,
  strategy: '', tradingViewUrl: '', rating: null,
})

// Three NY session trades on same day — 3rd one violates max_trades_session=2
const T1 = mkTrade('1', '2024-06-17T13:30:00Z', 'new_york', 50)
const T2 = mkTrade('2', '2024-06-17T13:45:00Z', 'new_york', 30)
const T3 = mkTrade('3', '2024-06-17T14:00:00Z', 'new_york', -20)

describe('applyRules — max_trades_session', () => {
  it('flags third trade in same session on same day', () => {
    const result = applyRules([T1, T2, T3], DEFAULT_RULES)
    expect(result[0].ruleViolations).toHaveLength(0)
    expect(result[1].ruleViolations).toHaveLength(0)
    expect(result[2].ruleViolations).toContain('max_trades_session')
  })

  it('does not flag trades in different sessions', () => {
    const L1 = mkTrade('a', '2024-06-17T07:30:00Z', 'london', 50)
    const result = applyRules([T1, T2, L1], DEFAULT_RULES)
    expect(result.every(t => t.ruleViolations.length === 0)).toBe(true)
  })
})

describe('applyRules — max_daily_loss', () => {
  it('flags trade that pushes daily loss over limit', () => {
    const L1 = mkTrade('x', '2024-06-17T10:00:00Z', 'overlap', -200)
    const L2 = mkTrade('y', '2024-06-17T10:30:00Z', 'overlap', -250) // cumulative -450 > 400
    const result = applyRules([L1, L2], DEFAULT_RULES)
    expect(result[0].ruleViolations).toHaveLength(0) // first loss doesn't exceed limit
    expect(result[1].ruleViolations).toContain('max_daily_loss')
  })

  it('does not count wins toward daily loss', () => {
    const W = mkTrade('w', '2024-06-17T10:00:00Z', 'overlap', 1000)
    const L = mkTrade('l', '2024-06-17T10:30:00Z', 'overlap', -300)
    const result = applyRules([W, L], DEFAULT_RULES)
    expect(result[1].ruleViolations).toHaveLength(0) // -300 < 400 limit
  })
})

describe('computeAdherence', () => {
  it('computes adherence rate', () => {
    const trades = applyRules([T1, T2, T3], DEFAULT_RULES)
    const { adherenceRate, violationCount, cleanTrades } = computeAdherence(trades)
    expect(violationCount).toBe(1)
    expect(adherenceRate).toBeCloseTo(2/3)
    expect(cleanTrades).toHaveLength(2)
  })

  it('returns 1.0 adherence for empty array', () => {
    const { adherenceRate } = computeAdherence([])
    expect(adherenceRate).toBe(1)
  })
})
