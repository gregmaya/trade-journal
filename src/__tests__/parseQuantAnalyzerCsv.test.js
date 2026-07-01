import { describe, it, expect } from 'vitest'
import { parseQuantAnalyzerCsv, extractQuantAnalyzerLogin } from '../utils/parseQuantAnalyzerCsv.js'

const SAMPLE_CSV = `sep=,
Type,Ticket,Symbol,Lots,Buy/sell,Open Price,Close price,Open time,Close time,Open date,Close date,Profit,Swap,Commission,Net profit,T/P,S/L,Pips,Result,Trade duration (hours),Magic number,Order comment,Account
Closed position,6,XAUUSD,0.06,sell,4198.12,4194.48,2026/06/22 09:34:30,2026/06/22 15:57:25,2026/06/22,2026/06/22,21.84,0.00,-0.60,21.24,0.00,0.00,3.64,Win,0.00,98753,639929044,20120675
Closed position,1,XAUUSD,0.06,buy,4190.41,4194.25,2026/06/22 11:15:06,2026/06/22 11:22:28,2026/06/22,2026/06/22,23.04,0.00,-0.60,22.44,0.00,0.00,3.84,Win,0.00,98753,639968759,20120675
Open position,0,EURUSD,0.10,buy,1.0800,0.00,2026/06/22 10:00:00,,2026/06/22,,0,0,0,0,0,0,0,,0,98753,640000000,20120675`

describe('parseQuantAnalyzerCsv', () => {
  it('returns only Closed position rows', () => {
    const trades = parseQuantAnalyzerCsv(SAMPLE_CSV, 'fp-20120675')
    expect(trades).toHaveLength(2)
  })

  it('uses orderComment as trade id', () => {
    const trades = parseQuantAnalyzerCsv(SAMPLE_CSV, 'fp-20120675')
    expect(trades[0].id).toBe('639929044')
    expect(trades[1].id).toBe('639968759')
  })

  it('parses magic number as a number', () => {
    const trades = parseQuantAnalyzerCsv(SAMPLE_CSV, 'fp-20120675')
    expect(trades[0].magicNumber).toBe(98753)
    expect(trades[1].magicNumber).toBe(98753)
  })

  it('stores orderComment as a string', () => {
    const trades = parseQuantAnalyzerCsv(SAMPLE_CSV, 'fp-20120675')
    expect(trades[0].orderComment).toBe('639929044')
  })

  it('parses direction correctly', () => {
    const trades = parseQuantAnalyzerCsv(SAMPLE_CSV, 'fp-20120675')
    expect(trades[0].direction).toBe('SELL')
    expect(trades[1].direction).toBe('BUY')
  })

  it('parses pnl as net profit (commission + swap included)', () => {
    const trades = parseQuantAnalyzerCsv(SAMPLE_CSV, 'fp-20120675')
    expect(trades[0].pnl).toBeCloseTo(21.24)
  })

  it('assigns the given accountId', () => {
    const trades = parseQuantAnalyzerCsv(SAMPLE_CSV, 'fp-20120675')
    expect(trades[0].accountId).toBe('fp-20120675')
  })
})

describe('extractQuantAnalyzerLogin', () => {
  it('returns the account number from the first data row', () => {
    expect(extractQuantAnalyzerLogin(SAMPLE_CSV)).toBe('20120675')
  })

  it('returns null when there are no closed positions', () => {
    const noData = `sep=,\nType,Ticket,...\n`
    expect(extractQuantAnalyzerLogin(noData)).toBeNull()
  })
})
