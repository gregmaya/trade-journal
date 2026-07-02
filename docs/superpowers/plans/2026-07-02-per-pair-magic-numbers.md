# Per-Pair Magic Numbers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat `bot.magicNumbers: number[]` with a per-pair map `bot.pairMagicNumbers: { [pair: string]: number[] }` so each bot-pair combination has its own magic number, enabling per-pair trade analytics.

**Architecture:** `resolveBotForTrade` is updated to search `pairMagicNumbers` and return `{ bot, pair }` instead of just the bot. The bot editor replaces the single tag-input with a per-pair input per `parsedPairs`. The analytics page groups trades by both bot and pair, and `BotDetailView` gains a per-pair stats table.

**Tech Stack:** React 19, Vite, Vitest 3.x (`npx vitest run`), no backend, file-based JSON storage.

## Global Constraints

- No new npm packages.
- All `%` metrics divide `t.pnl` by `account.initialBalance` (not raw USD).
- Commit directly to `main` — no feature branches.
- Test command: `npx vitest run`. All 49 existing tests must still pass after every task.
- Old flat `bot.magicNumbers` field: silently ignored going forward (no migration). Existing bots will have an empty `pairMagicNumbers: {}` until the user re-enters their magic numbers.

---

## File Map

| File | Change |
|------|--------|
| `src/utils/botUtils.js` | Replace `magicNumbers` lookup with `pairMagicNumbers`; return `{ bot, pair }` |
| `src/__tests__/botUtils.test.js` | Rewrite all 5 tests for the new fixture shape and return type |
| `src/components/BotsPage.jsx` | Replace flat tag-input with per-pair magic number inputs; update card display |
| `src/components/BotsAnalyticsPage.jsx` | Update `resolveBotForTrade` call sites; add `tradesByBotPair` memo; add per-pair table in `BotDetailView` |

---

### Task 1: Update `botUtils.js` + tests

**Files:**
- Modify: `src/utils/botUtils.js`
- Modify: `src/__tests__/botUtils.test.js`

**Interfaces:**
- Produces: `resolveBotForTrade(trade, bots) → { bot: object, pair: string } | null`
  - Searches each bot's `pairMagicNumbers: { [pair]: number[] }` map.
  - Returns `null` if `trade.magicNumber` is `null` or no bot-pair matches.
  - Bots without a `pairMagicNumbers` field are skipped gracefully.

- [ ] **Step 1: Rewrite `botUtils.test.js` with the new fixture shape**

Replace the entire file content:

```js
import { describe, it, expect } from 'vitest'
import { resolveBotForTrade } from '../utils/botUtils.js'

const bots = [
  { id: 'bot-1', name: 'Alpha', pairMagicNumbers: { EURUSD: [98753], GBPUSD: [12345] } },
  { id: 'bot-2', name: 'Beta',  pairMagicNumbers: { AUDUSD: [99999] } },
]

describe('resolveBotForTrade', () => {
  it('returns { bot, pair } when magicNumber is found in pairMagicNumbers', () => {
    expect(resolveBotForTrade({ magicNumber: 98753 }, bots)).toEqual({ bot: bots[0], pair: 'EURUSD' })
  })

  it('returns the correct pair when magicNumber matches a different pair on the same bot', () => {
    expect(resolveBotForTrade({ magicNumber: 12345 }, bots)).toEqual({ bot: bots[0], pair: 'GBPUSD' })
  })

  it('returns the correct bot when magicNumber is on the second bot', () => {
    expect(resolveBotForTrade({ magicNumber: 99999 }, bots)).toEqual({ bot: bots[1], pair: 'AUDUSD' })
  })

  it('returns null when no bot matches', () => {
    expect(resolveBotForTrade({ magicNumber: 11111 }, bots)).toBeNull()
  })

  it('returns null when trade.magicNumber is null', () => {
    expect(resolveBotForTrade({ magicNumber: null }, bots)).toBeNull()
  })

  it('handles bots with missing pairMagicNumbers field gracefully', () => {
    expect(resolveBotForTrade({ magicNumber: 98753 }, [{ id: 'bot-3', name: 'Gamma' }])).toBeNull()
  })

  it('handles a pair with multiple magic numbers', () => {
    const multi = [{ id: 'b', name: 'Multi', pairMagicNumbers: { EURUSD: [111, 222] } }]
    expect(resolveBotForTrade({ magicNumber: 222 }, multi)).toEqual({ bot: multi[0], pair: 'EURUSD' })
  })
})
```

- [ ] **Step 2: Run tests — expect 7 failures (function not yet updated)**

```bash
npx vitest run src/__tests__/botUtils.test.js
```

Expected: 7 tests fail (return type mismatch and `pairMagicNumbers` not searched).

- [ ] **Step 3: Rewrite `src/utils/botUtils.js`**

Replace the entire file:

```js
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
```

- [ ] **Step 4: Run tests — expect all 7 to pass**

```bash
npx vitest run src/__tests__/botUtils.test.js
```

Expected: 7 passed.

- [ ] **Step 5: Run full suite — expect all 49 to pass**

```bash
npx vitest run
```

Expected: 49 passed (the old 5 botUtils tests are replaced by the new 7; net is +2).

- [ ] **Step 6: Commit**

```bash
git add src/utils/botUtils.js src/__tests__/botUtils.test.js
git commit -m "feat: resolveBotForTrade uses pairMagicNumbers and returns { bot, pair }"
```

---

### Task 2: Per-pair magic number editor in `BotsPage.jsx`

**Files:**
- Modify: `src/components/BotsPage.jsx`

**Interfaces:**
- Consumes: `bot.pairMagicNumbers: { [pair: string]: number[] }` (Task 1 shape)
- Produces: `onSave(bot)` where `bot.pairMagicNumbers` is `{ [pair]: number[] }` (pairs without any magic numbers are omitted). The old `magicNumbers` field is no longer written.

This task has no unit tests (pure UI). Verify visually that (a) adding a pair shows a magic number input for it, (b) entering a number and pressing Enter adds a chip, (c) clicking × removes it, and (d) the bot card shows `{pair}: #{n}` chips.

- [ ] **Step 1: Update `BOT_DEFAULTS` and `BotForm` initial state**

In `BotsPage.jsx`, replace:

```js
const BOT_DEFAULTS = { id: '', name: '', pairs: '', lotSizes: {}, strategyDescription: '', magicNumbers: [] }
```

with:

```js
const BOT_DEFAULTS = { id: '', name: '', pairs: '', lotSizes: {}, strategyDescription: '', pairMagicNumbers: {} }
```

In `BotForm`, replace the `useState` initialiser spread:

```js
// old
...(bot ? { ...bot, pairs: (bot.pairs || []).join(', '), lotSizes: seedLotSizes(bot), magicNumbers: bot.magicNumbers ?? [] } : {}),
```

with:

```js
// new
...(bot ? { ...bot, pairs: (bot.pairs || []).join(', '), lotSizes: seedLotSizes(bot), pairMagicNumbers: bot.pairMagicNumbers ?? {} } : {}),
```

- [ ] **Step 2: Replace the magic-number helper functions**

Remove `addMagicNumber` and `removeMagicNumber`. Add:

```js
function addMagicNumber(pair, input) {
  const n = parseInt(input, 10)
  if (isNaN(n)) return
  const current = f.pairMagicNumbers[pair] ?? []
  if (current.includes(n)) return
  s('pairMagicNumbers', { ...f.pairMagicNumbers, [pair]: [...current, n] })
}

function removeMagicNumber(pair, n) {
  const next = (f.pairMagicNumbers[pair] ?? []).filter(x => x !== n)
  const updated = { ...f.pairMagicNumbers }
  if (next.length === 0) delete updated[pair]
  else updated[pair] = next
  s('pairMagicNumbers', updated)
}
```

- [ ] **Step 3: Update `handleSave`**

Replace:

```js
magicNumbers: f.magicNumbers,
```

with:

```js
pairMagicNumbers: Object.fromEntries(
  Object.entries(f.pairMagicNumbers).filter(([, magics]) => magics.length > 0)
),
```

- [ ] **Step 4: Replace the magic-number UI block in `BotForm`**

Remove the existing `<div>` block that renders the flat `<label>Magic Numbers</label>` tag-input. Replace it with a per-pair section that only renders when pairs have been entered:

```jsx
{parsedPairs.length > 0 && (
  <div>
    <label style={labelStyle}>Magic Numbers (per pair)</label>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {parsedPairs.map(pair => (
        <div key={pair}>
          <div style={{ fontSize: 11, color: T.hint, marginBottom: 4 }}>{pair}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
            {(f.pairMagicNumbers[pair] ?? []).map(n => (
              <span key={n} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: T.surface, border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 4 }}>
                #{n}
                <button onClick={() => removeMagicNumber(pair, n)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1, color: T.hint, padding: 0 }}>×</button>
              </span>
            ))}
          </div>
          <input
            style={inputStyle}
            type="number"
            placeholder={`Magic number for ${pair}`}
            onKeyDown={e => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                addMagicNumber(pair, e.target.value.trim())
                e.target.value = ''
                e.preventDefault()
              }
            }}
          />
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 5: Update the bot card display**

Find the block that renders magic number chips on the bot card (currently checking `(bot.magicNumbers ?? []).length > 0`). Replace it with:

```jsx
{Object.entries(bot.pairMagicNumbers ?? {}).some(([, m]) => m?.length > 0) && (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
    {Object.entries(bot.pairMagicNumbers ?? {}).flatMap(([pair, magics]) =>
      (magics ?? []).map(n => (
        <span key={`${pair}-${n}`} style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, background: T.surface, border: `0.5px solid ${T.border}`, color: T.hint }}>
          {pair}: #{n}
        </span>
      ))
    )}
  </div>
)}
```

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run
```

Expected: 51 passed (no new tests for UI, but all existing must pass).

- [ ] **Step 7: Commit**

```bash
git add src/components/BotsPage.jsx
git commit -m "feat: per-pair magic number inputs in bot editor"
```

---

### Task 3: Update `BotsAnalyticsPage.jsx` for per-pair analytics

**Files:**
- Modify: `src/components/BotsAnalyticsPage.jsx`

**Interfaces:**
- Consumes:
  - `resolveBotForTrade(trade, bots) → { bot, pair } | null` (Task 1)
  - `bot.pairMagicNumbers: { [pair]: number[] }` (Task 2)
- Produces: `BotDetailView` renders a per-pair stats table when a bot has trades on more than one pair (or always — even single-pair bots benefit from seeing the pair explicitly).

- [ ] **Step 1: Update the main `useMemo` to track trades by bot-pair**

In `BotsAnalyticsPage`, replace the entire `useMemo` block:

```js
// old
const { tradesByBot, botsWithTrades, botsWithoutTrades } = useMemo(() => {
  const map = {}
  for (const t of trades) {
    const bot = resolveBotForTrade(t, bots)
    if (!bot) continue
    if (!map[bot.id]) map[bot.id] = []
    map[bot.id].push(t)
  }
  return {
    tradesByBot: map,
    botsWithTrades: bots.filter(b => map[b.id]?.length > 0),
    botsWithoutTrades: bots.filter(b => !map[b.id]?.length),
  }
}, [trades, bots])
```

with:

```js
// new
const { tradesByBot, tradesByBotPair, botsWithTrades, botsWithoutTrades } = useMemo(() => {
  const byBot = {}
  const byBotPair = {}
  for (const t of trades) {
    const resolved = resolveBotForTrade(t, bots)
    if (!resolved) continue
    const { bot, pair } = resolved
    if (!byBot[bot.id]) byBot[bot.id] = []
    byBot[bot.id].push(t)
    if (!byBotPair[bot.id]) byBotPair[bot.id] = {}
    if (!byBotPair[bot.id][pair]) byBotPair[bot.id][pair] = []
    byBotPair[bot.id][pair].push(t)
  }
  return {
    tradesByBot: byBot,
    tradesByBotPair: byBotPair,
    botsWithTrades: bots.filter(b => byBot[b.id]?.length > 0),
    botsWithoutTrades: bots.filter(b => !byBot[b.id]?.length),
  }
}, [trades, bots])
```

- [ ] **Step 2: Pass `tradesByPair` into `BotDetailView`**

Find the `<BotDetailView>` render call and add the new prop:

```jsx
// old
<BotDetailView
  bot={bot}
  trades={tradesByBot[bot.id] ?? []}
  accounts={accounts}
/>
```

```jsx
// new
<BotDetailView
  bot={bot}
  trades={tradesByBot[bot.id] ?? []}
  tradesByPair={tradesByBotPair[bot.id] ?? {}}
  accounts={accounts}
/>
```

- [ ] **Step 3: Update `BotDetailView` signature and header magic-number chips**

Change the function signature:

```js
// old
function BotDetailView({ bot, trades, accounts }) {
```

```js
// new
function BotDetailView({ bot, trades, tradesByPair, accounts }) {
```

In the header card, find the magic-number chip block (currently rendering `(bot.magicNumbers ?? []).map(n => ...)`). Replace it with per-pair chips:

```jsx
{/* old */}
{(bot.magicNumbers ?? []).map(n => (
  <span key={n} style={{ fontSize: 11, padding: '1px 7px', borderRadius: 3, background: T.surface, border: `0.5px solid ${T.border}`, color: T.hint }}>#{n}</span>
))}
```

```jsx
{/* new */}
{Object.entries(bot.pairMagicNumbers ?? {}).flatMap(([pair, magics]) =>
  (magics ?? []).map(n => (
    <span key={`${pair}-${n}`} style={{ fontSize: 11, padding: '1px 7px', borderRadius: 3, background: T.surface, border: `0.5px solid ${T.border}`, color: T.hint }}>
      {pair}: #{n}
    </span>
  ))
)}
```

- [ ] **Step 4: Add per-pair breakdown card in `BotDetailView`**

Insert the following card **between** the two-column section (equity + breakdown) and the trade table. It renders for all bots — single-pair bots show one row, multi-pair bots show one row per pair:

```jsx
{/* Per-pair breakdown */}
{Object.keys(tradesByPair).length > 0 && (
  <Card style={{ padding: 16 }}>
    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Per-Pair Breakdown</div>
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `0.5px solid ${T.border}` }}>
            {['Pair', 'Trades', 'Win Rate', 'Net %', 'Avg % / Trade', 'Profit Factor'].map(h => (
              <th key={h} style={{ padding: '5px 8px', textAlign: h === 'Pair' ? 'left' : 'right', color: T.hint, fontWeight: 500 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(tradesByPair).map(([pair, pairTrades]) => {
            const ps = computeStats(pairTrades)
            const netPct = pairTrades.reduce((s, t) => s + (t.pnl / (balanceFor[t.accountId] ?? 10000)) * 100, 0)
            const avgPct = pairTrades.length ? netPct / pairTrades.length : 0
            return (
              <tr key={pair} style={{ borderBottom: `0.5px solid ${T.border}` }}>
                <td style={{ padding: '6px 8px', fontWeight: 500 }}>{pair}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{ps.total}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{(ps.winRate * 100).toFixed(1)}%</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: netPct >= 0 ? T.green : T.red, fontWeight: 500 }}>{netPct >= 0 ? '+' : ''}{netPct.toFixed(2)}%</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: avgPct >= 0 ? T.green : T.red }}>{avgPct >= 0 ? '+' : ''}{avgPct.toFixed(3)}%</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{ps.profitFactor != null ? ps.profitFactor.toFixed(2) : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  </Card>
)}
```

Note: `balanceFor` is already defined earlier in `BotDetailView` as:
```js
const balanceFor = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a.initialBalance])), [accounts])
```
It is already in scope — do not redeclare it.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: 51 passed.

- [ ] **Step 6: Run the build**

```bash
npm run build
```

Expected: clean build with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/BotsAnalyticsPage.jsx
git commit -m "feat: per-pair trade grouping and breakdown table in BotDetailView"
```
