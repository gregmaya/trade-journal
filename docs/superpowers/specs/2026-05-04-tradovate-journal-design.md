# Trade Journal — Tradovate Import Redesign
**Design Spec**
Date: 2026-05-04

---

## Design Spec

### 1. Data Model

#### Trade
```ts
{
  // Fill data — immutable, populated from Tradovate CSV
  fill: {
    buyFillId: string           // natural dedup key (grouped trade identifier)
    sellFillIds: string[]       // one per partial exit
    symbol: string              // e.g. "MNQM6"
    qty: number                 // total contracts (summed across partials)
    buyPrice: number            // entry price
    avgSellPrice: number        // weighted avg across partial exits
    tickSize: number            // from _tickSize field (0.25 for MNQ/NQ)
    grossPnlDollars: number     // raw from Tradovate (commissions NOT deducted)
    commissionTotal: number     // qty × commissionPerContract (looked up by symbol)
    netPnlDollars: number       // grossPnlDollars - commissionTotal
    pnlTicks: number            // (avgSellPrice - buyPrice) / tickSize (signed for direction)
    netPnlTicks: number         // netPnlDollars / (tickValue × qty)
    direction: "Long" | "Short" // inferred from price comparison
    outcome: "win"|"be"|"loss"  // computed vs beThresholdTicks
    boughtTimestamp: string     // ISO datetime
    soldTimestamp: string       // ISO datetime
    durationSec: number
    source: "tradovate"
  }

  // Journal annotations — all optional, manually entered
  journal: {
    accountId: string
    riskTicks: number | null    // manually entered
    rCollected: number | null   // pnlTicks / riskTicks (auto-computed)
    strategy: string            // from strategies list
    tags: string[]
    notes: string
    tradingViewUrl: string      // clickable link in trade detail
    rating: number              // 0–5
  }
}
```

#### Account
```ts
{
  id: string
  name: string                  // e.g. "APEX-526978-06"
  firmId: string                // official account ID
  type: "eval" | "pa" | "personal"
  broker: string                // e.g. "Tradovate"
  firm: string                  // e.g. "Apex"
  startingBalance: number       // e.g. 50000
  drawdownBuffer: number        // e.g. 2000 (Apex legacy)
  lockLevel: number | null      // null=eval (no lock), startingBalance+100 for PA
}
```

Drawdown floor logic:
```
eval:     floor(day) = max(EOD balances up to day) - drawdownBuffer
pa:       floor(day) = min(floor above, lockLevel)
personal: no drawdown
```
EOD balance per day = startingBalance + sum(netPnlDollars for all trades on/before that date)

#### Settings (global)
```ts
{
  strategies: string[]          // ["ORB","ILM","Model","NONE"]
  tags: string[]                // free-form tag library
  beThresholdTicks: number      // default 3
  commissions: {
    micro: number               // default 1.03 (MNQ, MES, MYM)
    mini: number                // default 3.50 (NQ, ES, YM)
  }
}
```

Symbol → commission tier mapping:
- micro: MNQ, MES, MYM, M2K → $1.03/contract
- mini: NQ, ES, YM, RTY → $3.50/contract

---

### 2. Storage — File System Access API

New module `src/storage.js`:
- `openFile()` — file picker, stores handle in sessionStorage
- `readData()` → parsed JSON
- `writeData(data)` → serialize + write
- `hasHandle()` → boolean

App boot sequence:
1. If `hasHandle()` → `readData()` → hydrate state
2. Else → show "Open data file" screen with picker button
3. On any `setData()` call → `writeData()` immediately

Fallback: if `window.showOpenFilePicker` not available → localStorage + visible warning banner.

---

### 3. Import Flow — Tradovate CSV

CSV columns used: `symbol, _tickSize, buyFillId, sellFillIds, qty, buyPrice, sellPrice, pnl, boughtTimestamp, soldTimestamp, duration`

Steps:
1. Parse all rows
2. Group by `buyFillId`
3. Per group compute: sum pnl, weighted avg sellPrice, sum qty, first boughtTimestamp, last soldTimestamp
4. Determine commission tier from symbol prefix
5. Compute: commissionTotal, netPnlDollars, pnlTicks, netPnlTicks, direction, outcome
6. Filter: skip buyFillIds already in `data.trades` → show "N skipped (duplicates)"
7. Preview table: Symbol | Dir | Qty | Gross P&L | Net P&L | Ticks | Duration
8. User selects account → confirm → trades added with empty journal annotations

---

### 4. UI Changes

#### Remove
- Google Sheets CSV importer and its parser (`parseGSheetCSV`)
- `emaBias`, `trailed`, `size`, `timeframe`, `tradeType` fields from trade form
- R-based metrics from dashboard (replaced with tick + dollar equivalents)

#### Keep / Adapt
- Dashboard layout, calendar, strategy chart
- Account cards (updated with drawdown chart)
- Trade log table (new columns)
- Settings page (updated fields)

#### Trade Log columns
`Date | Symbol | Dir | Qty | Gross P&L | Net P&L | Ticks | R | Strategy | Tags | Account | ★`

#### Trade detail — side panel (replaces modal)
Two sections:
- **Fill** (read-only): symbol, direction, qty, entry, avg exit, gross P&L, net P&L, ticks, duration, timestamp
- **Journal** (editable): risk ticks → R (auto), strategy, tags, notes, TradingView URL (clickable), rating

#### Calendar cell
```
[ 4 ]
+$584 net
5 trades
```

#### Dashboard metrics
`Net P&L ($) | Net P&L (ticks) | Win% | BE% | Avg R | Profit factor | Trades today`

- **Win%** = `wins / (wins + losses) × 100` (BE excluded from denominator)
- **BE%** = `be trades / total trades × 100`
- All P&L figures use netPnlDollars

Both metrics appear in Dashboard, Analytics breakdown tables (per strategy, per account, per day-of-week), and Account cards.

#### Account drawdown chart (Accounts page, per account)
- Line 1: EOD balance
- Line 2: trailing drawdown floor
- Color fill: green (>50% buffer) → yellow (25–50%) → red (<25%)
- Dashed horizontal line at `lockLevel` (PA accounts only)
- Tooltip: date, EOD balance, floor, buffer remaining ($)

---

### 5. Deployment

`vite.config.js`:
```js
base: '/trade-journal/'
```

`.github/workflows/deploy.yml`:
- Trigger: push to `main`
- Steps: checkout → setup Node 20 → `npm ci` → `npm run build` → deploy `dist/` to `gh-pages` branch via `peaceiris/actions-gh-pages`
- Live URL: `https://<username>.github.io/trade-journal/`

---

### 6. PROGRESS.md (create at repo root)

```md
# Trade Journal — Progress & Roadmap

## v1 (current) — Tradovate Import + File-based Storage
- File System Access API (local JSON file, portable)
- Tradovate CSV import with grouping + deduplication
- Tick-based P&L + R tracking (commission-aware)
- Trailing drawdown chart per account (eval / PA rules)
- GitHub Pages deployment

## Future — Cloud Storage Migration
- Replace FSA adapter in storage.js with Supabase (Postgres + Auth)
- Same data schema, single file change
- Multi-device access without manual file management
- Target: when actively managing 3+ accounts simultaneously
```
