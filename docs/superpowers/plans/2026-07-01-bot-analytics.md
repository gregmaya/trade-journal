# Bot Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-trade magic number tracking via a new QuantAnalyzer CSV importer, wire magic numbers to bots in the registry, and build a cross-account Bot Analytics page replacing the manual Daily Bot Log.

**Architecture:** QuantAnalyzer CSV is a new import path alongside XLSX in `Mt5ImportModal`; both funnel through the existing `mapMtConnectTrade` normaliser, which now emits `magicNumber` and `orderComment` fields. Bot resolution is a pure lookup at render time (`resolveBotForTrade`). The new `BotsAnalyticsPage` replaces `BotsPage` as the Bots tab and embeds the registry as a sub-section.

**Tech Stack:** React 19, Vite, Recharts (already installed), Vitest for tests, no new dependencies.

## Global Constraints

- No new npm dependencies — use only what is already in package.json.
- All percentage metrics divide PnL by `account.initialBalance` (not a running balance).
- Existing XLSX import flow must remain unchanged — only additive changes to shared utilities.
- `dailyBotAssignments` stays in storage (no migration); its UI is removed.
- Follow the existing style system: import `T`, `btn`, `Card` from `../utils/theme.jsx`.
- Test command: `npx vitest run <file>` (Vitest 3.x project).
- Commit on main directly (no feature branches per project convention).

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `src/utils/tradeSchema.js` | Add `magicNumber`, `orderComment` to typedef |
| Modify | `src/utils/mapMtConnect.js` | Pass `magicNumber`, `orderComment` through to Trade |
| **Create** | `src/utils/botUtils.js` | `resolveBotForTrade` lookup |
| **Create** | `src/__tests__/botUtils.test.js` | Tests for above |
| **Create** | `src/utils/parseQuantAnalyzerCsv.js` | CSV parser + account login extractor |
| **Create** | `src/__tests__/parseQuantAnalyzerCsv.test.js` | Tests for above |
| Modify | `src/components/Mt5ImportModal.jsx` | Detect `.csv` vs `.xlsx`, route accordingly |
| Modify | `src/components/BotsPage.jsx` | Add `magicNumbers` tag-input to bot form + card |
| Delete | `src/components/DailyBotLog.jsx` | Replaced by magic-number resolution |
| Modify | `src/components/Mt5AccountAnalytics.jsx` | Remove Daily Bot Log sub-tab |
| Modify | `src/utils/analytics.js` | Add `computeCumulativePctSeries` |
| **Create** | `src/__tests__/analytics.botutils.test.js` | Tests for new analytics function |
| **Create** | `src/components/BotsAnalyticsPage.jsx` | New Bots tab — sidebar + overview + per-bot views |
| Modify | `src/App.jsx` | Swap Bots tab to BotsAnalyticsPage; remove assignBots handlers |

---

## Task 1: Schema — add magicNumber/orderComment to Trade + botUtils

**Files:**
- Modify: `src/utils/tradeSchema.js`
- Modify: `src/utils/mapMtConnect.js`
- Create: `src/utils/botUtils.js`
- Create: `src/__tests__/botUtils.test.js`

**Interfaces produced:**
- `trade.magicNumber: number | null`
- `trade.orderComment: string | null`
- `resolveBotForTrade(trade, bots) → Bot | null`

- [ ] **Step 1: Write the failing test for resolveBotForTrade**

Create `src/__tests__/botUtils.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { resolveBotForTrade } from '../utils/botUtils.js'

const bots = [
  { id: 'bot-1', name: 'Alpha', magicNumbers: [98753, 12345] },
  { id: 'bot-2', name: 'Beta', magicNumbers: [99999] },
]

describe('resolveBotForTrade', () => {
  it('returns the bot whose magicNumbers includes the trade magicNumber', () => {
    expect(resolveBotForTrade({ magicNumber: 98753 }, bots)).toEqual(bots[0])
  })

  it('returns the correct bot when magicNumber matches a second entry', () => {
    expect(resolveBotForTrade({ magicNumber: 12345 }, bots)).toEqual(bots[0])
  })

  it('returns null when no bot matches', () => {
    expect(resolveBotForTrade({ magicNumber: 11111 }, bots)).toBeNull()
  })

  it('returns null when trade.magicNumber is null', () => {
    expect(resolveBotForTrade({ magicNumber: null }, bots)).toBeNull()
  })

  it('handles bots with missing magicNumbers field gracefully', () => {
    const botsNoField = [{ id: 'bot-3', name: 'Gamma' }]
    expect(resolveBotForTrade({ magicNumber: 98753 }, botsNoField)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```
npx vitest run src/__tests__/botUtils.test.js
```

Expected: FAIL — `Cannot find module '../utils/botUtils.js'`

- [ ] **Step 3: Create `src/utils/botUtils.js`**

```js
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
```

- [ ] **Step 4: Run test to confirm it passes**

```
npx vitest run src/__tests__/botUtils.test.js
```

Expected: all 5 tests PASS

- [ ] **Step 5: Update tradeSchema.js typedef**

In `src/utils/tradeSchema.js`, add two lines at the end of the `@typedef` block (after the `rating` line):

```js
 * @property {number|null} magicNumber   — EA magic number from QuantAnalyzer CSV; null for XLSX imports
 * @property {string|null} orderComment  — MT5 order comment; used as trade id for CSV imports
```

- [ ] **Step 6: Update mapMtConnectTrade to emit the two new fields**

In `src/utils/mapMtConnect.js`, inside the returned object literal, add after `rating: null,`:

```js
    magicNumber:  raw.MagicNumber  ?? raw.magicNumber  ?? null,
    orderComment: raw.OrderComment ?? raw.orderComment ?? null,
```

- [ ] **Step 7: Verify existing tests still pass**

```
npx vitest run src/__tests__/mapMtConnect.test.js
```

Expected: all PASS (new fields default to null for XLSX trades — no breakage)

- [ ] **Step 8: Commit**

```bash
git add src/utils/tradeSchema.js src/utils/mapMtConnect.js src/utils/botUtils.js src/__tests__/botUtils.test.js
git commit -m "feat: add magicNumber/orderComment to Trade schema and botUtils resolver"
```

---

## Task 2: QuantAnalyzer CSV parser

**Files:**
- Create: `src/utils/parseQuantAnalyzerCsv.js`
- Create: `src/__tests__/parseQuantAnalyzerCsv.test.js`

**Interfaces:**
- Consumes: `mapMtConnectTrade` from `./mapMtConnect.js` (already updated in Task 1)
- Produces:
  - `parseQuantAnalyzerCsv(text: string, accountId: string) → Trade[]`
  - `extractQuantAnalyzerLogin(text: string) → string | null`

**CSV column index reference (0-based):**
```
0  Type           1  Ticket(ignored)   2  Symbol     3  Lots       4  Buy/sell
5  Open Price     6  Close price       7  Open time  8  Close time
11 Profit         12 Swap              13 Commission  14 Net profit
20 Magic number   21 Order comment     22 Account
```

The `Open time` format is `2026/06/22 09:34:30` — slashes must be replaced with dashes before passing to `mapMtConnectTrade` so `parseApiTime` handles it correctly.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/parseQuantAnalyzerCsv.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npx vitest run src/__tests__/parseQuantAnalyzerCsv.test.js
```

Expected: FAIL — `Cannot find module '../utils/parseQuantAnalyzerCsv.js'`

- [ ] **Step 3: Create `src/utils/parseQuantAnalyzerCsv.js`**

```js
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```
npx vitest run src/__tests__/parseQuantAnalyzerCsv.test.js
```

Expected: all 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/parseQuantAnalyzerCsv.js src/__tests__/parseQuantAnalyzerCsv.test.js
git commit -m "feat: add QuantAnalyzer CSV parser with magic number and orderComment support"
```

---

## Task 3: Wire CSV import into Mt5ImportModal

**Files:**
- Modify: `src/components/Mt5ImportModal.jsx`

**Interfaces:**
- Consumes: `parseQuantAnalyzerCsv`, `extractQuantAnalyzerLogin` from `../utils/parseQuantAnalyzerCsv.js`
- No new props — the modal's `onImport(trades)` callback is unchanged

- [ ] **Step 1: Add the import at the top of Mt5ImportModal.jsx**

After the existing import line for `parseMt5Report.js`, add:

```js
import { parseQuantAnalyzerCsv, extractQuantAnalyzerLogin } from '../utils/parseQuantAnalyzerCsv.js'
```

- [ ] **Step 2: Add a CSV-specific file handler**

Inside `Mt5ImportModal`, add this function alongside `handleFile` (the existing XLSX handler):

```js
  function handleCsvFile(file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target.result
        const detectedLogin = extractQuantAnalyzerLogin(text)
        if (!detectedLogin) {
          setParseErr('Could not detect an account number in this CSV. Make sure it is a QuantAnalyzer export.')
          return
        }
        const match = accounts.find(a => a.login === detectedLogin)
        setLogin(detectedLogin)
        setParseErr('')
        if (match) {
          const trades = parseQuantAnalyzerCsv(text, match.id)
          if (trades.length === 0) {
            setParseErr('No closed positions found in this CSV.')
            return
          }
          setAccount(match)
          setParsed(trades)
          setStep('preview')
        } else {
          // Store the raw text so we can parse after account creation
          setRows({ csvText: text })
          setStep('create-account')
        }
      } catch (err) {
        setParseErr(err.message || 'Failed to parse CSV. Make sure it is a QuantAnalyzer export.')
      }
    }
    reader.onerror = () => setParseErr('Failed to read file.')
    reader.readAsText(file)
  }
```

- [ ] **Step 3: Update `handleCreateAccount` to handle CSV rows**

The existing `finishParse` only handles XLSX rows. When the user creates a new account after uploading a CSV, `rows` will be `{ csvText: text }` instead of an array. Update `handleCreateAccount`:

```js
  function handleCreateAccount() {
    const initialBalance = Number(newAccountForm.initialBalance)
    const newAccount = {
      id: `${slugify(newAccountForm.propFirm)}-${login}`,
      label: newAccountForm.label.trim(),
      propFirm: newAccountForm.propFirm.trim(),
      botName: '',
      bots: [],
      platform: 'mt5',
      login,
      currency: 'USD',
      initialBalance,
      maxLossPct: 0.10,
      phase: 1,
      phaseStartBalance: initialBalance,
      phaseTargetPct: 0.10,
      openedDate: newAccountForm.openedDate || null,
    }
    let succeeded = false
    if (rows?.csvText) {
      const trades = parseQuantAnalyzerCsv(rows.csvText, newAccount.id)
      if (trades.length === 0) {
        setParseErr('No closed positions found in this CSV.')
        return
      }
      setAccount(newAccount)
      setParsed(trades)
      setParseErr('')
      setStep('preview')
      succeeded = true
    } else {
      succeeded = finishParse(rows, newAccount)
    }
    if (succeeded) {
      onCreateAccount(newAccount)
    }
  }
```

- [ ] **Step 4: Update the file drop zone to accept both .xlsx and .csv, and route correctly**

In the upload step JSX, find the `<div>` drop zone and the `<input>` inside it. Replace the drop handler and the file input:

The `onDrop` handler currently calls `handleFile(f)`. Change it to:
```js
onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) { f.name.endsWith('.csv') ? handleCsvFile(f) : handleFile(f) } }}
```

The `<input>` currently has `accept=".xlsx"`. Change to `accept=".xlsx,.csv"` and update its `onChange`:
```js
<input ref={fileRef} type="file" accept=".xlsx,.csv" style={{ display: 'none' }}
  onChange={e => { const f = e.target.files[0]; if (f) { f.name.endsWith('.csv') ? handleCsvFile(f) : handleFile(f) } }} />
```

Also update the helper text to mention CSV:
```js
<div style={{ fontSize: 12, color: T.hint }}>MT5 "Save as Report" .xlsx  ·  QuantAnalyzer .csv</div>
```

- [ ] **Step 5: Manual smoke test**

Run `npm run dev`, open the app, click "Import MT5", drop the `data/QuantAnalyzer20120675.csv` file. Expected:
- Account `20120675` auto-detected
- Preview shows 28 trades with no parse error
- After confirming, trades in the journal have `magicNumber: 98753`

- [ ] **Step 6: Commit**

```bash
git add src/components/Mt5ImportModal.jsx
git commit -m "feat: support QuantAnalyzer CSV import alongside existing XLSX import"
```

---

## Task 4: Bot registry — magic numbers tag input

**Files:**
- Modify: `src/components/BotsPage.jsx`

- [ ] **Step 1: Update `BOT_DEFAULTS` to include `magicNumbers`**

Find this line in `BotsPage.jsx`:
```js
const BOT_DEFAULTS = { id: '', name: '', pairs: '', lotSizes: {}, strategyDescription: '' }
```
Replace with:
```js
const BOT_DEFAULTS = { id: '', name: '', pairs: '', lotSizes: {}, strategyDescription: '', magicNumbers: [] }
```

- [ ] **Step 2: Update `BotForm` initial state to include `magicNumbers`**

In the `useState` inside `BotForm`, the spread from `bot` already picks up `magicNumbers` if present. Add a fallback in the initialiser:

```js
  const [f, setF] = useState({
    ...BOT_DEFAULTS,
    ...(bot ? { ...bot, pairs: (bot.pairs || []).join(', '), lotSizes: seedLotSizes(bot), magicNumbers: bot.magicNumbers ?? [] } : {}),
  })
```

- [ ] **Step 3: Add magic number tag-input helpers inside `BotForm`**

After `function setLotSize(...)`, add:

```js
  function addMagicNumber(input) {
    const n = parseInt(input, 10)
    if (!isNaN(n) && !f.magicNumbers.includes(n)) {
      s('magicNumbers', [...f.magicNumbers, n])
    }
  }

  function removeMagicNumber(n) {
    s('magicNumbers', f.magicNumbers.filter(x => x !== n))
  }
```

- [ ] **Step 4: Add the magic numbers field to the form JSX**

Inside `BotForm`'s return, add this block after the strategy description `<div>`:

```jsx
        <div>
          <label style={labelStyle}>Magic Numbers</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
            {f.magicNumbers.map(n => (
              <span key={n} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: T.surface, border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 4 }}>
                {n}
                <button onClick={() => removeMagicNumber(n)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1, color: T.hint, padding: 0 }}>×</button>
              </span>
            ))}
          </div>
          <input
            style={inputStyle}
            type="number"
            placeholder="Type a magic number and press Enter"
            onKeyDown={e => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                addMagicNumber(e.target.value.trim())
                e.target.value = ''
                e.preventDefault()
              }
            }}
          />
        </div>
```

- [ ] **Step 5: Include `magicNumbers` in `handleSave`**

Find `handleSave` and update the returned object:

```js
  function handleSave() {
    onSave({
      id: f.id || uid(),
      name: f.name.trim(),
      pairs: parsedPairs,
      lotSizes: Object.fromEntries(parsedPairs.map(p => [p, f.lotSizes[p] ?? null])),
      strategyDescription: f.strategyDescription,
      magicNumbers: f.magicNumbers,
    })
  }
```

- [ ] **Step 6: Show magic numbers on bot card**

In the bot card inside `BotsPage`, after the pairs chips `<div>`, add:

```jsx
            {(bot.magicNumbers ?? []).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                {bot.magicNumbers.map(n => (
                  <span key={n} style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, background: T.surface, border: `0.5px solid ${T.border}`, color: T.hint }}>
                    #{n}
                  </span>
                ))}
              </div>
            )}
```

- [ ] **Step 7: Manual smoke test**

Run `npm run dev`, open Bots tab, add or edit a bot, type `98753` in the magic numbers field and press Enter. Expected: chip appears showing `98753`. Save and re-open — chip persists.

- [ ] **Step 8: Commit**

```bash
git add src/components/BotsPage.jsx
git commit -m "feat: add magic numbers tag-input to bot editor and card display"
```

---

## Task 5: Remove Daily Bot Log

**Files:**
- Delete: `src/components/DailyBotLog.jsx`
- Modify: `src/components/Mt5AccountAnalytics.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Delete DailyBotLog.jsx**

```bash
rm src/components/DailyBotLog.jsx
```

- [ ] **Step 2: Remove DailyBotLog from Mt5AccountAnalytics.jsx**

Find and remove:
- The `import { DailyBotLog } from './DailyBotLog.jsx'` line
- Any prop destructuring for `dailyBotAssignments`, `onAssignBots`, `onBulkAssignBots`, `bots` that exist only for the bot log
- The tab entry for "Daily Bot Log" in the tabs array
- The `<DailyBotLog ... />` render block

To find the exact lines, run:
```bash
grep -n "DailyBotLog\|dailyBotAssign\|onAssignBots\|onBulkAssign" src/components/Mt5AccountAnalytics.jsx
```

Remove all matching import, prop, tab label, and render references.

- [ ] **Step 3: Remove assignBots handlers and related props from App.jsx**

Find and remove:
- `function assignBots(...)` (lines ~210–220)
- `function assignBotsBulk(...)` (lines ~223–232)
- Props `onAssignBots={assignBots}` and `onBulkAssignBots={assignBotsBulk}` passed to Dashboard
- Props `dailyBotAssignments` and `bots` passed to Dashboard (if they were only for bot log)

To identify which props Dashboard still needs after removal:
```bash
grep -n "onAssignBots\|onBulkAssign\|dailyBotAssign" src/App.jsx src/components/Mt5AccountAnalytics.jsx
```

Remove all dead references. The `data.bots` array itself stays — it's used by the new analytics page.

- [ ] **Step 4: Verify the app still compiles and runs**

```bash
npm run dev
```

Expected: no import errors, Dashboard loads, no "Daily Bot Log" tab visible.

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "feat: remove Daily Bot Log UI (replaced by magic number resolution)"
```

---

## Task 6: Add computeCumulativePctSeries to analytics.js

**Files:**
- Modify: `src/utils/analytics.js`
- Create: `src/__tests__/analytics.botutils.test.js`

**Interface produced:**
```js
computeCumulativePctSeries(trades: Trade[], accounts: Account[]) → { date: string, pct: number }[]
```

Returns array sorted by close date, where `pct` is cumulative % return across all trades, with each trade's PnL divided by its account's `initialBalance`.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/analytics.botutils.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { computeCumulativePctSeries } from '../utils/analytics.js'

describe('computeCumulativePctSeries', () => {
  it('returns empty array for no trades', () => {
    expect(computeCumulativePctSeries([], [])).toEqual([])
  })

  it('normalises pnl to account initialBalance', () => {
    const accounts = [{ id: 'acc-1', initialBalance: 10000 }]
    const trades = [
      { accountId: 'acc-1', pnl: 100, closeTime: '2026-06-22T10:00:00Z' },
      { accountId: 'acc-1', pnl: -50, closeTime: '2026-06-23T10:00:00Z' },
    ]
    const result = computeCumulativePctSeries(trades, accounts)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ date: '2026-06-22', pct: 1 })
    expect(result[1]).toEqual({ date: '2026-06-23', pct: 0.5 })
  })

  it('normalises across different account sizes', () => {
    const accounts = [
      { id: 'acc-small', initialBalance: 5000 },
      { id: 'acc-large', initialBalance: 50000 },
    ]
    const trades = [
      { accountId: 'acc-small', pnl: 50,  closeTime: '2026-06-22T10:00:00Z' }, // 1%
      { accountId: 'acc-large', pnl: 500, closeTime: '2026-06-23T10:00:00Z' }, // 1%
    ]
    const result = computeCumulativePctSeries(trades, accounts)
    expect(result[0].pct).toBeCloseTo(1)
    expect(result[1].pct).toBeCloseTo(2)
  })

  it('sorts by closeTime ascending', () => {
    const accounts = [{ id: 'a', initialBalance: 1000 }]
    const trades = [
      { accountId: 'a', pnl: 10, closeTime: '2026-06-23T10:00:00Z' },
      { accountId: 'a', pnl: 10, closeTime: '2026-06-22T10:00:00Z' },
    ]
    const result = computeCumulativePctSeries(trades, accounts)
    expect(result[0].date).toBe('2026-06-22')
    expect(result[1].date).toBe('2026-06-23')
  })

  it('falls back to 10000 if account not found', () => {
    const trades = [
      { accountId: 'unknown', pnl: 100, closeTime: '2026-06-22T10:00:00Z' },
    ]
    const result = computeCumulativePctSeries(trades, [])
    expect(result[0].pct).toBeCloseTo(1)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npx vitest run src/__tests__/analytics.botutils.test.js
```

Expected: FAIL — `computeCumulativePctSeries is not a function`

- [ ] **Step 3: Add `computeCumulativePctSeries` to analytics.js**

Append to the end of `src/utils/analytics.js`:

```js
/**
 * Cumulative % return series for a set of trades spanning multiple accounts.
 * PnL is normalised to each trade's account.initialBalance so cross-account
 * comparison is meaningful regardless of account size.
 *
 * @param {import('./tradeSchema.js').Trade[]} trades
 * @param {Array<{id: string, initialBalance: number}>} accounts
 * @returns {{ date: string, pct: number }[]}
 */
export function computeCumulativePctSeries(trades, accounts) {
  if (!trades.length) return []
  const balanceFor = Object.fromEntries(accounts.map(a => [a.id, a.initialBalance]))
  const sorted = [...trades].sort((a, b) => new Date(a.closeTime) - new Date(b.closeTime))
  let cum = 0
  return sorted.map(t => {
    const balance = balanceFor[t.accountId] ?? 10000
    cum += (t.pnl / balance) * 100
    return { date: t.closeTime.slice(0, 10), pct: Math.round(cum * 100) / 100 }
  })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
npx vitest run src/__tests__/analytics.botutils.test.js
```

Expected: all 5 tests PASS

- [ ] **Step 5: Run the full test suite to confirm no regressions**

```
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/utils/analytics.js src/__tests__/analytics.botutils.test.js
git commit -m "feat: add computeCumulativePctSeries for cross-account bot performance"
```

---

## Task 7: BotsAnalyticsPage

**Files:**
- Create: `src/components/BotsAnalyticsPage.jsx`

**Props:**
```js
{
  bots: Bot[],          // global registry (with magicNumbers[])
  trades: Trade[],      // all trades (all accounts)
  accounts: Account[],  // all accounts (for initialBalance lookup)
  onSaveBot: (bot) => void,
  onDeleteBot: (id) => void,
}
```

**Internal views controlled by `selectedId` state:**
- `'overview'` — cross-bot comparison table + multi-line equity curve
- `'manage'` — embeds existing `BotsPage` for registry editing
- `bot.id` (any string) — per-bot detail view

- [ ] **Step 1: Create `src/components/BotsAnalyticsPage.jsx`**

```jsx
import { useState, useMemo } from 'react'
import { T, btn, Card } from '../utils/theme.jsx'
import { BotsPage } from './BotsPage.jsx'
import { resolveBotForTrade } from '../utils/botUtils.js'
import { computeStats, computeCumulativePctSeries } from '../utils/analytics.js'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const BOT_COLOURS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export function BotsAnalyticsPage({ bots, trades, accounts, onSaveBot, onDeleteBot }) {
  const [selectedId, setSelectedId] = useState('overview')

  // Group trades by bot
  const tradesByBot = useMemo(() => {
    const map = {}
    for (const t of trades) {
      const bot = resolveBotForTrade(t, bots)
      if (!bot) continue
      if (!map[bot.id]) map[bot.id] = []
      map[bot.id].push(t)
    }
    return map
  }, [trades, bots])

  const botsWithTrades = bots.filter(b => tradesByBot[b.id]?.length > 0)
  const botsWithoutTrades = bots.filter(b => !tradesByBot[b.id]?.length)

  const sidebarItemStyle = (active) => ({
    padding: '7px 12px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 500 : 400,
    background: active ? T.indigoBg : 'transparent',
    color: active ? T.indigo : T.text,
    border: 'none',
    width: '100%',
    textAlign: 'left',
    display: 'block',
  })

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      {/* Sidebar */}
      <aside style={{ width: 180, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button style={sidebarItemStyle(selectedId === 'overview')} onClick={() => setSelectedId('overview')}>
          Overview
        </button>
        {botsWithTrades.length > 0 && (
          <div style={{ fontSize: 10, color: T.hint, padding: '10px 12px 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Bots
          </div>
        )}
        {botsWithTrades.map(bot => (
          <button key={bot.id} style={sidebarItemStyle(selectedId === bot.id)} onClick={() => setSelectedId(bot.id)}>
            {bot.name}
          </button>
        ))}
        {botsWithoutTrades.map(bot => (
          <button key={bot.id} style={{ ...sidebarItemStyle(false), color: T.hint, cursor: 'default' }}>
            {bot.name}
          </button>
        ))}
        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: `0.5px solid ${T.border}`, marginTop: 16 }}>
          <button style={sidebarItemStyle(selectedId === 'manage')} onClick={() => setSelectedId('manage')}>
            Manage Bots
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {selectedId === 'overview' && (
          <OverviewView bots={bots} tradesByBot={tradesByBot} accounts={accounts} />
        )}
        {selectedId === 'manage' && (
          <BotsPage bots={bots} onSave={onSaveBot} onDelete={onDeleteBot} />
        )}
        {selectedId !== 'overview' && selectedId !== 'manage' && (() => {
          const bot = bots.find(b => b.id === selectedId)
          if (!bot) return null
          return (
            <BotDetailView
              bot={bot}
              trades={tradesByBot[bot.id] ?? []}
              accounts={accounts}
            />
          )
        })()}
      </div>
    </div>
  )
}

// ─── Overview ────────────────────────────────────────────────────────────────

function OverviewView({ bots, tradesByBot, accounts }) {
  const botsWithTrades = bots.filter(b => tradesByBot[b.id]?.length > 0)

  // Build multi-bot equity curve data for Recharts
  const equityData = useMemo(() => {
    if (botsWithTrades.length === 0) return []
    // Compute per-bot series
    const seriesMap = {}
    for (const bot of botsWithTrades) {
      const series = computeCumulativePctSeries(tradesByBot[bot.id] ?? [], accounts)
      seriesMap[bot.name] = Object.fromEntries(series.map(p => [p.date, p.pct]))
    }
    // Collect all dates
    const allDates = [...new Set(
      botsWithTrades.flatMap(bot =>
        (computeCumulativePctSeries(tradesByBot[bot.id] ?? [], accounts)).map(p => p.date)
      )
    )].sort()
    // Forward-fill each bot's value across all dates
    const result = []
    const lastVal = Object.fromEntries(botsWithTrades.map(b => [b.name, 0]))
    for (const date of allDates) {
      const entry = { date }
      for (const bot of botsWithTrades) {
        if (seriesMap[bot.name][date] !== undefined) lastVal[bot.name] = seriesMap[bot.name][date]
        entry[bot.name] = lastVal[bot.name]
      }
      result.push(entry)
    }
    return result
  }, [botsWithTrades, tradesByBot, accounts])

  if (botsWithTrades.length === 0) {
    return (
      <Card style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>No bot trades yet</div>
        <div style={{ fontSize: 12, color: T.hint, marginTop: 4 }}>
          Import a QuantAnalyzer CSV and map magic numbers to bots to see analytics here.
        </div>
      </Card>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary table */}
      <Card style={{ padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Bot Comparison</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `0.5px solid ${T.border}` }}>
                {['Bot', 'Trades', 'Win Rate', 'Net % Return', 'Avg % / Trade', 'Profit Factor', 'Best Day %', 'Worst Day %'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Bot' ? 'left' : 'right', color: T.hint, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {botsWithTrades
                .map(bot => ({ bot, stats: computeStats(tradesByBot[bot.id] ?? []), botTrades: tradesByBot[bot.id] ?? [] }))
                .sort((a, b) => {
                  const netA = a.botTrades.reduce((s, t) => s + (t.pnl / (accounts.find(ac => ac.id === t.accountId)?.initialBalance ?? 10000)) * 100, 0)
                  const netB = b.botTrades.reduce((s, t) => s + (t.pnl / (accounts.find(ac => ac.id === t.accountId)?.initialBalance ?? 10000)) * 100, 0)
                  return netB - netA
                })
                .map(({ bot, stats, botTrades }, i) => {
                  const balanceFor = Object.fromEntries(accounts.map(a => [a.id, a.initialBalance]))
                  const netPct = botTrades.reduce((s, t) => s + (t.pnl / (balanceFor[t.accountId] ?? 10000)) * 100, 0)
                  const avgPct = botTrades.length ? netPct / botTrades.length : 0
                  // Best/worst day by %
                  const dayPct = {}
                  for (const t of botTrades) {
                    const d = t.closeTime.slice(0, 10)
                    dayPct[d] = (dayPct[d] ?? 0) + (t.pnl / (balanceFor[t.accountId] ?? 10000)) * 100
                  }
                  const dayVals = Object.values(dayPct)
                  const bestDay = dayVals.length ? Math.max(...dayVals) : 0
                  const worstDay = dayVals.length ? Math.min(...dayVals) : 0
                  return (
                    <tr key={bot.id} style={{ borderBottom: `0.5px solid ${T.border}` }}>
                      <td style={{ padding: '8px 10px', fontWeight: 500 }}>{bot.name}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{stats.total}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{(stats.winRate * 100).toFixed(1)}%</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: netPct >= 0 ? T.green : T.red, fontWeight: 500 }}>{netPct.toFixed(2)}%</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: avgPct >= 0 ? T.green : T.red }}>{avgPct.toFixed(3)}%</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{stats.profitFactor != null ? stats.profitFactor.toFixed(2) : '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: T.green }}>+{bestDay.toFixed(2)}%</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: T.red }}>{worstDay.toFixed(2)}%</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Multi-line equity curve */}
      {equityData.length > 0 && (
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Cumulative % Return</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={equityData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: T.hint }} />
              <YAxis tickFormatter={v => `${v.toFixed(1)}%`} tick={{ fontSize: 11, fill: T.hint }} />
              <Tooltip formatter={(v) => `${v.toFixed(2)}%`} contentStyle={{ background: T.card, border: `0.5px solid ${T.border}`, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {botsWithTrades.map((bot, i) => (
                <Line key={bot.id} type="monotone" dataKey={bot.name} stroke={BOT_COLOURS[i % BOT_COLOURS.length]} dot={false} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}

// ─── Per-bot detail ───────────────────────────────────────────────────────────

function BotDetailView({ bot, trades, accounts }) {
  const stats = useMemo(() => computeStats(trades), [trades])
  const balanceFor = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a.initialBalance])), [accounts])
  const equitySeries = useMemo(() => computeCumulativePctSeries(trades, accounts), [trades, accounts])

  const netPct = trades.reduce((s, t) => s + (t.pnl / (balanceFor[t.accountId] ?? 10000)) * 100, 0)
  const avgPct = trades.length ? netPct / trades.length : 0
  const avgWinPct = stats.winCount ? trades.filter(t => t.classification === 'win').reduce((s, t) => s + (t.pnl / (balanceFor[t.accountId] ?? 10000)) * 100, 0) / stats.winCount : 0
  const avgLossPct = stats.lossCount ? Math.abs(trades.filter(t => t.classification === 'loss').reduce((s, t) => s + (t.pnl / (balanceFor[t.accountId] ?? 10000)) * 100, 0) / stats.lossCount) : 0
  const bestTradePct = trades.length ? Math.max(...trades.map(t => (t.pnl / (balanceFor[t.accountId] ?? 10000)) * 100)) : 0
  const worstTradePct = trades.length ? Math.min(...trades.map(t => (t.pnl / (balanceFor[t.accountId] ?? 10000)) * 100)) : 0

  const sortedTrades = [...trades].sort((a, b) => new Date(b.closeTime) - new Date(a.closeTime))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header card */}
      <Card style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{bot.name}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {(bot.magicNumbers ?? []).map(n => (
                <span key={n} style={{ fontSize: 11, padding: '1px 7px', borderRadius: 3, background: T.surface, border: `0.5px solid ${T.border}`, color: T.hint }}>#{n}</span>
              ))}
              {(bot.pairs ?? []).map(p => (
                <span key={p} style={{ fontSize: 11, padding: '1px 7px', borderRadius: 3, background: T.indigoBg, color: T.indigo }}>{p}</span>
              ))}
            </div>
          </div>
        </div>
        {bot.strategyDescription && (
          <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6, marginBottom: 12 }}>{bot.strategyDescription}</div>
        )}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Trades', value: stats.total },
            { label: 'Win Rate', value: `${(stats.winRate * 100).toFixed(1)}%` },
            { label: 'Net % Return', value: `${netPct.toFixed(2)}%`, color: netPct >= 0 ? T.green : T.red },
            { label: 'Profit Factor', value: stats.profitFactor != null ? stats.profitFactor.toFixed(2) : '—' },
            { label: 'Expectancy', value: `${avgPct.toFixed(3)}% / trade` },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: T.hint, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: color ?? T.text }}>{value}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Two-column section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Equity curve */}
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Cumulative % Return</div>
          {equitySeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={equitySeries} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: T.hint }} />
                <YAxis tickFormatter={v => `${v.toFixed(1)}%`} tick={{ fontSize: 10, fill: T.hint }} />
                <Tooltip formatter={v => `${v.toFixed(2)}%`} contentStyle={{ background: T.card, border: `0.5px solid ${T.border}`, fontSize: 11 }} />
                <Line type="monotone" dataKey="pct" stroke={BOT_COLOURS[0]} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', color: T.hint, fontSize: 12, paddingTop: 60 }}>No data</div>
          )}
        </Card>

        {/* Breakdown */}
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Breakdown</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Wins', value: stats.winCount, color: T.green },
              { label: 'Losses', value: stats.lossCount, color: T.red },
              { label: 'Avg Win %', value: `+${avgWinPct.toFixed(3)}%`, color: T.green },
              { label: 'Avg Loss %', value: `-${avgLossPct.toFixed(3)}%`, color: T.red },
              { label: 'Best Trade %', value: `+${bestTradePct.toFixed(2)}%`, color: T.green },
              { label: 'Worst Trade %', value: `${worstTradePct.toFixed(2)}%`, color: T.red },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: T.hint }}>{label}</span>
                <span style={{ fontWeight: 500, color }}>{value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Trade table */}
      <Card style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Trades ({trades.length})</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `0.5px solid ${T.border}` }}>
                {['Date', 'Account', 'Symbol', 'Dir', 'PnL ($)', 'PnL (%)', 'Result'].map(h => (
                  <th key={h} style={{ padding: '5px 8px', textAlign: h === 'Date' || h === 'Account' || h === 'Symbol' || h === 'Dir' ? 'left' : 'right', color: T.hint, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedTrades.map(t => {
                const acct = accounts.find(a => a.id === t.accountId)
                const pct = (t.pnl / (acct?.initialBalance ?? 10000)) * 100
                return (
                  <tr key={t.id} style={{ borderBottom: `0.5px solid ${T.border}` }}>
                    <td style={{ padding: '6px 8px' }}>{t.closeTime.slice(0, 10)}</td>
                    <td style={{ padding: '6px 8px', color: T.hint }}>{acct?.label ?? t.accountId}</td>
                    <td style={{ padding: '6px 8px' }}>{t.symbol}</td>
                    <td style={{ padding: '6px 8px', color: t.direction === 'BUY' ? T.green : T.red }}>{t.direction}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: t.pnl >= 0 ? T.green : T.red }}>{t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: pct >= 0 ? T.green : T.red }}>{pct >= 0 ? '+' : ''}{pct.toFixed(3)}%</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: t.classification === 'win' ? T.green : T.red }}>{t.classification}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/BotsAnalyticsPage.jsx
git commit -m "feat: add BotsAnalyticsPage with sidebar, overview comparison, and per-bot detail"
```

---

## Task 8: Wire BotsAnalyticsPage into App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Replace the BotsPage import with BotsAnalyticsPage**

Find:
```js
import { BotsPage } from "./components/BotsPage.jsx";
```
Replace with:
```js
import { BotsAnalyticsPage } from "./components/BotsAnalyticsPage.jsx";
```

- [ ] **Step 2: Replace the Bots tab render in the page switch**

Find:
```js
{page==="bots"&&<BotsPage bots={data.bots||[]} onSave={saveBot} onDelete={deleteBot}/>}
```
Replace with:
```js
{page==="bots"&&<BotsAnalyticsPage
  bots={data.bots||[]}
  trades={data.trades||[]}
  accounts={mt5Accounts}
  onSaveBot={saveBot}
  onDeleteBot={deleteBot}
/>}
```

`mt5Accounts` is already defined at line 283 of App.jsx as `[...ACCOUNTS, ...(data.mt5Accounts || [])]` and is in scope for all page renders.

- [ ] **Step 3: Verify the app compiles and Bots tab loads**

```bash
npm run dev
```

Open the app → click "Bots" tab. Expected:
- Left sidebar shows "Overview", "Manage Bots"
- If trades have been imported from CSV with magic numbers mapped to bots: bot names appear in sidebar
- Overview shows the comparison table and equity chart
- Clicking a bot in sidebar shows the per-bot detail view
- "Manage Bots" shows the bot registry (add/edit/delete still works)

- [ ] **Step 4: End-to-end smoke test**

1. Import `QuantAnalyzer20120675.csv` via the import modal → 28 trades land with `magicNumber: 98753`
2. Go to Bots tab → Manage Bots → create or edit a bot → add magic number `98753` → save
3. Return to Overview — bot appears in the table with correct trade count, win rate, % return
4. Click the bot in the sidebar — per-bot detail view shows equity curve and trade table
5. XLSX import still works — drop an `.xlsx` file, trades import, no magic number set

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire BotsAnalyticsPage into Bots tab replacing BotsPage"
```
