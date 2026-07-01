import { describe, it, expect } from 'vitest'
import { resolveBotForTrade } from '../utils/botUtils.js'

const bots = [
  { id: 'bot-1', name: 'Alpha', magicNumbers: [98753, 12345] },
  { id: 'bot-2', name: 'Beta', magicNumbers: [99999] },
]

describe('resolveBotForTrade', () => {
  it('returns the bot whose magicNumbers includes the trade magicNumber', () => {
    expect(resolveBotForTrade({ magicNumber: 98753 }, bots)).toEqual(bots[0])
  })

  it('returns the correct bot when magicNumber matches a second entry', () => {
    expect(resolveBotForTrade({ magicNumber: 12345 }, bots)).toEqual(bots[0])
  })

  it('returns null when no bot matches', () => {
    expect(resolveBotForTrade({ magicNumber: 11111 }, bots)).toBeNull()
  })

  it('returns null when trade.magicNumber is null', () => {
    expect(resolveBotForTrade({ magicNumber: null }, bots)).toBeNull()
  })

  it('handles bots with missing magicNumbers field gracefully', () => {
    const botsNoField = [{ id: 'bot-3', name: 'Gamma' }]
    expect(resolveBotForTrade({ magicNumber: 98753 }, botsNoField)).toBeNull()
  })
})
