// src/utils/rules.js
// Applies configurable personal trading rules to a trade array.
// Rules are evaluated at sync time; violations stored on the trade.

/**
 * Default rules matching the brief.
 * Stored in settings (localStorage/JSON file) — user modifies via RulesConfig UI.
 * @type {Array<{id: string, label: string, type: string, value: number}>}
 */
export const DEFAULT_RULES = [
  { id: 'max_trades_session', label: 'Max trades per session', type: 'max_trades_session', value: 2 },
  { id: 'max_daily_loss',     label: 'Max daily loss (USD)',   type: 'max_daily_loss',     value: 400 },
]

/**
 * Tags each trade with any rule violations.
 * Returns a new array — does not mutate input.
 * Trades are processed in chronological order (sorted by openTime).
 * Expects MT5-schema trades with openTime, sessionLabel, and pnl fields.
 *
 * @param {import('./tradeSchema.js').Trade[]} trades
 * @param {Array<{id: string, type: string, value: number}>} rules
 * @returns {import('./tradeSchema.js').Trade[]}
 */
export function applyRules(trades, rules) {
  const sorted = [...trades].sort((a, b) => new Date(a.openTime) - new Date(b.openTime))

  return sorted.map((trade, idx) => {
    const violations = []
    const tradesToHere = sorted.slice(0, idx + 1)

    for (const rule of rules) {
      if (rule.type === 'max_trades_session') {
        const sameSessionSameDay = tradesToHere.filter(t =>
          t.sessionLabel === trade.sessionLabel &&
          t.openTime.slice(0, 10) === trade.openTime.slice(0, 10)
        )
        if (sameSessionSameDay.length > rule.value) {
          violations.push(rule.id)
        }
      }

      if (rule.type === 'max_daily_loss') {
        const sameDay = tradesToHere.filter(t =>
          t.openTime.slice(0, 10) === trade.openTime.slice(0, 10) && t.pnl < 0
        )
        const dayLoss = Math.abs(sameDay.reduce((s, t) => s + t.pnl, 0))
        if (dayLoss > rule.value) {
          violations.push(rule.id)
        }
      }
    }

    return violations.length > 0 ? { ...trade, ruleViolations: violations } : trade
  })
}

/**
 * Computes overall rule adherence across a trade array.
 * @param {import('./tradeSchema.js').Trade[]} trades
 * @returns {{ adherenceRate: number, violationCount: number, cleanTrades: import('./tradeSchema.js').Trade[] }}
 */
export function computeAdherence(trades) {
  const violationCount = trades.filter(t => t.ruleViolations?.length > 0).length
  const adherenceRate  = trades.length > 0 ? 1 - violationCount / trades.length : 1
  const cleanTrades    = trades.filter(t => !t.ruleViolations?.length)
  return { adherenceRate, violationCount, cleanTrades }
}
