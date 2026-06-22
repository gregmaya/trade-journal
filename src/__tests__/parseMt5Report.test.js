// src/__tests__/parseMt5Report.test.js
import { describe, it, expect } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
import { parseMt5XlsxReport, parseMt5XlsxRows, extractAccountLogin } from '../utils/parseMt5Report.js'

const SHARED = ['Positions', 'XAUUSD', 'buy', 'sell', '2026.06.15 08:49:18', '2026.06.15 10:22:07', 'Orders']

function sharedStringsXml(strings) {
  const sis = strings.map(s => `<si><t>${s}</t></si>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${sis}</sst>`
}

function sheetXml(rowsXml) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`
}

function strCell(ref, sharedIdx) { return `<c r="${ref}" t="s"><v>${sharedIdx}</v></c>` }
function numCell(ref, val) { return `<c r="${ref}"><v>${val}</v></c>` }

function buildReportBuffer({ rowsXml, shared = SHARED }) {
  const zip = zipSync({
    'xl/worksheets/sheet1.xml': strToU8(sheetXml(rowsXml)),
    'xl/sharedStrings.xml': strToU8(sharedStringsXml(shared)),
  })
  return zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength)
}

const POSITIONS_LABEL_ROW = `<row r="1">${strCell('A1', 0)}</row>`
const HEADER_ROW = `<row r="2"></row>`
function positionRow(rowNum, { position, symbolIdx, typeIdx, openIdx, closeIdx, open, close, vol, commission, swap, profit }) {
  return `<row r="${rowNum}">
    ${strCell('A' + rowNum, openIdx)}
    ${numCell('B' + rowNum, position)}
    ${strCell('C' + rowNum, symbolIdx)}
    ${strCell('D' + rowNum, typeIdx)}
    ${numCell('E' + rowNum, vol)}
    ${numCell('F' + rowNum, open)}
    ${strCell('I' + rowNum, closeIdx)}
    ${numCell('J' + rowNum, close)}
    ${numCell('K' + rowNum, commission)}
    ${numCell('L' + rowNum, swap)}
    ${numCell('M' + rowNum, profit)}
  </row>`
}
const ORDERS_LABEL_ROW = (rowNum) => `<row r="${rowNum}">${strCell('A' + rowNum, 6)}</row>`

const HEADER_SHARED = ['Account:', '26432619 (USD, FivePercentOnline-Real, demo, Hedge)', 'Name:', 'NotANumber']
function headerRow(rowNum, labelIdx, valueIdx) {
  return `<row r="${rowNum}">${strCell('A' + rowNum, labelIdx)}${strCell('B' + rowNum, valueIdx)}</row>`
}

describe('extractAccountLogin', () => {
  it('extracts the login number from the Account: row', () => {
    const rowsXml = [
      headerRow(1, 2, 0), // Name: ...
      headerRow(2, 0, 1), // Account: 26432619 (USD, ...)
    ].join('')
    const buffer = buildReportBuffer({ rowsXml, shared: HEADER_SHARED })
    const rows = parseMt5XlsxRows(buffer)
    expect(extractAccountLogin(rows)).toBe('26432619')
  })

  it('returns null when there is no Account: row', () => {
    const rowsXml = headerRow(1, 2, 0) // only "Name:" row
    const buffer = buildReportBuffer({ rowsXml, shared: HEADER_SHARED })
    const rows = parseMt5XlsxRows(buffer)
    expect(extractAccountLogin(rows)).toBeNull()
  })

  it('returns null when the Account: value does not start with digits', () => {
    const rowsXml = headerRow(1, 0, 3) // Account: NotANumber
    const buffer = buildReportBuffer({ rowsXml, shared: HEADER_SHARED })
    const rows = parseMt5XlsxRows(buffer)
    expect(extractAccountLogin(rows)).toBeNull()
  })
})

describe('parseMt5XlsxReport', () => {
  it('parses a single closed position into the Trade schema', () => {
    const rowsXml = [
      POSITIONS_LABEL_ROW,
      HEADER_ROW,
      positionRow(3, { position: 245623253, symbolIdx: 1, typeIdx: 2, openIdx: 4, closeIdx: 5, open: 4315.48, close: 4318.14, vol: 0.08, commission: -0.55, swap: 0, profit: 21.28 }),
      ORDERS_LABEL_ROW(4),
    ].join('')

    const buffer = buildReportBuffer({ rowsXml })
    const trades = parseMt5XlsxReport(buffer, 'acc-1')

    expect(trades).toHaveLength(1)
    const t = trades[0]
    expect(t.id).toBe('245623253')
    expect(t.accountId).toBe('acc-1')
    expect(t.symbol).toBe('XAUUSD')
    expect(t.direction).toBe('BUY')
    expect(t.openTime).toBe('2026-06-15T08:49:18.000Z')
    expect(t.closeTime).toBe('2026-06-15T10:22:07.000Z')
    expect(t.openPrice).toBe(4315.48)
    expect(t.closePrice).toBe(4318.14)
    expect(t.volume).toBe(0.08)
    expect(t.commission).toBe(-0.55)
    expect(t.pnl).toBeCloseTo(20.73)
  })

  it('maps sell type to SELL direction', () => {
    const rowsXml = [
      POSITIONS_LABEL_ROW,
      HEADER_ROW,
      positionRow(3, { position: 1, symbolIdx: 1, typeIdx: 3, openIdx: 4, closeIdx: 5, open: 1, close: 1, vol: 0.01, commission: 0, swap: 0, profit: 0 }),
      ORDERS_LABEL_ROW(4),
    ].join('')
    const buffer = buildReportBuffer({ rowsXml })
    expect(parseMt5XlsxReport(buffer, 'acc-1')[0].direction).toBe('SELL')
  })

  it('excludes rows after the Orders section boundary', () => {
    const rowsXml = [
      POSITIONS_LABEL_ROW,
      HEADER_ROW,
      positionRow(3, { position: 1, symbolIdx: 1, typeIdx: 2, openIdx: 4, closeIdx: 5, open: 1, close: 1, vol: 0.01, commission: 0, swap: 0, profit: 5 }),
      ORDERS_LABEL_ROW(4),
      positionRow(5, { position: 999, symbolIdx: 1, typeIdx: 2, openIdx: 4, closeIdx: 5, open: 1, close: 1, vol: 0.01, commission: 0, swap: 0, profit: 5 }),
    ].join('')
    const buffer = buildReportBuffer({ rowsXml })
    const trades = parseMt5XlsxReport(buffer, 'acc-1')
    expect(trades).toHaveLength(1)
    expect(trades[0].id).toBe('1')
  })

  it('throws when no Positions section is found', () => {
    const rowsXml = `<row r="1">${strCell('A1', 6)}</row>` // only "Orders" label, no "Positions"
    const buffer = buildReportBuffer({ rowsXml })
    expect(() => parseMt5XlsxReport(buffer, 'acc-1')).toThrow(/Positions/)
  })
})
