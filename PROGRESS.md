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
