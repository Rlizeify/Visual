# Blockers

<!-- Format: -->
<!-- ## Blocker Title -->
<!-- **Since**: Date -->
<!-- **Waiting on**: What/who -->
<!-- **Impact**: What's blocked -->

## Database + Vercel CLI access for the refactor's DB steps
**Since**: 2026-11-03
**Waiting on**: Owner — authenticate the Supabase MCP (`/mcp`) and `npx vercel login`
**Impact**: Migrations 20261103000001/2/3 unapplied; 9 dead env vars still in
Vercel; no cron-200, logs or advisors checks; signed-in test:responsive skipped.
