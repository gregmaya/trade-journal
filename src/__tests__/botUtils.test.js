import { describe, it, expect } from 'vitest'
import { resolveBotForTrade } from '../utils/botUtils.js'

const bots = [
  { id: 'bot-1', name: 'Alpha', pairMagicNumbers: { EURUSD: [98753], GBPUSD: [12345] } },
  { id: 'bot-2', name: 'Beta',  pairMagicNumbers: { AUDUSD: [99999] } },
]

describe('resolveBotForTrade', () => {
  it('returns { bot, pair } when magicNumber is found in pairMagicNumbers', () => {
    expect(resolveBotForTrade({ magicNumber: 98753 }, bots)).toEqual({ bot: bots[0], pair: 'EURUSD' })
  })

  it('returns the correct pair when magicNumber matches a different pair on the same bot', () => {
    expect(resolveBotForTrade({ magicNumber: 12345 }, bots)).toEqual({ bot: bots[0], pair: 'GBPUSD' })
  })

  it('returns the correct bot when magicNumber is on the second bot', () => {
    expect(resolveBotForTrade({ magicNumber: 99999 }, bots)).toEqual({ bot: bots[1], pair: 'AUDUSD' })
  })

  it('returns null when no bot matches', () => {
    expect(resolveBotForTrade({ magicNumber: 11111 }, bots)).toBeNull()
  })

  it('returns null when trade.magicNumber is null', () => {
    expect(resolveBotForTrade({ magicNumber: null }, bots)).toBeNull()
  })

  it('handles bots with missing pairMagicNumbers field gracefully', () => {
    expect(resolveBotForTrade({ magicNumber: 98753 }, [{ id: 'bot-3', name: 'Gamma' }])).toBeNull()
  })

  it('handles a pair with multiple magic numbers', () => {
    const multi = [{ id: 'b', name: 'Multi', pairMagicNumbers: { EURUSD: [111, 222] } }]
    expect(resolveBotForTrade({ magicNumber: 222 }, multi)).toEqual({ bot: multi[0], pair: 'EURUSD' })
  })
})
