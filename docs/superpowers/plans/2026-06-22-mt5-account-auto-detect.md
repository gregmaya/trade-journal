# MT5 Account Auto-Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect which MT5 account a "Save as Report" xlsx belongs to from the report's own `Account:` header row, instead of requiring the user to pick it from a dropdown — and offer to create a new account on the spot when the login number isn't recognized.

**Architecture:** Split the existing xlsx parser into a row-extraction step and a Positions-extraction step so the login can be read before trades are parsed. Accounts created at runtime are stored in the journal's `.json` data file (`data.mt5Accounts`) and merged with the hand-edited seed list in `accounts.js` everywhere the app reads the MT5 account list.

**Tech Stack:** React 19, Vite, fflate (xlsx unzip), vitest.

## Global Constraints

- `accounts.js` stays a hand-edited seed list — do not add write-back logic to it.
- `parseMt5XlsxReport(buffer, accountId)`'s existing signature and behavior must keep working unchanged (other code/tests call it directly).
- Spec: `docs/superpowers/specs/2026-06-22-mt5-account-auto-detect-design.md`.

---

### Task 1: Add `mt5Accounts` to default journal data

**Files:**
- Modify: `src/storage.js:77-89` (`defaultData()`)
- Test: `src/__tests__/storage.test.js`

**Interfaces:**
- Produces: `defaultData()` return value gains a `mt5Accounts: []` field, used by Task 3.

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/storage.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { mergeTrades, defaultData } from '../storage.js'

describe('defaultData', () => {
  it('includes an empty mt5Accounts list for runtime-created accounts', () => {
    expect(defaultData().mt5Accounts).toEqual([])
  })
})
```

(Update the existing `import { mergeTrades } from '../storage.js'` line at the top of the file to also import `defaultData`, as shown above — don't duplicate the import line.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/storage.test.js`
Expected: FAIL — `defaultData().mt5Accounts` is `undefined`, not `[]`.

- [ ] **Step 3: Implement**

In `src/storage.js`, `defaultData()` currently ends with:

```js
      beThresholdTicks: 3,
      commissions: { micro: 1.03, mini: 3.50 },
    },
    dailyBotAssignments: {},
  };
```

Change to:

```js
      beThresholdTicks: 3,
      commissions: { micro: 1.03, mini: 3.50 },
    },
    dailyBotAssignments: {},
    mt5Accounts: [],
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/storage.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/storage.js src/__tests__/storage.test.js
git commit -m "feat: add mt5Accounts to default journal data for runtime-created accounts"
```

---

### Task 2: Split the MT5 report parser to support account-login detection

**Files:**
- Modify: `src/utils/parseMt5Report.js` (full rewrite of exports, same file)
- Test: `src/__tests__/parseMt5Report.test.js`

**Interfaces:**
- Consumes: `mapMtConnectTrade(raw, accountId)` from `src/utils/mapMtConnect.js` (unchanged).
- Produces:
  - `parseMt5XlsxRows(buffer: ArrayBuffer): Array<Record<string,string>>` — raw sheet rows, used by Task 4.
  - `extractAccountLogin(rows: Array<Record<string,string>>): string | null` — used by Task 4.
  - `extractPositions(rows: Array<Record<string,string>>, accountId: string): Trade[]` — used by Task 4.
  - `parseMt5XlsxReport(buffer: ArrayBuffer, accountId: string): Trade[]` — unchanged signature, now a thin wrapper.

- [ ] **Step 1: Write the failing tests**

Add to `src/__tests__/parseMt5Report.test.js`, after the existing imports (keep the existing `SHARED` array and helpers untouched) — add a second shared-strings table and helpers for header rows, then a new `describe` block:

```js
import { describe, it, expect } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
import { parseMt5XlsxReport, parseMt5XlsxRows, extractAccountLogin } from '../utils/parseMt5Report.js'
```

(Update the existing top import line to also bring in `parseMt5XlsxRows` and `extractAccountLogin`, as shown.)

Then, after the existing `ORDERS_LABEL_ROW` helper and before the `describe('parseMt5XlsxReport', ...)` block, add:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/parseMt5Report.test.js`
Expected: FAIL — `parseMt5XlsxRows` and `extractAccountLogin` are not exported yet.

- [ ] **Step 3: Implement the split**

Replace the bottom section of `src/utils/parseMt5Report.js` (from the JSDoc comment above `parseMt5XlsxReport` to the end of the file — currently lines 64-102) with:

```js
/**
 * Unzips an MT5 xlsx report and returns its raw sheet rows (cell letter → value).
 * Includes every row in the sheet, including the header section above "Positions"
 * (Name/Account/Company/Date) and the Positions/Orders/Deals/Results sections.
 *
 * @param {ArrayBuffer} buffer — raw bytes of the .xlsx file
 * @returns {Array<Record<string,string>>}
 */
export function parseMt5XlsxRows(buffer) {
  const zip = unzipSync(new Uint8Array(buffer))
  const sheetEntry = zip['xl/worksheets/sheet1.xml']
  if (!sheetEntry) throw new Error('Not a valid MT5 report: missing sheet1.xml')

  const sharedEntry = zip['xl/sharedStrings.xml']
  const sharedStrings = sharedEntry ? parseSharedStrings(decodeXmlEntry(sharedEntry)) : []
  return parseSheetRows(decodeXmlEntry(sheetEntry), sharedStrings)
}

/**
 * Extracts the account login number from the report's header rows (above
 * "Positions"). MT5's standard report header has a row like:
 *   Account:  26432619 (USD, FivePercentOnline-Real, demo, Hedge)
 * Returns the leading digit run from column B of that row, or null if no
 * "Account:" row exists or its value doesn't start with digits.
 *
 * @param {Array<Record<string,string>>} rows
 * @returns {string|null}
 */
export function extractAccountLogin(rows) {
  const row = rows.find(r => (r.A || '').trim() === 'Account:')
  if (!row || !row.B) return null
  const match = String(row.B).match(/^(\d+)/)
  return match ? match[1] : null
}

/**
 * Extracts the Positions section (closed round-trip trades) from already-parsed
 * sheet rows into the normalised Trade schema.
 *
 * @param {Array<Record<string,string>>} rows
 * @param {string} accountId
 * @returns {import('./tradeSchema.js').Trade[]}
 */
export function extractPositions(rows, accountId) {
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

/**
 * Parses an MT5 xlsx trade history report and extracts the Positions section
 * (closed round-trip trades) into the normalised Trade schema.
 *
 * @param {ArrayBuffer} buffer — raw bytes of the .xlsx file
 * @param {string} accountId
 * @returns {import('./tradeSchema.js').Trade[]}
 */
export function parseMt5XlsxReport(buffer, accountId) {
  return extractPositions(parseMt5XlsxRows(buffer), accountId)
}
```

Leave `decodeXmlEntry`, `parseSharedStrings`, `colLetters`, and `parseSheetRows` (current lines 20-62) untouched — they're reused as-is by `parseMt5XlsxRows`.

- [ ] **Step 4: Run tests to verify everything passes**

Run: `npx vitest run src/__tests__/parseMt5Report.test.js`
Expected: PASS (7 tests — 4 existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/utils/parseMt5Report.js src/__tests__/parseMt5Report.test.js
git commit -m "feat: split MT5 report parser to support account-login detection"
```

---

### Task 3: Merge runtime-created accounts into the MT5 account list in App.jsx

**Files:**
- Modify: `src/App.jsx:586-607` (`Dashboard` function)
- Modify: `src/App.jsx:1161-1169` (near `assignBots`, add `createMt5Account`)
- Modify: `src/App.jsx:1171` (add combined accounts list)
- Modify: `src/App.jsx:1244-1296` (MT5 filter bar, `CrossAccountDashboard`, `Dashboard` call, `Mt5ImportModal` call)

**Interfaces:**
- Consumes: `data.mt5Accounts` (Task 1), `ACCOUNTS` from `src/accounts.js` (unchanged).
- Produces: `createMt5Account(account)` — appends `account` to `data.mt5Accounts`, used by Task 4's `onCreateAccount` prop.

This task has no new automated tests (App.jsx has no component-level test harness in this codebase — verified manually in Task 5). Make the changes, then verify with `npm run build`.

- [ ] **Step 1: Change `Dashboard` to take accounts as a prop instead of importing `ACCOUNTS` directly**

Current code (`src/App.jsx:586-591`):

```js
function Dashboard({selectedIds, mt5Trades, fmtDollars, dailyBotAssignments, onAssignBots}) {
  const accounts = selectedIds.length===0 ? ACCOUNTS : ACCOUNTS.filter(a=>selectedIds.includes(a.id));

  if (accounts.length===0) {
    return <div style={{padding:40,textAlign:"center",color:T.hint,fontSize:13}}>No accounts configured in accounts.js</div>;
  }
```

Replace with:

```js
function Dashboard({selectedIds, accounts, mt5Trades, fmtDollars, dailyBotAssignments, onAssignBots}) {
  const visibleAccounts = selectedIds.length===0 ? accounts : accounts.filter(a=>selectedIds.includes(a.id));

  if (visibleAccounts.length===0) {
    return <div style={{padding:40,textAlign:"center",color:T.hint,fontSize:13}}>No accounts yet — import an MT5 report to create one.</div>;
  }
```

Then update the render below it (current lines 593-606) — change `accounts.map` to `visibleAccounts.map`:

```js
  return (
    <div style={{display:"flex",flexDirection:"column",gap:32}}>
      {visibleAccounts.map(acc=>(
        <Mt5AccountAnalytics
          key={acc.id}
          account={acc}
          trades={mt5Trades.filter(t=>t.accountId===acc.id)}
          T={T}
          fmtDollars={fmtDollars}
          dailyBotAssignments={dailyBotAssignments[acc.id]||{}}
          onAssignBots={(date,bots)=>onAssignBots(acc.id,date,bots)}
        />
      ))}
    </div>
  );
```

- [ ] **Step 2: Add `createMt5Account` next to `assignBots`**

Current code (`src/App.jsx:1161-1169`):

```js
  function assignBots(accountId, date, bots) {
    setData({
      ...data,
      dailyBotAssignments: {
        ...data.dailyBotAssignments,
        [accountId]: { ...(data.dailyBotAssignments?.[accountId] || {}), [date]: bots },
      },
    });
  }
```

Add immediately after it:

```js
  function createMt5Account(account) {
    setData({ ...data, mt5Accounts: [...(data.mt5Accounts || []), account] });
  }
```

- [ ] **Step 3: Compute the combined MT5 account list once**

Current code (`src/App.jsx:1171`):

```js
  const PAGES=[["overview","Overview"],["dashboard","Dashboard"],["trades","Trades"],["analytics","Analytics"],["accounts","Accounts"],["settings","Settings"]];
```

Replace with:

```js
  const PAGES=[["overview","Overview"],["dashboard","Dashboard"],["trades","Trades"],["analytics","Analytics"],["accounts","Accounts"],["settings","Settings"]];
  const mt5Accounts = [...ACCOUNTS, ...(data.mt5Accounts || [])];
```

- [ ] **Step 4: Wire `mt5Accounts` everywhere the MT5 filter bar, Overview, Dashboard, and import modal currently read `ACCOUNTS` directly**

Current code (`src/App.jsx:1236-1296`):

```jsx
      {/* MT5 account filter bar — shown on Dashboard */}
      {page==="dashboard"&&(
        <div style={{background:T.card,borderBottom:`0.5px solid ${T.border}`,padding:"6px 20px",display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:11,color:T.hint,marginRight:2}}>Account:</span>
          <button
            onClick={()=>setSelectedMt5AccIds([])}
            style={{...btn(selectedMt5AccIds.length===0?"primary":"ghost"),padding:"3px 10px",fontSize:11}}
          >All</button>
          {ACCOUNTS.map(a=>(
            <button key={a.id}
              onClick={()=>toggleMt5AccId(a.id)}
              style={{...btn(selectedMt5AccIds.includes(a.id)?"primary":"ghost"),padding:"3px 10px",fontSize:11}}
            >{a.label}</button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{padding:"20px",maxWidth:1100,margin:"0 auto"}}>
        {page==="overview"&&(
          <CrossAccountDashboard
            accounts={ACCOUNTS}
            allTrades={data.trades}
            T={T}
            fmtDollars={fmtDollars}
            onSelectAccount={id=>{setSelectedMt5AccIds([id]);setPage("dashboard");}}
          />
        )}
        {page==="dashboard"&&(
          <Dashboard
            selectedIds={selectedMt5AccIds}
            mt5Trades={data.trades.filter(t=>t.platform==="mt5")}
            fmtDollars={fmtDollars}
            dailyBotAssignments={data.dailyBotAssignments||{}}
            onAssignBots={assignBots}
          />
        )}
```

Replace with:

```jsx
      {/* MT5 account filter bar — shown on Dashboard */}
      {page==="dashboard"&&(
        <div style={{background:T.card,borderBottom:`0.5px solid ${T.border}`,padding:"6px 20px",display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:11,color:T.hint,marginRight:2}}>Account:</span>
          <button
            onClick={()=>setSelectedMt5AccIds([])}
            style={{...btn(selectedMt5AccIds.length===0?"primary":"ghost"),padding:"3px 10px",fontSize:11}}
          >All</button>
          {mt5Accounts.map(a=>(
            <button key={a.id}
              onClick={()=>toggleMt5AccId(a.id)}
              style={{...btn(selectedMt5AccIds.includes(a.id)?"primary":"ghost"),padding:"3px 10px",fontSize:11}}
            >{a.label}</button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{padding:"20px",maxWidth:1100,margin:"0 auto"}}>
        {page==="overview"&&(
          <CrossAccountDashboard
            accounts={mt5Accounts}
            allTrades={data.trades}
            T={T}
            fmtDollars={fmtDollars}
            onSelectAccount={id=>{setSelectedMt5AccIds([id]);setPage("dashboard");}}
          />
        )}
        {page==="dashboard"&&(
          <Dashboard
            selectedIds={selectedMt5AccIds}
            accounts={mt5Accounts}
            mt5Trades={data.trades.filter(t=>t.platform==="mt5")}
            fmtDollars={fmtDollars}
            dailyBotAssignments={data.dailyBotAssignments||{}}
            onAssignBots={assignBots}
          />
        )}
```

Then, further down, current code (`src/App.jsx:1289-1295`):

```jsx
      {modal==="import-mt5"&&(
        <Mt5ImportModal
          accounts={ACCOUNTS}
          onImport={(trades)=>{ handleMerge(trades); setModal(null); }}
          onClose={()=>setModal(null)}
        />
      )}
```

Replace with:

```jsx
      {modal==="import-mt5"&&(
        <Mt5ImportModal
          accounts={mt5Accounts}
          onImport={(trades)=>{ handleMerge(trades); setModal(null); }}
          onCreateAccount={createMt5Account}
          onClose={()=>setModal(null)}
        />
      )}
```

- [ ] **Step 5: Build to verify no errors**

Run: `npm run build`
Expected: build succeeds with no errors (warnings about chunk size are pre-existing and fine).

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: merge runtime-created MT5 accounts into accounts.js seed list"
```

---

### Task 4: Auto-detect account in Mt5ImportModal, with create-account fallback

**Files:**
- Modify: `src/components/Mt5ImportModal.jsx` (full rewrite)

**Interfaces:**
- Consumes: `parseMt5XlsxRows`, `extractAccountLogin`, `extractPositions` from `src/utils/parseMt5Report.js` (Task 2); `accounts` prop now includes runtime-created accounts (Task 3).
- Produces: calls `onCreateAccount(account)` prop (consumed by `createMt5Account` in `src/App.jsx`, Task 3) when a new account is created.

No new automated tests in this task — this is a UI component with no existing test harness in the codebase. Verified manually in Task 5.

- [ ] **Step 1: Replace the entire file**

Replace the full contents of `src/components/Mt5ImportModal.jsx` with:

```jsx
// src/components/Mt5ImportModal.jsx
import { useState, useRef } from 'react'
import { parseMt5XlsxRows, extractAccountLogin, extractPositions } from '../utils/parseMt5Report.js'
import { fmtDollars } from '../utils/compute.js'
import { T, btn, Card } from '../utils/theme.jsx'

// Minimal self-contained modal wrapper (mirrors the Modal() function in App.jsx,
// duplicated here since that one is a local, unexported function).
function Modal({ title, onClose, children, footer, width = 620 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: T.card, border: `0.5px solid ${T.border2}`, borderRadius: 'var(--border-radius-lg)', width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: '14px 18px', borderBottom: `0.5px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 500 }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, color: T.hint }}>×</button>
        </div>
        <div style={{ padding: '18px' }}>{children}</div>
        {footer && <div style={{ padding: '12px 18px', borderTop: `0.5px solid ${T.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>{footer}</div>}
      </div>
    </div>
  )
}

function classificationColor(c) {
  return c === 'win' ? T.green : c === 'loss' ? T.red : T.yellow
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const inputStyle = { background: T.surface, color: T.text, border: `0.5px solid ${T.border}`, borderRadius: 4, padding: '6px 9px', fontFamily: 'var(--font-sans)', fontSize: 13, width: '100%' }

// Props: accounts (combined ACCOUNTS + runtime-created list — id, label, login fields),
// onImport(trades), onCreateAccount(account), onClose
export function Mt5ImportModal({ accounts, onImport, onCreateAccount, onClose }) {
  const [step, setStep] = useState('upload') // 'upload' | 'create-account' | 'preview'
  const [rows, setRows] = useState(null)
  const [login, setLogin] = useState(null)
  const [account, setAccount] = useState(null)
  const [parsed, setParsed] = useState([])
  const [drag, setDrag] = useState(false)
  const [parseErr, setParseErr] = useState('')
  const [newAccountForm, setNewAccountForm] = useState({ label: '', propFirm: '', initialBalance: '' })
  const fileRef = useRef()

  function finishParse(detectedRows, matchedAccount) {
    const trades = extractPositions(detectedRows, matchedAccount.id)
    if (trades.length === 0) {
      setParseErr('No closed positions found in this report.')
      return
    }
    setAccount(matchedAccount)
    setParsed(trades)
    setParseErr('')
    setStep('preview')
  }

  function handleFile(file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsedRows = parseMt5XlsxRows(e.target.result)
        const detectedLogin = extractAccountLogin(parsedRows)
        if (!detectedLogin) {
          setParseErr('Couldn\'t find an Account row in this report — make sure it\'s an unmodified MT5 "Save as Report" export.')
          return
        }
        const match = accounts.find(a => a.login === detectedLogin)
        setRows(parsedRows)
        setLogin(detectedLogin)
        setParseErr('')
        if (match) {
          finishParse(parsedRows, match)
        } else {
          setStep('create-account')
        }
      } catch (err) {
        setParseErr(err.message || 'Failed to parse file. Make sure it is an MT5 "Save as Report" .xlsx export.')
      }
    }
    reader.onerror = () => setParseErr('Failed to read file.')
    reader.readAsArrayBuffer(file)
  }

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
    }
    onCreateAccount(newAccount)
    finishParse(rows, newAccount)
  }

  function handleConfirm() {
    onImport(parsed)
  }

  function reset() {
    setStep('upload')
    setRows(null)
    setLogin(null)
    setAccount(null)
    setParsed([])
    setParseErr('')
    setNewAccountForm({ label: '', propFirm: '', initialBalance: '' })
  }

  const canCreate = newAccountForm.label.trim() && newAccountForm.propFirm.trim() && Number(newAccountForm.initialBalance) > 0

  return (
    <Modal title="Import MT5 Report" onClose={onClose} width={780}
      footer={<>
        <button style={btn('ghost')} onClick={onClose}>Cancel</button>
        {step === 'preview' && (
          <button style={btn()} disabled={parsed.length === 0} onClick={handleConfirm}>
            Import {parsed.length} trade{parsed.length !== 1 ? 's' : ''}
          </button>
        )}
        {step === 'create-account' && (
          <button style={btn()} disabled={!canCreate} onClick={handleCreateAccount}>
            Create account &amp; continue
          </button>
        )}
      </>}>
      {step === 'upload' && <>
        <div style={{ marginBottom: 14, padding: 12, background: T.surface, borderRadius: 8, fontSize: 12, lineHeight: 1.7, color: T.muted }}>
          <strong style={{ color: T.text }}>How to export from MT5:</strong><br />
          1. Open the MT5 terminal → Toolbox → History<br />
          2. Right-click → Save as Report<br />
          3. Upload the resulting .xlsx file below — the account is detected automatically from the report
        </div>
        {parseErr && (
          <div style={{ color: T.red, fontSize: 12, marginBottom: 12, padding: '8px 12px', background: T.redBg, borderRadius: 6 }}>
            {parseErr}
          </div>
        )}
        <div
          style={{ border: `2px dashed ${drag ? T.green : T.border2}`, borderRadius: 10, padding: '50px 40px', textAlign: 'center', cursor: 'pointer', background: drag ? T.greenBg : 'transparent', transition: 'all 0.15s' }}
          onDragOver={e => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onClick={() => fileRef.current.click()}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📂</div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Drop xlsx file here or click to browse</div>
          <div style={{ fontSize: 12, color: T.hint }}>MT5 "Save as Report" .xlsx export</div>
          <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f) handleFile(f) }} />
        </div>
      </>}
      {step === 'create-account' && <>
        <div style={{ marginBottom: 14, padding: 12, background: T.surface, borderRadius: 8, fontSize: 13, color: T.text, lineHeight: 1.6 }}>
          Account <strong>{login}</strong> isn't in your accounts list yet. Add it to continue importing.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: T.hint, display: 'block', marginBottom: 4 }}>Label</label>
            <input style={inputStyle} value={newAccountForm.label}
              onChange={e => setNewAccountForm({ ...newAccountForm, label: e.target.value })}
              placeholder="e.g. FundedNext 15K" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: T.hint, display: 'block', marginBottom: 4 }}>Prop firm</label>
            <input style={inputStyle} value={newAccountForm.propFirm}
              onChange={e => setNewAccountForm({ ...newAccountForm, propFirm: e.target.value })}
              placeholder="e.g. FundedNext" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: T.hint, display: 'block', marginBottom: 4 }}>Starting balance (USD)</label>
            <input style={inputStyle} type="number" value={newAccountForm.initialBalance}
              onChange={e => setNewAccountForm({ ...newAccountForm, initialBalance: e.target.value })}
              placeholder="e.g. 15000" />
          </div>
        </div>
        <button style={btn('ghost')} onClick={reset}>← Back</button>
      </>}
      {step === 'preview' && <>
        <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: T.muted }}>
            <strong style={{ color: T.text }}>{parsed.length}</strong> trade{parsed.length !== 1 ? 's' : ''} parsed
          </span>
          {account && (
            <span style={{ marginLeft: 'auto', fontSize: 12, padding: '3px 10px', background: T.surface, borderRadius: 6, color: T.muted }}>
              Detected account: <strong style={{ color: T.text }}>{account.label}</strong>
            </span>
          )}
          <button style={btn('ghost')} onClick={reset}>← Back</button>
        </div>
        <div style={{ maxHeight: 340, overflow: 'auto', border: `0.5px solid ${T.border}`, borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                {['Date', 'Symbol', 'Dir', 'Volume', 'Net P&L', 'Classification'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '7px 10px', borderBottom: `0.5px solid ${T.border}`, color: T.hint, fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: T.card }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.slice(0, 100).map((t, i) => {
                const c = classificationColor(t.classification)
                return (
                  <tr key={t.id || i} style={{ borderBottom: `0.5px solid ${T.border}` }}>
                    <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{t.openTime?.slice(0, 10) || '—'}</td>
                    <td style={{ padding: '6px 10px', fontWeight: 500 }}>{t.symbol}</td>
                    <td style={{ padding: '6px 10px', color: t.direction === 'BUY' ? T.green : T.red, fontWeight: 500 }}>{t.direction === 'BUY' ? '▲ Buy' : '▼ Sell'}</td>
                    <td style={{ padding: '6px 10px', color: T.muted }}>{t.volume}</td>
                    <td style={{ padding: '6px 10px', color: c, fontWeight: 500 }}>{fmtDollars(t.pnl)}</td>
                    <td style={{ padding: '6px 10px' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: c, background: c + '18', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {t.classification}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {parsed.length > 100 && (
          <div style={{ fontSize: 11, color: T.hint, marginTop: 6 }}>Showing first 100 of {parsed.length}</div>
        )}
      </>}
    </Modal>
  )
}
```

- [ ] **Step 2: Build to verify no errors**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 3: Run the full test suite to verify nothing else broke**

Run: `npx vitest run`
Expected: PASS (all test files, including the 3 new `extractAccountLogin` tests from Task 2 and the 1 new `defaultData` test from Task 1).

- [ ] **Step 4: Commit**

```bash
git add src/components/Mt5ImportModal.jsx
git commit -m "feat: auto-detect MT5 account from report, add create-account fallback"
```

---

### Task 5: End-to-end verification in a real browser

**Files:** none (verification only)

- [ ] **Step 1: Generate two fixture xlsx files** — one with a login that matches the seed `The 5ers 25K` account (`26432619`), one with an unrecognized login. Run this script with `node`:

```js
// /tmp/make-fixtures.mjs
import { zipSync, strToU8 } from 'fflate'
import { writeFileSync } from 'fs'

const SHARED = ['Account:', '26432619 (USD, FivePercentOnline-Real, demo, Hedge)', 'Positions', 'XAUUSD', 'buy', '2026.06.15 08:49:18', '2026.06.15 10:22:07', 'Orders', '99999999 (USD, SomeBroker, demo, Hedge)']

function sharedStringsXml(strings) {
  const sis = strings.map(s => `<si><t>${s}</t></si>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${sis}</sst>`
}
function sheetXml(rowsXml) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`
}
const s = (ref, i) => `<c r="${ref}" t="s"><v>${i}</v></c>`
const n = (ref, v) => `<c r="${ref}"><v>${v}</v></c>`

function buildXlsx(accountValueIdx) {
  const rowsXml = [
    `<row r="1">${s('A1', 0)}${s('B1', accountValueIdx)}</row>`,         // Account: <login>
    `<row r="2">${s('A2', 2)}</row>`,                                     // Positions
    `<row r="3"></row>`,                                                  // header row
    `<row r="4">${s('A4', 5)}${n('B4', 245623253)}${s('C4', 3)}${s('D4', 4)}${n('E4', 0.08)}${n('F4', 4315.48)}${s('I4', 6)}${n('J4', 4318.14)}${n('K4', -0.55)}${n('L4', 0)}${n('M4', 21.28)}</row>`,
    `<row r="5">${s('A5', 7)}</row>`,                                     // Orders
  ].join('')
  const zip = zipSync({
    'xl/worksheets/sheet1.xml': strToU8(sheetXml(rowsXml)),
    'xl/sharedStrings.xml': strToU8(sharedStringsXml(SHARED)),
  })
  return Buffer.from(zip)
}

writeFileSync('/tmp/mt5-matched.xlsx', buildXlsx(1))   // login 26432619 — matches seed account
writeFileSync('/tmp/mt5-unmatched.xlsx', buildXlsx(8)) // login 99999999 — no match
console.log('wrote /tmp/mt5-matched.xlsx and /tmp/mt5-unmatched.xlsx')
```

Run: `cd /tmp && node make-fixtures.mjs`
Expected output: `wrote /tmp/mt5-matched.xlsx and /tmp/mt5-unmatched.xlsx`

- [ ] **Step 2: Start the dev server**

```bash
npm run dev > /tmp/vite-dev.log 2>&1 &
echo $! > /tmp/dev.pid
for i in $(seq 1 30); do curl -sf http://localhost:5173 >/dev/null && echo READY && break; sleep 1; done
```

- [ ] **Step 3: Drive the app with Playwright, exercising both the matched and unmatched paths**

If `playwright` isn't already resolvable locally, install the CLI/browser once: `npx --yes playwright@1.61.0 install chromium`. Then symlink it into a scratch dir so a plain `node` script can `import { chromium } from 'playwright'` (see prior session for this exact pattern: `npm root` cache at `~/.npm/_npx/*/node_modules/playwright`, symlinked into `/tmp/node_modules/playwright`).

Write and run a script equivalent to:

```js
// /tmp/verify-mt5-import.mjs
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage()
await page.addInitScript(() => { delete window.showOpenFilePicker })
await page.goto('http://localhost:5173/trade-journal/')
await page.waitForTimeout(1000)

// Matched-login path
await page.locator('button', { hasText: 'Import MT5' }).click()
await page.setInputFiles('input[type="file"]', '/tmp/mt5-matched.xlsx')
await page.waitForTimeout(500)
await page.screenshot({ path: '/tmp/import-matched.png' })
const detectedText = await page.locator('text=Detected account:').textContent().catch(() => null)
console.log('MATCHED_DETECTED_TEXT:', detectedText)
await page.locator('button', { hasText: /Import \d+ trade/ }).click()
await page.waitForTimeout(500)

// Unmatched-login path
await page.locator('button', { hasText: 'Import MT5' }).click()
await page.setInputFiles('input[type="file"]', '/tmp/mt5-unmatched.xlsx')
await page.waitForTimeout(500)
await page.screenshot({ path: '/tmp/import-unmatched-form.png' })
await page.fill('input[placeholder="e.g. FundedNext 15K"]', 'Test Prop 5K')
await page.fill('input[placeholder="e.g. FundedNext"]', 'TestProp')
await page.fill('input[placeholder="e.g. 15000"]', '5000')
await page.locator('button', { hasText: 'Create account & continue' }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: '/tmp/import-unmatched-preview.png' })
await page.locator('button', { hasText: /Import \d+ trade/ }).click()
await page.waitForTimeout(500)

// Confirm the new account now shows up on Overview
await page.locator('button', { hasText: 'Overview' }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: '/tmp/overview-after-create.png' })
const newCardVisible = await page.locator('text=Test Prop 5K').first().isVisible().catch(() => false)
console.log('NEW_ACCOUNT_VISIBLE_ON_OVERVIEW:', newCardVisible)

const errors = []
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
console.log('CONSOLE_ERRORS:', JSON.stringify(errors))
await browser.close()
```

Run it, then read `/tmp/import-matched.png`, `/tmp/import-unmatched-form.png`, `/tmp/import-unmatched-preview.png`, and `/tmp/overview-after-create.png` to confirm visually:
- `MATCHED_DETECTED_TEXT` contains "The 5ers 25K".
- The unmatched-form screenshot shows the create-account mini-form with login `99999999` mentioned.
- The unmatched-preview screenshot shows "Detected account: Test Prop 5K".
- `NEW_ACCOUNT_VISIBLE_ON_OVERVIEW` is `true`.
- `CONSOLE_ERRORS` is `[]`.

- [ ] **Step 4: Stop the dev server and clean up**

```bash
kill $(cat /tmp/dev.pid) 2>/dev/null
rm -f /tmp/dev.pid /tmp/vite-dev.log /tmp/make-fixtures.mjs /tmp/verify-mt5-import.mjs \
      /tmp/mt5-matched.xlsx /tmp/mt5-unmatched.xlsx \
      /tmp/import-matched.png /tmp/import-unmatched-form.png /tmp/import-unmatched-preview.png /tmp/overview-after-create.png
rm -rf /tmp/node_modules
```

- [ ] **Step 5: No commit for this task** — it's verification only, nothing in the repo changes.

---

## Self-Review Notes

- **Spec coverage:** parsing split (Task 2), runtime account storage + merge (Tasks 1, 3), import-modal detection/create-account UI (Task 4), error handling for missing Account row (Task 4 Step 1's `parseErr` branch), tests for `extractAccountLogin` (Task 2) — all covered. End-to-end browser check (Task 5) covers both the match and no-match flows described in the spec's "Import flow" section.
- **No placeholders:** every step has complete, runnable code.
- **Type/name consistency:** `parseMt5XlsxRows` / `extractAccountLogin` / `extractPositions` / `parseMt5XlsxReport` names and signatures match between Task 2 (definition) and Task 4 (consumption). `account.login` (string) matches `extractAccountLogin`'s string return type. `onCreateAccount` prop name matches between Task 3 (`Mt5ImportModal accounts={mt5Accounts} ... onCreateAccount={createMt5Account}`) and Task 4 (`export function Mt5ImportModal({ accounts, onImport, onCreateAccount, onClose })`).
