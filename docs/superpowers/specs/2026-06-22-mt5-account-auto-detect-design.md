# MT5 account auto-detection from imported report

## Context

MT5 trade import (`Mt5ImportModal.jsx`) currently requires the user to manually
pick which account a report belongs to from a dropdown before uploading.
MT5's "Save as Report" xlsx export already contains the account's login number
in its header rows, above the "Positions" table:

```
Name:	HS1-25K Gregorio Maya
Account:	26432619 (USD, FivePercentOnline-Real, demo, Hedge)
Company:	Five Percent Online Ltd
Date:	2026.06.22 04:24
```

This is the first of four planned upgrades (account auto-detection, bots
replacing the strategy concept, an Accounts tab for MT5 settings, and
cross-account bot performance) being designed and built one at a time.

## Goal

Detect the account automatically from the report's `Account:` row and match
it against the account's `login` field in `accounts.js` (or a previously
created runtime account). If no match is found, offer to create a new
account on the spot rather than blocking the import.

## Parsing changes — `src/utils/parseMt5Report.js`

Split the current monolithic `parseMt5XlsxReport(buffer, accountId)` into:

- `parseMt5XlsxRows(buffer)` — unzip + shared-strings + sheet parsing, returns
  the raw `rows` array (today's lines 72–79).
- `extractAccountLogin(rows)` — scans rows for one where `r.A?.trim() === 'Account:'`,
  then pulls the leading digit run out of `r.B` via `/^(\d+)/`. Returns the
  matched string or `null` if no `Account:` row exists or `B` doesn't start
  with digits.
- `extractPositions(rows, accountId)` — today's Positions-section logic
  (current lines 81–101), unchanged except it now takes `rows` instead of `buffer`.
- `parseMt5XlsxReport(buffer, accountId)` stays as a thin wrapper
  (`extractPositions(parseMt5XlsxRows(buffer), accountId)`) so existing
  tests/call sites keep working untouched.

## Account storage — `src/storage.js` + `src/accounts.js`

`accounts.js` remains the hand-edited seed list — unchanged.

`defaultData()` gains `mt5Accounts: []` — accounts created at runtime via the
import flow. Every place that currently reads `ACCOUNTS` for the MT5 system
switches to the combined list `[...ACCOUNTS, ...data.mt5Accounts]`:

- `App.jsx`: the `Dashboard` page render, the MT5 account filter bar, the
  `CrossAccountDashboard` `accounts` prop, and `Mt5ImportModal`'s `accounts` prop.
- `CrossAccountDashboard.jsx` and `Dashboard` already take `accounts`/`ACCOUNTS`
  as props/imports — no internal change needed beyond what's passed in.

A new account created this way has the same shape as `accounts.js` entries,
with defaults for fields the popup doesn't ask about:
```js
{
  id: slugify(propFirm) + '-' + login,   // e.g. 'fundednext-14102260'
  label, propFirm,
  botName: '', bots: [],
  platform: 'mt5', login, currency: 'USD',
  initialBalance,                         // from popup
  maxLossPct: 0.10, phase: 1,
  phaseStartBalance: initialBalance, phaseTargetPct: 0.10,
}
```

## Import flow — `src/components/Mt5ImportModal.jsx`

Remove the upfront "Assign to account" dropdown and the `accountId` state
that drives it. New flow on file drop/select:

1. Read the file, call `parseMt5XlsxRows` then `extractAccountLogin`.
2. Look up the login in the combined accounts list (`accounts` prop, already
   merged by `App.jsx`).
3. **Match found:** render a read-only line "Detected account: *label*",
   call `extractPositions(rows, account.id)`, go to the existing `preview` step.
4. **No match:** render "Account `<login>` not recognized" with an inline
   mini-form (label, prop firm, starting balance — text/number inputs, no
   modal-within-modal). Submitting:
   - builds the new account object as above,
   - calls a new `onCreateAccount(account)` prop,
   - then proceeds to `extractPositions(rows, account.id)` and the preview step.
5. If `extractAccountLogin` itself returns `null` (header missing/unparseable),
   show an error ("Couldn't find an Account row in this report — make sure
   it's an unmodified MT5 'Save as Report' export") and block import, same as
   today's "no Positions section" error.

`App.jsx` wires `onCreateAccount` to append to `data.mt5Accounts` via `setData`,
mirroring the existing `saveAccount`/`assignBots` pattern.

## Error handling

- Missing `Account:` row, or `B` not starting with digits → block with a clear
  message (same severity as the existing "Not an MT5 report" errors).
- Duplicate login across two accounts (shouldn't happen, but if `accounts.js`
  and `mt5Accounts` both define the same login) → first match wins; not worth
  guarding further since both lists are small and user-controlled.

## Testing

`src/__tests__/parseMt5Report.test.js` gains cases for `extractAccountLogin`:
- the sample header above → `'26432619'`
- a sheet with no `Account:` row → `null`
- an `Account:` row whose value doesn't start with digits → `null`

Existing `parseMt5XlsxReport` tests continue to pass unchanged since its
signature and behavior are preserved.
