import { mapMtConnectTrade } from './mapMtConnect.js'

/**
 * Parses a QuantAnalyzer CSV export into the normalised Trade schema.
 * Column layout (0-based):
 *   0=Type  2=Symbol  3=Lots  4=Buy/sell  5=OpenPrice  6=ClosePrice
 *   7=OpenTime  8=CloseTime  11=Profit  12=Swap  13=Commission  14=NetProfit
 *   20=MagicNumber  21=OrderComment(used as id)  22=Account
 *
 * @param {string} text — full CSV file content
 * @param {string} accountId
 * @returns {import('./tradeSchema.js').Trade[]}
 */
export function parseQuantAnalyzerCsv(text, accountId) {
  const lines = splitLines(text)
  return lines
    .filter(cols => cols[0] === 'Closed position')
    .map(cols => {
      const orderComment = (cols[21] ?? '').trim()
      return mapMtConnectTrade({
        Ticket:       orderComment,                        // orderComment → trade id
        Symbol:       cols[2],
        Type:         cols[4].trim().toLowerCase() === 'sell' ? '1' : '0',
        OpenTime:     normaliseDate(cols[7]),
        CloseTime:    normaliseDate(cols[8]),
        OpenPrice:    cols[5],
        ClosePrice:   cols[6],
        Volume:       cols[3],
        Commission:   cols[13],
        Swap:         cols[12],
        Profit:       cols[11],
        MagicNumber:  parseMagic(cols[20]),
        OrderComment: orderComment,
      }, accountId)
    })
}

/**
 * Extracts the MT5 account login number from the first Closed position row.
 * @param {string} text
 * @returns {string|null}
 */
export function extractQuantAnalyzerLogin(text) {
  const lines = splitLines(text)
  const first = lines.find(cols => cols[0] === 'Closed position')
  if (!first) return null
  return (first[22] ?? '').trim() || null
}

function splitLines(text) {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('sep=') && !l.startsWith('Type,'))
    .map(l => l.split(','))
}

function normaliseDate(raw) {
  // QuantAnalyzer format: "2026/06/22 09:34:30" — replace / with - for parseApiTime
  return (raw ?? '').trim().replace(/\//g, '-')
}

function parseMagic(raw) {
  const n = parseInt((raw ?? '').trim(), 10)
  return isNaN(n) ? null : n
}
