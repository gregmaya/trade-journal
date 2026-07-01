/**
 * Returns the bot whose magicNumbers array includes trade.magicNumber,
 * or null if the trade has no magic number or no bot is mapped.
 * @param {import('./tradeSchema.js').Trade} trade
 * @param {Array<{magicNumbers?: number[]}>} bots
 * @returns {object|null}
 */
export function resolveBotForTrade(trade, bots) {
  if (trade.magicNumber == null) return null
  return bots.find(b => (b.magicNumbers ?? []).includes(trade.magicNumber)) ?? null
}
