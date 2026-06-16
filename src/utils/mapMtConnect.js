import { labelSession } from './tradeSchema.js'

/**
 * Maps one closed trade record from mtconnectapi.com to the normalised Trade schema.
 * Field names use ?? fallbacks to handle both PascalCase and snake_case API responses.
 * Verify actual casing after the spike in Task 6 and remove unused variants.
 *
 * @param {Object} raw
 * @param {string} accountId
 * @param {number} [beThresholdUsd=50]
 * @returns {import('./tradeSchema.js').Trade}
 */
export function mapMtConnectTrade(raw, accountId, beThresholdUsd = 50) {
  const openTime  = parseApiTime(raw.OpenTime  ?? raw.open_time  ?? raw.TimeSetup ?? raw.time_setup)
  const closeTime = parseApiTime(raw.CloseTime ?? raw.close_time ?? raw.Time      ?? raw.time)
  // MT5 deal type: 0 = BUY_DEAL, 1 = SELL_DEAL
  const direction = String(raw.Type ?? raw.type ?? '0') === '1' ? 'SELL' : 'BUY'

  const profit     = parseFloat(raw.Profit     ?? raw.profit     ?? 0)
  const commission = parseFloat(raw.Commission ?? raw.commission ?? 0)
  const swap       = parseFloat(raw.Swap       ?? raw.swap       ?? 0)
  const pnl        = profit + commission + swap

  return {
    id:           String(raw.Ticket ?? raw.ticket ?? raw.PositionID ?? raw.position_id ?? ''),
    accountId,
    platform:     'mt5',
    symbol:       String(raw.Symbol ?? raw.symbol ?? ''),
    direction,
    openTime,
    closeTime,
    openPrice:    parseFloat(raw.OpenPrice  ?? raw.open_price  ?? raw.PriceOpen ?? raw.price_open ?? 0),
    closePrice:   parseFloat(raw.ClosePrice ?? raw.close_price ?? raw.Price     ?? raw.price      ?? 0),
    volume:       parseFloat(raw.Volume ?? raw.volume ?? 0),
    commission,
    swap,
    pnl,
    pips:         0,
    rMultiple:    null,
    tags:         [],
    notes:        '',
    sessionLabel: labelSession(openTime),
    ruleViolations: [],
    classification: classifyPnl(pnl, beThresholdUsd),
    syncSource:   'mtconnect',
    syncedAt:     new Date().toISOString(),
    strategy:     '',
    tradingViewUrl: '',
    rating:       null,
  }
}

function classifyPnl(pnl, threshold) {
  if (Math.abs(pnl) <= threshold) return 'be'
  return pnl > 0 ? 'win' : 'loss'
}

/**
 * Parses timestamps from the API.
 * Handles: "2024.01.15 10:30:00", "2024-01-15 10:30:00", Unix epoch (seconds or ms)
 */
function parseApiTime(raw) {
  if (!raw) return new Date().toISOString()
  if (typeof raw === 'number') {
    const ms = raw > 1e12 ? raw : raw * 1000
    return new Date(ms).toISOString()
  }
  const normalized = String(raw).replace(/\./g, '-').replace(' ', 'T')
  const d = new Date(normalized + 'Z')
  return isNaN(d) ? new Date().toISOString() : d.toISOString()
}
