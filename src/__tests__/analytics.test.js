import { describe, it, expect } from 'vitest'
import { computeStats, computeSymbolBreakdown, computeDailyPnl } from '../utils/analytics.js'

const WIN  = { id: '1', pnl: 100, classification: 'win',  sessionLabel: 'new_york', symbol: 'EURUSD', openTime: '2024-06-17T13:30:00Z', closeTime: '2024-06-17T14:00:00Z' }
const LOSS = { id: '2', pnl: -50, classification: 'loss', sessionLabel: 'london',   symbol: 'EURUSD', openTime: '2024-06-17T07:30:00Z', closeTime: '2024-06-17T08:00:00Z' }
const BE   = { id: '3', pnl:  10, classification: 'be',   sessionLabel: 'new_york', symbol: 'GBPUSD', openTime: '2024-06-18T14:00:00Z', closeTime: '2024-06-18T14:30:00Z' }

describe('computeStats', () => {
  it('calculates win rate and P&L', () => {
    const s = computeStats([WIN, LOSS])
    expect(s.winCount).toBe(1)
    expect(s.lossCount).toBe(1)
    expect(s.winRate).toBe(0.5)
    expect(s.netPnl).toBe(50)
    expect(s.avgWin).toBe(100)
    expect(s.avgLoss).toBe(50)
    expect(s.profitFactor).toBe(2)
    expect(s.expectancy).toBe(25) // 0.5*100 - 0.5*50
  })

  it('handles empty array', () => {
    const s = computeStats([])
    expect(s.total).toBe(0)
    expect(s.profitFactor).toBeNull()
  })
})

describe('computeSymbolBreakdown', () => {
  it('groups by symbol', () => {
    const bd = computeSymbolBreakdown([WIN, LOSS, BE])
    expect(bd['EURUSD'].total).toBe(2)
    expect(bd['GBPUSD'].total).toBe(1)
  })
})

describe('computeDailyPnl', () => {
  it('aggregates by date', () => {
    const daily = computeDailyPnl([WIN, LOSS, BE])
    expect(daily['2024-06-17']).toBe(50)   // 100 + (-50)
    expect(daily['2024-06-18']).toBe(10)
  })
})
