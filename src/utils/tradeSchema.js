// src/utils/tradeSchema.js

/**
 * @typedef {Object} Trade
 * @property {string}  id             — MT5 position ticket
 * @property {string}  accountId
 * @property {'mt5'}  platform
 * @property {string}  symbol
 * @property {'BUY'|'SELL'} direction
 * @property {string}  openTime       — ISO8601, UTC
 * @property {string}  closeTime      — ISO8601, UTC
 * @property {number}  openPrice
 * @property {number}  closePrice
 * @property {number}  volume         — lots
 * @property {number}  commission     — USD, negative
 * @property {number}  swap           — USD
 * @property {number}  pnl            — net USD (profit + commission + swap)
 * @property {number}  pips
 * @property {number|null} rMultiple
 * @property {string[]} tags
 * @property {string}  notes
 * @property {'london'|'new_york'|'overlap'|'other'} sessionLabel
 * @property {'win'|'loss'} classification
 * @property {'mtconnect'|'python'|'manual'} syncSource
 * @property {string}  syncedAt       — ISO8601
 * @property {string}  strategy
 * @property {string}  tradingViewUrl
 * @property {number|null} rating
 */

/**
 * Returns the trading session label for a given trade timestamp.
 * Timestamps are stored as the broker's recorded CET wall-clock digits
 * (under a UTC label) and must be read back as-is — no timezone conversion.
 * Session windows below are in that same CET wall-clock time:
 *   London:   03:00–05:00
 *   Overlap:  08:00–09:30
 *   New York: 09:30–11:30
 *
 * @param {string|number} openTimeISO
 * @returns {'london'|'new_york'|'overlap'|'other'}
 */
export function labelSession(openTimeISO) {
  const d = new Date(openTimeISO)
  const h = d.getUTCHours()
  const m = d.getUTCMinutes()
  const total = h * 60 + m

  if (total >= 3 * 60 && total < 5 * 60)            return 'london'
  if (total >= 8 * 60 && total < 9 * 60 + 30)       return 'overlap'
  if (total >= 9 * 60 + 30 && total < 11 * 60 + 30) return 'new_york'
  return 'other'
}

/**
 * Strict binary trade classification — no breakeven bucket.
 * @param {number} pnl
 * @returns {'win'|'loss'}
 */
export function classifyPnl(pnl) {
  return pnl > 0 ? 'win' : 'loss'
}
