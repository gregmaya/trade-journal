/**
 * Returns { bot, pair } when trade.magicNumber is found in bot.pairMagicNumbers,
 * or null if the trade has no magic number or no bot-pair mapping matches.
 * @param {import('./tradeSchema.js').Trade} trade
 * @param {Array<{pairMagicNumbers?: Record<string, number[]>}>} bots
 * @returns {{ bot: object, pair: string } | null}
 */
export function resolveBotForTrade(trade, bots) {
  if (trade.magicNumber == null) return null
  for (const bot of bots) {
    const map = bot.pairMagicNumbers ?? {}
    for (const [pair, magics] of Object.entries(map)) {
      if ((magics ?? []).includes(trade.magicNumber)) return { bot, pair }
    }
  }
  return null
}
