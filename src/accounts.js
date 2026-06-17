// src/accounts.js
// Static account config — no secrets, no live API needed. Trade data comes from
// manual MT5 "Save as Report" xlsx exports, imported via the Import MT5 button.

export const ACCOUNTS = [
  {
    id: 'fp-20123435',
    label: 'FundingPips 25K',
    propFirm: 'FundingPips',
    platform: 'mt5',
    login: '20123435',
    currency: 'USD',
    initialBalance: 25000,
    profitTarget: 26250,
    maxDailyLoss: 1250,
    maxTotalLoss: 1500,
  },
]
