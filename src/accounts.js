// src/accounts.js
// Static account config — no secrets, no live API needed. Trade data comes from
// manual MT5 "Save as Report" xlsx exports, imported via the Import MT5 button.
//
// Drawdown is a static floor (maxLossPct of initialBalance) — it does not move with
// peak balance. Evals are passed in two phases: phase 1 requires +phaseTargetPct profit
// from phaseStartBalance, then phase 2 requires a further +phaseTargetPct (update
// phaseStartBalance and phaseTargetPct by hand here when an account advances to phase 2).

export const ACCOUNTS = [
  {
    id: 'fp-20123435',
    label: 'FundingPips 25K',
    propFirm: 'FundingPips',
    botName: 'Bot Alpha',
    platform: 'mt5',
    login: '20123435',
    currency: 'USD',
    initialBalance: 25000,
    maxLossPct: 0.10,
    phase: 1,
    phaseStartBalance: 25000,
    phaseTargetPct: 0.10,
  },
]
