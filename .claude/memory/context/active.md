# Active Context

**Last updated**: 2026-05-22

## Current State

**Single-branch repo + Supabase keepalive shipped.**

- Repo consolidated to one branch: `main` (formerly `Desktop`).
- `Visual` submodule gitlink removed — Vercel deploys no longer fail at "Failed to fetch one or more git submodules".
- Supabase keepalive live: client-ping on every visit + daily server-ping inside existing cron.

## What's Live on mheu.lol

- New Scoring Engine (soft-cap 0-200, cap at 100)
- 4 connectors (Spotify, Discord, MyNetDiary, AppleHealth)
- Admin Scoring Panel + accent theme + account UI
- Time scale selector (Day/Week/Month)
- Prestige tiers (100/150/180)
- **NEW**: Supabase keepalive heartbeat (table `public.keepalive`)

## Function Budget (Hobby tier: 12)

12/12 — at the limit. Keepalive is folded into `api/cron/recompute.ts`. Do NOT add new functions without consolidating two existing ones first.

## Deployment Notes

- Single branch: `main` only.
- Vercel project `prj_NTA1v4ALsLHqJ5ZLE1Jf0PjBKpxR`, root dir `web/`.
- Daily cron at `0 0 * * *` runs both score recompute and keepalive ping.
- See `.claude/memory/context/supabase-keepalive.md` for verification SQL.

## Manual Steps Required

1. **Apply keepalive migration** to production Supabase:
   - `20260522000001_keepalive.sql` (creates `public.keepalive` + RLS).
2. Discord env vars (still pending from previous session).

## Git State

- Branch: `main` (default)
- Latest commit: pending — covers branch consolidation, submodule removal, keepalive.
