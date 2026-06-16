// src/accounts.js
// Static account config — no secrets. Investor passwords live in sessionStorage only.
// serverAddress: resolve once via Task 6 spike, then fill in permanently here.

export const ACCOUNTS = [
  {
    id: 'fp-20123435',
    label: 'FundingPips 25K',
    propFirm: 'FundingPips',
    platform: 'mt5',
    login: '20123435',
    serverName: 'FundingPips-SIM1',
    serverAddress: '', // TODO: fill after Task 6 spike
    currency: 'USD',
    initialBalance: 25000,
    profitTarget: 26250,   // +5%
    maxDailyLoss: 1250,
    maxTotalLoss: 1500,
  },
  // Repeat for remaining 3 accounts:
  // { id, label, propFirm, platform, login, serverName, serverAddress,
  //   currency, initialBalance, profitTarget, maxDailyLoss, maxTotalLoss }
]
