# Refactor progress (delete in the final commit)

Source of truth for the one-session "full refactor to finished state" run.
Re-read this + CLAUDE.md after any context compaction.

## Blockers (owner, at home)
- Supabase MCP NOT authenticated → every DB step is written but UNAPPLIED.
  Owner said: "move forward without the Supabase authentication, I'll do it manually".
- Vercel CLI NOT logged in (auth.json empty) → no `vercel env rm`, no `vercel logs`,
  no `vercel env pull`. Deploys go out via push to main (GitHub integration, ~60s).
- No SUPABASE_SERVICE_ROLE_KEY / CRON_SECRET locally → no cron 200 check, no
  signed-in Playwright runs (suite skips them with a message).

## Part 0 — done (DB/CLI steps blocked)
- [x] `.mcp.json` committed (96ae7c4); CLAUDE.md Database section (aaa3994)
- [ ] BLOCKED: select 1 via MCP; vercel env pull

## Part 1 — code done, DB unapplied
- [x] Strava removed from code (58c5405); drop migration gains 2 tables + 1 column
- [ ] BLOCKED: users lockdown verify/apply_migration, drop migration apply, advisors
- [ ] BLOCKED: env var removal (TICKETMASTER_API_KEY, DISCORD_*, MYNETDIARY_ENCRYPTION_KEY, SPOTIFY_CLIENT_ID, STRAVA_*)
- [x] Crons: both paths 401 without secret on prod (200 needs CRON_SECRET)

## Part 2 — done (62897dc, 849cc52)
- tokens.css single source; data-accent red/teal/purple; .accent-red/.accent-green scopes
- Plex Sans + HitmarkerText, swap + metric fallbacks; pre-paint script
- useAccent (app/accent.ts); migration 20261103000003 UNAPPLIED
- themes/, ThemeOverrideProvider, archive/ deleted; Obsession red
- Investing red/green (0351088)
- Color literal sweep: before 467 (≈140 outside themes) → after 2 (QR code pair, sanctioned)

## Part 3 — done (5634b12, 0351088)
- app/routes.ts registry; app/shell/*; landing; Gate; egg in shell; lazy routes
- Investing guest→account merge + 8 tests
- Bundle: before 3,760 KB / 762 KB gz single chunk → main 415.6 KB / 121.7 KB gz
- Deployed: index-CUf8xcK1.js live; signed-out smoke OK, no console errors

## Part 4 — in progress
## Part 5 — done with visualizer commit (fe30f36); verify invalid_grant path in Part 6
## Part 6 — pending

## Notes / decisions
- /admin/login → /login?next=/admin (shared login; old lockout stopgap removed)
- GroovyBackground deleted with the old look
- Visualizer only mounts on /m now (was behind every MHEU tab)
