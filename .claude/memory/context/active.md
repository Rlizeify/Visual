# Active Context

**Last updated**: 2026-05-10

## Current State

**mheu.lol SERVING NEW SCORING ENGINE**

Deployment successful:
- Deployment ID: `dpl_Gd96dBfhgqhKnX5HazDBQde8acVv`
- All env vars present
- 17 scoring fields synced
- Deployment Protection enabled (use bypass header for testing)

## What's Live on mheu.lol

- **New Scoring Engine**: Soft-cap curve (0-200 scale, cap at 100)
- **Connector System**: 4 connectors (Spotify, Discord, MyNetDiary, AppleHealth)
- **Admin Scoring Panel**: Weight sliders, effort multipliers, live preview
- **Time Scale Selector**: Day/Week/Month on U-tab
- **Prestige Tiers**: Glow effects at 100/150/180

## Deployment Notes

**Vercel Deployment Protection** is enabled. Use Vercel SSO via browser or set bypass header (rotate token in Vercel dashboard after each use).

**12 Function Limit**: Scoring connectors moved from `api/scoring/` to `src/scoring/` to avoid counting as serverless functions.

## Database Tables (Supabase)

New tables from migration `20260509000011_scoring_tables.sql`:
- `scoring_field_weights` — 17 rows synced (7 Spotify, 3 Discord, 3 MyNetDiary, 4 AppleHealth)
- `user_position_history` — Stores position/raw_score per user per time_scale
- `recompute_locks` — Rate limiting (10 min per user)

## Remaining Manual Steps

1. **Discord env vars** — Add to Vercel project-iwmob:
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET`
   - `DISCORD_REDIRECT_URI`

2. **Disable Deployment Protection** (optional) — For public access without bypass header

## Git State

- Branch: `Desktop`
- Remote: `origin/Desktop` (up to date)
- Latest commit: `447a04f` (move scoring engine out of api/)
