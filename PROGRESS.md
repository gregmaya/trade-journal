# Trade Journal — Progress & Roadmap

## v1 (current) — Tradovate Import + File-based Storage
- File System Access API (local JSON file, portable)
- Tradovate CSV import with grouping + deduplication
- Tick-based P&L + R tracking (commission-aware)
- Trailing drawdown chart per account (eval / PA rules)
- GitHub Pages deployment

___

## Upgrades

- IMPORTNAT : Make sure that the changes can also be applied to a backed up set of trades, not to loose the extra information already added.

- trade classification for BE need to be based on USD ± X (eg. 50 USD)


- Tradovate exports the time in my local time, however all trades are placed in NY time UTC-4. When importing I'd like the times to be converted to display NY time.

- Entry and exit times are wrongly labeled on SHORTS. Please note that entry always needs to be prior to exit.

- Surface trade's entry time on the list too.

- Entry price and Avg exit need to correspond to the direction. currently profitable SHORT trades are shoring entries above the exits. please correct 

- trades list: round Ticks to the closest integer.


- on the DASHBOARD: ACCOUNTS are blank despite trades correctly loades and assigned. check and debug. 

- DASHBOARD: replace KPI Net P&L (ticks) for Avg profitable ticks (I.e. what's the average size of trades that have been profitable - so I can aim so similar sizes going forward)

- add info about how certain KPIs are calculated / what they mean. eg. what's profit target?

- ACCOUNTS: Label the Y axis. range should be from 47500 to 53500 (given that target is 53000)
___

## V2 (upcoming)

- Include the option to set "My personal rules". These are ideal habits which we should be able to test against to see if/when I'm sticking to my rules. Example of rules are :
    - Max 2 trades per session (London 3-5am UTC-4/ NY 9:30-11:30 UTC-4) considering entries only.
    - Max loss per day 400 USD + 10%



## Future — Cloud Storage Migration
- Replace FSA adapter in storage.js with Supabase (Postgres + Auth)
- Same data schema, single file change
- Multi-device access without manual file management
- Target: when actively managing 3+ accounts simultaneously


