import { describe, it, expect } from 'vitest'
import { labelSession } from '../utils/tradeSchema.js'

// Timestamps carry the broker's recorded CET wall-clock digits verbatim
// (under a UTC label) — labelSession reads those digits with no conversion.
describe('labelSession', () => {
  it('labels London session (03:30 recorded)', () => {
    expect(labelSession('2024-06-15T03:30:00Z')).toBe('london')
  })
  it('labels Overlap (08:30 recorded)', () => {
    expect(labelSession('2024-06-15T08:30:00Z')).toBe('overlap')
  })
  it('labels New York (09:30 recorded)', () => {
    expect(labelSession('2024-06-15T09:30:00Z')).toBe('new_york')
  })
  it('labels Other outside sessions', () => {
    expect(labelSession('2024-06-15T20:00:00Z')).toBe('other')
  })
})
