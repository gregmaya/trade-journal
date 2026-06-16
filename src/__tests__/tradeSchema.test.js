import { describe, it, expect } from 'vitest'
import { labelSession } from '../utils/tradeSchema.js'

// All times in UTC; NY = UTC-4 in summer (EDT)
describe('labelSession', () => {
  it('labels London session (07:30 UTC = 03:30 NY)', () => {
    expect(labelSession('2024-06-15T07:30:00Z')).toBe('london')
  })
  it('labels Overlap (12:30 UTC = 08:30 NY)', () => {
    expect(labelSession('2024-06-15T12:30:00Z')).toBe('overlap')
  })
  it('labels New York (13:30 UTC = 09:30 NY)', () => {
    expect(labelSession('2024-06-15T13:30:00Z')).toBe('new_york')
  })
  it('labels Other outside sessions', () => {
    expect(labelSession('2024-06-15T20:00:00Z')).toBe('other')
  })
})
