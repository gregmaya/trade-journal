# Trade Journal v2 — Development Brief

**Repo:** https://github.com/gregmaya/trade-journal  
**Stack:** React + Vite, deployed via GitHub Pages  
**Date:** June 2026

---

## 1. Context & Goals

v1 is a file-based journal that imports Tradovate CSV exports, calculates P&L / R-multiples, and renders a trailing drawdown chart per account. It works but has two hard limits:

1. Manual import only — trades must be exported from the platform and dropped into the app.
2. Tradovate-only — the data pipeline assumes that CSV format; the new workflow runs MT5 accounts across multiple prop firms in parallel.

v2 introduces **on-demand MT5 data sync** (triggered manually, not automatic) and an **analytics layer** inspired by Myfxbook, while preserving all existing v1 logic, storage, and the personal rules engine planned in PROGRESS.md.

The guiding constraint throughout: **zero cost, zero server impact.** The Windows Server running the MT5 bots must stay clean — nothing new installed on it.

---

## 2. How MT5 Account Access Works

MT5 exposes a native **Investor Password** per account. It is a read-only credential — a third party logging in with it can see all account state (balance, equity, positions, full deal history) but cannot place, modify, or close any order. This is the standard mechanism used by Myfxbook, TradesViz, and FXBlue.

The credentials for this project follow that pattern: account number + investor password + server name (`FundingPips-SIM1`). The investor password is safe to pass to a third-party read API because it carries zero trading privileges.

---

## 3. Data Connection Strategy

### v2 connector: mtconnectapi.com (free tier)

**What it is:** A small cloud service that accepts an MT4/MT5 account number, investor password, and broker server address over a plain HTTPS GET request, then returns the full trade history as JSON. No SDK, no WebSocket, no backend required — a single `fetch()` call from the React app.

**Why it fits this project:**

- Zero server footprint — nothing installed on the Windows Server, ever.
- Zero persistent cost — 1,000 free API calls included on signup. With 4 accounts and a manual sync trigger, one "sync all" session costs 4 calls. That's roughly 250 full syncs, or about 8 months of daily use before hitting the limit.
- No backend required — the call goes directly from the browser. The investor password travels over HTTPS to their server, which is the same trust model as Myfxbook (read-only credential, industry standard).
- Dead-simple integration — one endpoint, one response, done.

**How it works:**

```
GET https://www.mtconnectapi.com/?a=getTradeHistory
  &apikey=[YOUR_API_KEY]
  &ac=[ACCOUNT_NUMBER]
  &t=[TRADE_SERVER_ADDRESS]     ← IP:port, not the friendly name
  &p=[INVESTOR_PASSWORD_AS_HEX] ← bin2hex() equivalent in JS
  &pl=MT5
  &l=0                          ← 0 = full history; use last ticket for incremental
```

One friction point: the `t` parameter requires the actual server IP and port (usually `:443`), not the friendly name `FundingPips-SIM1`. The service provides a `/Search` lookup to resolve broker names to IPs — do this once per account during setup and store the resolved address in the account config.

**Encoding the investor password in JavaScript:**

```js
function toHex(str) {
  return Array.from(new TextEncoder().encode(str))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

**Signup:** https://www.mtconnectapi.com — free, API key available immediately in the members area.

---

### v2 → v3 migration path: Python + MetaTrader5 package

When the free 1,000 calls are exhausted (or if the service changes), the replacement is the official MetaQuotes Python package (`pip install MetaTrader5`). It connects to the MT5 terminal already running on the Windows Server via local IPC — no network call, no third-party dependency, free forever.

**Server impact of the Python approach:**
- Disk: ~80–120 MB for a minimal Python install
- RAM: ~30 MB only while the sync script is actively running (it exits immediately after)
- Requirement: MT5 terminal must be open — already the case since the bots run 24/7

The Python script writes trade history to a JSON file that the React app reads on next load, or serves it via a minimal local HTTP endpoint if a live trigger is needed.

**Connector swap:** Because both connectors return the same normalised trade schema (section 5), migrating is a one-file change. The rest of the app — analytics, rules engine, storage — is untouched.

---

### Why Docker was ruled out

The `mt5rest` Docker image would provide a self-hosted REST API equivalent to mtconnectapi.com, but the overhead on a minimal Windows Server is prohibitive: Docker Engine on Windows Server requires Hyper-V or WSL2, carries ~1–2 GB of baseline RAM overhead, and adds significant disk usage. Against the goal of keeping the server clean, this is a non-starter.

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────┐
│              React + Vite (GitHub Pages)             │
│                                                      │
│  ┌─────────────────────┐  ┌────────────────────────┐ │
│  │  Per-account views   │  │  Cross-account dash    │ │
│  └──────────┬──────────┘  └───────────┬────────────┘ │
│             └──────────────┬──────────┘              │
│                     ┌──────▼──────┐                  │
│                     │  storage.js  │                  │
│                     │ (local JSON) │                  │
│                     └──────┬──────┘                  │
│                            │                         │
│                     ┌──────▼──────┐                  │
│                     │  connector  │  ← swappable      │
│                     │   layer     │                  │
│                     └──────┬──────┘                  │
└────────────────────────────┼────────────────────────┘
                             │ HTTPS GET (manual trigger)
                    ┌────────▼────────┐
                    │ mtconnectapi.com │   (v2)
                    │ Python script    │   (v3)
                    └────────┬────────┘
                             │ MT5 protocol / IPC
                    ┌────────▼────────┐
                    │ FundingPips-SIM1 │
                    │ (+ other servers)│
                    └─────────────────┘
```

**No backend server is needed for v2.** The connector call goes browser → mtconnectapi.com → broker server. The API key and investor passwords are entered by the user at runtime and held in memory only for the session — they are never committed to the repo or stored in localStorage.

---

## 5. Data Model

Normalise into a platform-agnostic trade schema. Both the mtconnectapi.com response and the future Python connector map into this same shape — that's what makes the connector swap in v3 a one-file change.

```js
{
  id: string,               // MT5 deal ticket
  accountId: string,        // links to account config
  platform: 'mt5',
  symbol: string,           // e.g. 'EURUSD'
  direction: 'BUY' | 'SELL',
  openTime: string,         // ISO8601, stored in UTC, displayed in NY time (UTC-4)
  closeTime: string,
  openPrice: number,
  closePrice: number,
  volume: number,           // lots
  commission: number,       // USD
  swap: number,             // USD
  pnl: number,              // net USD after commission + swap
  pips: number,
  rMultiple: number | null, // null if no stop loss recorded
  tags: string[],
  notes: string,
  sessionLabel: 'london' | 'new_york' | 'overlap' | 'other',
  ruleViolations: string[], // e.g. ['max_trades_session', 'max_daily_loss']
  classification: 'win' | 'loss' | 'be', // BE = within ±$50 (from PROGRESS.md)
  syncSource: 'mtconnect' | 'python' | 'csv_import' | 'manual',
  syncedAt: string          // ISO8601
}
```

**Session labelling logic** (entry time in UTC-4 / NY time):
- London: 03:00–05:00
- New York: 09:30–11:30
- Overlap: 08:00–09:30
- Other: everything else

**Backwards compatibility:** The existing v1 Tradovate trades map into this schema with `platform: 'mt5'` replaced by inferring from the import source, and `syncSource: 'csv_import'`. No data is lost.

---

## 6. Account Configuration

Stored in the app's state / localStorage — no passwords, no secrets.

```js
const ACCOUNTS = [
  {
    id: 'fp-20123435',
    label: 'FundingPips 25K',
    propFirm: 'FundingPips',
    platform: 'mt5',
    login: '20123435',
    serverName: 'FundingPips-SIM1',    // display only
    serverAddress: '123.456.789.0:443', // resolved once at setup via /Search
    currency: 'USD',
    initialBalance: 25000,
    profitTarget: 26250,   // +5%
    maxDailyLoss: 1250,    // 5% of balance
    maxTotalLoss: 1500,    // trailing drawdown limit
  },
  // repeat for each account
]
```

Investor passwords and the mtconnectapi.com API key are entered by the user in a settings panel on first use, held in `sessionStorage` (cleared on tab close), never persisted.

---

## 7. Analytics Features (Myfxbook-inspired)

All metrics are computed client-side from the stored trade array — no external analytics service needed.

### Per-account view
- Balance, equity, floating P&L at last sync
- Total net gain (%) since account start
- Daily / weekly / monthly gain
- Drawdown: absolute (from deposit), maximum (from peak), current, relative (%)
- Days traded, total trades, days since last trade

### Trade statistics
- Win rate (%)
- Average win / average loss — in USD and pips
- Best and worst single trade
- Profit factor (gross profit ÷ gross loss)
- Average trade duration
- Expectancy per trade (win rate × avg win) − (loss rate × avg loss)
- Average R:R (where stop loss was recorded)

### Time-based analysis
- P&L and win rate by session (London / New York / overlap)
- P&L by day of week
- Entry time heatmap (hour of day × day of week)
- Monthly P&L calendar

### Symbol analysis
- P&L and win rate per currency pair
- Most and least profitable pairs
- Average hold time per pair

### Personal rules engine (from PROGRESS.md)
- Configurable rules: max N trades per session, max daily loss in USD
- Each trade tagged with any violations at import time
- Rule adherence rate shown as a metric over time
- Filter views to "rule-compliant trades only" for clean performance comparison

### Cross-account dashboard
- Aggregate equity and net P&L across all accounts
- Per-account status: on track / in drawdown / at risk / passed
- Progress bars vs. profit target and drawdown limits
- Combined calendar showing all active trading days

---

## 8. Sync UX (Manual Trigger)

There is no background polling. The user presses a "Sync" button per account (or "Sync all"). The flow:

1. App calls mtconnectapi.com with the stored account config + session-held credentials.
2. Response JSON is parsed and mapped to the normalised trade schema.
3. New trades are merged into the local JSON store (deduplication by deal ticket ID).
4. UI updates. Last synced timestamp is shown per account.

The app remains fully functional between syncs using stored local data — sync is additive, never destructive.

**Deduplication key:** MT5 deal ticket ID is unique per account. Simple `Map` lookup is sufficient — no composite key needed unlike with CSV imports.

---

## 9. Carrying Forward v1 Fixes

All items listed in PROGRESS.md as "Upgrades" must be resolved before or during v2, not deferred:

- BE classification based on USD ±$50, not ticks
- Times stored and displayed in NY time (UTC-4), not local server time
- Entry always earlier than exit (fix SHORT labelling)
- Surface entry time in the trades list
- Entry price / avg exit corrected for direction (SHORT: entry above exit = profitable)
- Ticks rounded to nearest integer
- Dashboard accounts KPIs — debug blank state
- Replace "Net P&L (ticks)" KPI with "Avg profitable ticks"
- Y-axis label on drawdown chart, range anchored to account parameters
- Tooltips explaining how KPIs are calculated

---

## 10. Build Sequence for VS Code

1. **Spike — resolve server address.** Use the mtconnectapi.com `/Search` endpoint to find the IP:port for `FundingPips-SIM1`. Store it in the account config. Confirm the full API call returns trade history for account `20123435`.

2. **Normalise the data.** Write `mapMtConnectTrade(raw) → Trade`. Write `mapTradovateCsv(row) → Trade` to maintain v1 compatibility. Cover edge cases: SHORTs, commissions, zero-volume balance entries to exclude.

3. **Connector layer.** Build `connector/mtconnect.js` — a module that takes account config + credentials and returns `Trade[]`. This is the file that gets replaced in v3.

4. **Sync UI.** Add a settings panel for API key + investor passwords (session-held). Add sync buttons per account with loading state and last-synced timestamp.

5. **Storage merge.** Update `storage.js` to accept the normalised schema alongside existing v1 data. Implement deduplication by ticket ID.

6. **Carry forward v1 fixes.** Work through the PROGRESS.md upgrade list before building new analytics — cleaner foundation.

7. **Per-account analytics.** Build the statistics, drawdown, time-based, and symbol views on top of the normalised store.

8. **Personal rules engine.** Rules config UI, violation tagging on import, adherence metrics.

9. **Cross-account dashboard.** Aggregate view, status indicators, combined calendar.

---

## 11. v3 Connector Swap (future reference)

When the 1,000 free mtconnectapi.com calls are used up, replace `connector/mtconnect.js` with `connector/python.js`. The Python side is a small script on the Windows Server:

```python
import MetaTrader5 as mt5
import json, sys
from datetime import datetime

mt5.initialize()
deals = mt5.history_deals_get(
    datetime(2024, 1, 1),
    datetime.now()
)
print(json.dumps([d._asdict() for d in deals]))
mt5.shutdown()
```

The React app triggers this via a tiny local HTTP endpoint (one-file Express or Python `http.server`), receives the same JSON, maps it through the same `mapMtConnectTrade()` normaliser, and the rest of the app is untouched. Python install footprint on the Windows Server: ~100 MB disk, ~30 MB RAM while running, zero persistent overhead.

Nothing else in the codebase changes.
