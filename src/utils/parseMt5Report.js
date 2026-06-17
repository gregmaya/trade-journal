// src/utils/parseMt5Report.js
// Parses an MT5 terminal "Save as Report" .xlsx export (Toolbox → History → right-click → Save as Report).
// The file is a zip containing OOXML spreadsheet XML — no xlsx library needed, just unzip + parse.
//
// Report layout (single sheet) has several labelled sections stacked vertically:
//   Positions  — closed round-trip trades, open+close combined (what we want)
//   Orders     — individual order fills (not used)
//   Deals      — individual deal executions incl. deposits (not used)
//   Results    — summary stats (not used)
//
// The Positions section header row is:
//   Time | Position | Symbol | Type | Volume | Price | S/L | T/P | Time | Price | Commission | Swap | Profit
// which maps directly onto the same raw shape mapMtConnectTrade() already expects.

import { unzipSync, strFromU8 } from 'fflate'
import { mapMtConnectTrade } from './mapMtConnect.js'

// MT5's xlsx export writes its internal XML parts as UTF-16LE (with BOM) rather than
// the UTF-8 the OOXML spec normally expects — detect and decode accordingly.
function decodeXmlEntry(bytes) {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  }
  return strFromU8(bytes)
}

function parseSharedStrings(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const sis = doc.getElementsByTagName('si')
  const strings = []
  for (const si of sis) {
    const texts = si.getElementsByTagName('t')
    let s = ''
    for (const t of texts) s += t.textContent
    strings.push(s)
  }
  return strings
}

function colLetters(ref) {
  return ref.match(/[A-Z]+/)[0]
}

function parseSheetRows(xml, sharedStrings) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const rowEls = doc.getElementsByTagName('row')
  const rows = []
  for (const row of rowEls) {
    const cells = {}
    const cEls = row.getElementsByTagName('c')
    for (const c of cEls) {
      const col = colLetters(c.getAttribute('r'))
      const type = c.getAttribute('t')
      const vEl = c.getElementsByTagName('v')[0]
      let val = vEl ? vEl.textContent : null
      if (type === 's' && val != null) val = sharedStrings[parseInt(val, 10)]
      cells[col] = val
    }
    rows.push(cells)
  }
  return rows
}

/**
 * Parses an MT5 xlsx trade history report and extracts the Positions section
 * (closed round-trip trades) into the normalised Trade schema.
 *
 * @param {ArrayBuffer} buffer — raw bytes of the .xlsx file
 * @param {string} accountId
 * @returns {import('./tradeSchema.js').Trade[]}
 */
export function parseMt5XlsxReport(buffer, accountId) {
  const zip = unzipSync(new Uint8Array(buffer))
  const sheetEntry = zip['xl/worksheets/sheet1.xml']
  if (!sheetEntry) throw new Error('Not a valid MT5 report: missing sheet1.xml')

  const sharedEntry = zip['xl/sharedStrings.xml']
  const sharedStrings = sharedEntry ? parseSharedStrings(decodeXmlEntry(sharedEntry)) : []
  const rows = parseSheetRows(decodeXmlEntry(sheetEntry), sharedStrings)

  const positionsLabelIdx = rows.findIndex(r => r.A === 'Positions')
  if (positionsLabelIdx === -1) throw new Error('Not an MT5 report: no "Positions" section found')
  const ordersLabelIdx = rows.findIndex(r => r.A === 'Orders')

  const dataStart = positionsLabelIdx + 2 // skip "Positions" label row + its header row
  const dataEnd = ordersLabelIdx !== -1 ? ordersLabelIdx : rows.length
  const positionRows = rows.slice(dataStart, dataEnd).filter(r => r.B)

  return positionRows.map(r => mapMtConnectTrade({
    Ticket: r.B,
    Symbol: r.C,
    Type: String(r.D).toLowerCase() === 'sell' ? '1' : '0',
    OpenTime: r.A,
    CloseTime: r.I,
    OpenPrice: r.F,
    ClosePrice: r.J,
    Volume: r.E,
    Commission: r.K,
    Swap: r.L,
    Profit: r.M,
  }, accountId))
}
