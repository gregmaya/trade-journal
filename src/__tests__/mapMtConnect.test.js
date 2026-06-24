import { describe, it, expect } from 'vitest'
import { mapMtConnectTrade } from '../utils/mapMtConnect.js'

const BASE = {
  Ticket: '123456', Symbol: 'EURUSD', Type: '0',
  OpenTime: '2024.06.15 09:30:00', CloseTime: '2024.06.15 10:00:00',
  OpenPrice: '1.09450', ClosePrice: '1.09500',
  Volume: '0.01', Profit: '5.00', Commission: '-0.70', Swap: '0.00',
}

describe('mapMtConnectTrade', () => {
  it('maps a BUY deal', () => {
    const t = mapMtConnectTrade(BASE, 'fp-001')
    expect(t.id).toBe('123456')
    expect(t.accountId).toBe('fp-001')
    expect(t.platform).toBe('mt5')
    expect(t.direction).toBe('BUY')
    expect(t.symbol).toBe('EURUSD')
    expect(t.openPrice).toBe(1.0945)
    expect(t.commission).toBe(-0.70)
    expect(t.pnl).toBeCloseTo(4.30)
    expect(t.syncSource).toBe('mtconnect')
    expect(t.sessionLabel).toBe('new_york') // 09:30 recorded (CET wall-clock, no conversion)
  })

  it('maps a SELL deal', () => {
    expect(mapMtConnectTrade({ ...BASE, Type: '1' }, 'x').direction).toBe('SELL')
  })

  it('classifies win / loss as strict binary on pnl sign', () => {
    expect(mapMtConnectTrade({ ...BASE, Profit: '100', Commission: '0' }, 'x').classification).toBe('win')
    expect(mapMtConnectTrade({ ...BASE, Profit: '-100', Commission: '0' }, 'x').classification).toBe('loss')
    // profit 5 + commission -20 = -15 -> loss (no breakeven bucket)
    expect(mapMtConnectTrade({ ...BASE, Profit: '5', Commission: '-20' }, 'x').classification).toBe('loss')
  })

  it('parses dot-separated API date', () => {
    const t = mapMtConnectTrade(BASE, 'x')
    expect(t.openTime).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('parses Unix epoch (seconds)', () => {
    const t = mapMtConnectTrade({ ...BASE, OpenTime: 1718454600 }, 'x')
    expect(t.openTime).toMatch(/^2024-/)
  })

  it('handles snake_case fields', () => {
    const snake = {
      ticket: '999', symbol: 'GBPUSD', type: '0',
      open_time: '2024-06-15 13:30:00', close_time: '2024-06-15 14:00:00',
      price_open: '1.2700', price: '1.2750',
      volume: '0.01', profit: '50', commission: '-1', swap: '0',
    }
    const t = mapMtConnectTrade(snake, 'fp-001')
    expect(t.id).toBe('999')
    expect(t.symbol).toBe('GBPUSD')
  })
})
