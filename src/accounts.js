// src/accounts.js
// Static account config — no secrets, no live API needed. Trade data comes from
// manual MT5 "Save as Report" xlsx exports, imported via the Import MT5 button.
//
// Drawdown is a static floor (maxLossPct of initialBalance) — it does not move with
// peak balance. Evals are passed in two phases: phase 1 requires +phaseTargetPct profit
// from phaseStartBalance, then phase 2 requires a further +phaseTargetPct. When an account
// advances to phase 2, update its phase, phaseStartBalance (resets to initialBalance per
// firm convention), and phaseTargetPct (typically 0.05 for phase 2) by hand here.

export const ACCOUNTS = [
  {
    id: 'fp-20120675',
    label: 'FundingPips 10K',
    propFirm: 'FundingPips',
    botName: 'Forex Bank',
    bots: ['Forex Bank', 'Get Me Funded'],
    platform: 'mt5',
    login: '20120675',
    currency: 'USD',
    initialBalance: 10000,
    maxLossPct: 0.10,
    phase: 1,
    phaseStartBalance: 10000,
    phaseTargetPct: 0.10,
  },
  {
    id: 'fp-20123435',
    label: 'FundingPips 10K',
    propFirm: 'FundingPips',
    botName: 'Get Me Funded',
    bots: ['Forex Bank', 'Get Me Funded'],
    platform: 'mt5',
    login: '20123435',
    currency: 'USD',
    initialBalance: 10000,
    maxLossPct: 0.10,
    phase: 1,
    phaseStartBalance: 10000,
    phaseTargetPct: 0.10,
  },
  {
    id: 'fn-14102260',
    label: 'FundedNext 15K',
    propFirm: 'FundedNext',
    botName: 'Get Me Funded',
    bots: ['Forex Bank', 'Get Me Funded'],
    platform: 'mt5',
    login: '14102260',
    currency: 'USD',
    initialBalance: 15000,
    maxLossPct: 0.10,
    phase: 1,
    phaseStartBalance: 15000,
    phaseTargetPct: 0.10,
  },
  {
    id: '5ers-26432619',
    label: 'The 5ers 25K',
    propFirm: 'The 5ers',
    botName: 'Alpha Striker',
    bots: ['Alpha Striker'],
    platform: 'mt5',
    login: '26432619',
    currency: 'USD',
    initialBalance: 25000,
    maxLossPct: 0.10,
    phase: 1,
    phaseStartBalance: 25000,
    phaseTargetPct: 0.10,
  },
]
