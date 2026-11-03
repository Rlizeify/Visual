# Refactor progress (delete in the final commit)

Source of truth for the one-session "full refactor to finished state" run.
Re-read this + CLAUDE.md after any context compaction.

## Part 0 — Credentials + DB access
- [x] Read CLAUDE.md, AUDIT.md (§9, Reconciled findings, Phase 1 complete)
- [x] On `main`, pulled
- [x] `.vercel/project.json` → project-iwmob (prj_NTA1v4ALsLHqJ5ZLE1Jf0PjBKpxR)
- [x] `.mcp.json` committed
- [ ] BLOCKED: Supabase MCP not authenticated (owner: `/mcp` → supabase → Authenticate)
- [ ] BLOCKED: Vercel CLI not logged in (`auth.json` empty; owner: `npx vercel login`)
- [ ] `select 1` via MCP
- [ ] `vercel env pull .env.vercel.local --environment=production`
- [ ] CLAUDE.md "Database" section

## Part 1 — Security + Phase 1C
- [ ] users lockdown verify + record
- [ ] Strava removal (code, tables, env)
- [ ] Drop cut features (backup → apply → verify → advisors)
- [ ] Env var removal
- [ ] Cron checks

## Part 2 — Theme system
## Part 3 — Modular architecture
## Part 4 — Responsive
## Part 5 — Audio
## Part 6 — Cleanup + docs

## Notes / decisions
