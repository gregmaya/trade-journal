# Bot Analytics — Design Spec
_2026-07-01_

## Context

The journal currently assigns bots to trades indirectly: the user manually picks which bot(s) ran on a given day for a given account (`dailyBotAssignments`). This makes cross-account bot performance analysis impossible — you can't tell which bot made which individual trade, especially when multiple bots run on the same account or the same bot runs across several accounts.

QuantAnalyzer (a third-party MT5 analysis tool) exports a CSV that includes a **magic number** per trade — the numeric ID an Expert Advisor (EA/bot) embeds in every order it places. This is the reliable, per-trade source of truth for bot identity.

This spec covers:
1. Storing magic number on trades (schema)
2. A new QuantAnalyzer CSV importer
3. Magic number → bot mapping in the bot registry
4. A new Bot Analytics page with cross-bot comparison and per-bot deep-dive
5. Removal of the Daily Bot Log UI

---

## 1. Data Model Changes

### Trade schema (`src/utils/tradeSchema.js`)

Add two optional fields:

```js
/**
 * @property {number|null}  magicNumber   — EA identifier from QuantAnalyzer CSV; null for XLSX imports
 * @property {string|null}  orderComment  — MT5 order comment field; also used as trade id for CSV imports
 */
```

XLSX-imported trades keep both as `null`. No migration needed for existing trades.

### Bot schema (`src/components/BotsPage.jsx`, `src/storage.js`)

Add one field:

```js
magicNumbers: number[]   // EA magic numbers this bot uses; user-defined; default []
```

### Storage

`dailyBotAssignments` stays in the data file (no migration, no data loss) but the UI that writes to it is removed. It becomes inert legacy data.

### Bot resolution (new utility)

```js
// src/utils/botUtils.js
export function resolveBotForTrade(trade, bots) {
  if (trade.magicNumber == null) return null
  return bots.find(b => b.magicNumbers.includes(trade.magicNumber)) ?? null
}
```

Called at render time wherever the UI needs to show which bot made a trade. No denormalisation.

---

## 2. QuantAnalyzer CSV Importer

### New file: `src/utils/parseQuantAnalyzerCsv.js`

Parses the QuantAnalyzer export format. The file starts with `sep=,` which is skipped. Remaining rows are comma-separated with these column positions:

| Index | Column | Usage |
|-------|--------|-------|
| 0 | Type | Skip rows where value ≠ `"Closed position"` |
| 1 | Ticket | Ignored (QuantAnalyzer's own row counter, not MT5 ticket) |
| 2 | Symbol | `symbol` |
| 3 | Lots | `volume` |
| 4 | Buy/sell | `direction` |
| 5 | Open Price | `openPrice` |
| 6 | Close price | `closePrice` |
| 7 | Open time | `openTime` |
| 8 | Close time | `closeTime` |
| 11 | Profit | gross profit |
| 12 | Swap | `swap` |
| 13 | Commission | `commission` |
| 14 | Net profit | `pnl` |
| 20 | Magic number | `magicNumber` |
| 21 | Order comment | `orderComment` and trade `id` |
| 22 | Account | login number for account detection |

The parser calls the existing `mapMtConnectTrade()` for all shared normalisation (session labelling, classification, pnl calculation), passing `magicNumber` and `orderComment` as additional fields.

Trade `id` = `orderComment` value (e.g. `"639929044"`). This is a stable MT5 identifier distinct from the XLSX position ticket numbering — the two systems are not interoperable for deduplication, so a clean re-import from CSV is required when switching.

Existing XLSX-imported trades remain in the store with `magicNumber: null`. They will not appear in bot analytics. The user removes them by deleting the account's trades and re-importing via CSV, or by accepting that older XLSX trades are excluded from bot analytics.

Account detection uses the login from column 22, matched against known accounts exactly as the XLSX flow does.

### Updated: `src/components/Mt5ImportModal.jsx`

File-type detection on drop/select:
- `.xlsx` → existing XLSX flow (unchanged)
- `.csv` → new QuantAnalyzer CSV flow

No other changes to the import modal UI. Account creation / preview / merge steps are identical for both formats.

---

## 3. Magic Number → Bot Mapping

### Updated: `src/components/BotsPage.jsx`

The bot editor form gains a **Magic Numbers** tag-input field:
- User types a number → press Enter (or comma) to add
- Each added number shown as a chip with × to remove
- Multiple numbers supported (e.g. bot updated its ID across versions)
- Magic numbers displayed inline on the bot card in the list view

No other structural changes to the Bots registry page. Name, pairs, lot sizes, and strategy description fields are unchanged.

### Removed: Daily Bot Log

`src/components/DailyBotLog.jsx` — deleted.

The "Daily Bot Log" sub-tab inside `src/components/Mt5AccountAnalytics.jsx` — removed. The `assignBots` and `assignBotsBulk` handlers in `App.jsx` — removed (or kept but dead if needed for rollback safety).

---

## 4. Bot Analytics Page

### New file: `src/components/BotsAnalyticsPage.jsx`

Replaces `BotsPage.jsx` as the target of the **Bots** top-level tab in `App.jsx`.

The existing bot registry/editor is moved into a sub-section accessible via a "Manage Bots" link at the bottom of the sidebar.

### Layout

Left sidebar + main content, mirroring `Mt5AccountAnalytics`.

**Sidebar items:**
- **Overview** (default) — cross-bot comparison
- One item per bot that has at least one trade with a matching magic number
- Bots with no matching trades shown greyed out (still clickable for info)
- **Manage Bots** link at the bottom → bot registry/editor

---

### Overview view

A summary table, one row per bot, default-sorted by Net % Return descending:

| Bot | Trades | Win Rate | Net % Return | Avg % / Trade | Profit Factor | Best Day % | Worst Day % |

Below the table: a multi-line equity curve (one line per bot) showing cumulative % return over time on a shared time axis. Uses Recharts `LineChart` (same component family as Dashboard).

**% normalisation:** all percentage metrics divide PnL by the `initialBalance` of the account the trade ran on. This makes cross-account comparison meaningful regardless of account size. Raw $ PnL is shown as a secondary value where space allows but is not the primary sort/comparison axis.

---

### Per-bot view

**Header card:**
- Bot name, magic number(s) as badges, pairs, strategy description
- Stats row: total trades · win rate · net % return · profit factor · expectancy (avg % per trade)

**Two-column section:**
- Left: cumulative % equity curve (all accounts combined, coloured by account)
- Right: win/loss bar breakdown · avg win % · avg loss % · best trade % · worst trade %

**Trade table** (bottom, full width):
Columns: Date · Account · Symbol · Direction · PnL ($) · PnL (%) · Result

Sorted by date descending. No pagination needed for expected data volumes.

### Analytics computation

All metrics computed by calling the existing `computeStats(trades)` from `src/utils/analytics.js` on the bot-filtered trade set. No new analytics functions needed for the summary stats.

New helper needed: `computeCumulativePctSeries(trades, accounts)` — similar to the existing `computeProfitPctSeries` but normalised to account `initialBalance` and aggregated across multiple accounts. Lives in `src/utils/analytics.js`.

---

## 5. Verification

1. **CSV import:** drop `QuantAnalyzer20120675.csv` → modal detects CSV → account auto-detected as `fp-20120675` → preview shows 28 trades with magic numbers populated → confirm → trades in store have `magicNumber: 98753` and `orderComment` values matching the CSV.
2. **Bot mapping:** open Bots tab → edit a bot → add magic number `98753` → save → bot card shows the number.
3. **Bot resolution:** after import + mapping, open Bots Analytics tab → bot appears in sidebar with 28 trades → % metrics computed correctly.
4. **Overview comparison:** with two or more bots mapped, Overview table shows all bots; equity curve renders multiple lines.
5. **XLSX import still works:** drop an `.xlsx` file → existing flow unchanged → trades have `magicNumber: null` → bot analytics ignores them.
6. **No daily bot log:** Dashboard no longer shows the Daily Bot Log sub-tab.
