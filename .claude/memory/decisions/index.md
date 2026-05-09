# Decision Log

<!-- Newest first. Format: -->
<!-- ## YYYY-MM-DD — Decision Title -->
<!-- **Context**: Why this came up -->
<!-- **Decision**: What was decided -->
<!-- **Reasoning**: Why this choice over alternatives -->

## 2026-05-08 — Admin data console architecture

**Context**: `/admin` needs to view + edit every user-related table, reset passwords, manage the leaderboard, and never leak the service-role key to the browser.
**Decision**: All writes go through `web/api/admin/*` Vercel functions that validate the caller's Supabase JWT, check `profiles.is_admin`, and write through a service-role client. Every write inserts a row into a new `audit_log` table with before/after JSON. `force_set_password` is super-admin-only (gated by hardcoded `SUPER_ADMIN_EMAIL`) and never logs the password value. Leaderboard PUT is full replace. Migration 7 also adds `profiles.username` to support the Users tab. See `admin-data-console.md` for full file layout, audit-log semantics, and open follow-ups.

## 2026-05-08 — Admin role + first-admin bootstrap

**Context**: `/admin` console needs role-based access. First admin (CB) must be seeded without giving the client any privilege-escalation primitive.
**Decision**: `profiles.is_admin` column + `is_admin(uuid)` SECURITY DEFINER helper used in additive RLS policies + `bootstrap_admin(email)` function exposed only to `service_role` (called once via the Supabase SQL editor). Brute-force protection is currently a client-side localStorage counter; flagged as a stopgap. See `admin-bootstrap.md` for how to seed and the open follow-up on real rate limiting.

## 2026-05-08 — OAuth token encryption strategy

**Context**: Life Score feature requires storing OAuth tokens for multiple providers (Spotify, Discord, YouTube, MyNetDiary, Apple).
**Decision**: Use pgcrypto with PGP symmetric encryption (`pgp_sym_encrypt`/`pgp_sym_decrypt`).
**Reasoning**: Works on all Supabase plans (including free), simple two-function API, no external dependencies. Encryption key stored in Vault (prod) or env var (dev). See `oauth-token-storage.md` for full analysis.

## 2026-05-08 — Reactivity architecture for Tizen TV + Spotify

**Context**: Need true audio reactivity on Samsung Tizen TV browser with Spotify source and minimal user setup.
**Decision**: Path B — Desktop host captures system audio via WASAPI loopback, runs FFT, broadcasts bands over WebSocket to LAN clients.
**Reasoning**: Path A (pure web) killed by Spotify DRM blocking AnalyserNode access. Path C (cloud relay) too expensive at 60Hz and adds latency. Path B gives <50ms latency, zero ongoing cost, and one-install setup. See `reactivity-architecture.md` for full analysis.

## 2026-04-04 — Initialize infrastructure file system

**Context**: No CLAUDE.md, memory, agent, or soul files existed.
**Decision**: Created full directory-based memory system under `.claude/memory/` with six subdirectories.
**Reasoning**: Directory-based structure scales better than flat files. Separation of concerns (decisions, patterns, context, progress, roadmap) prevents any single file from becoming unwieldy.
