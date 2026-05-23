# Active Context

**Last updated**: 2026-05-23 (Theme system foundation shipped)

## Current State

Theme system foundation shipped. The MHEU web app now consumes a
registry of themes via `web/src/themes/`. Frutiger Aero is one theme
among three (Asian Vibrant + AC-130 Thermal stubs). Account /
customization controls moved into a persistent profile dropdown
anchored to a new top-left profile icon in the nav. E tab is now a
"Entertainment coming soon" placeholder.

**No queued engineering task.** Next priorities are PART 2 of the theme
rollout — actually building the Asian Vibrant + AC-130 Thermal themes
(currently render "coming soon" placeholders).

## Active Product

MHEU web app at https://mheu.lol. Source tree `/web`. Electron
desktop is parked in `legacy/desktop/`.

## What's Live on mheu.lol

- Real-time scoring engine (soft-cap 0–200), 4 connectors, prestige
  tiers.
- M tab: Butterchurn + waveform progress bar (SVG path, click to
  seek) + Controls + GearMenu (tab-audio capture + signal meter).
- H tab: stub.
- E tab: stub ("Entertainment coming soon").
- U tab: leaderboard + social feed (T4 module under
  `web/src/features/feed/`).
- **NEW: profile icon top-left of nav (persistent across all tabs).**
  Click opens dropdown with avatar upload, accent color picker,
  reveal-action toggles per score type, theme switcher (Frutiger Aero
  / Asian Vibrant / AC-130 Thermal), sign-out.
- /admin: 10 tabs (Users, OAuth, LifeScores, Leaderboard, Scoring,
  ScoreVisibility, Passwords, Presets, Tooltips, Palette).
- Supabase keepalive (client + cron) preventing 7-day auto-pause.

## Function Budget (Hobby tier: 12)

At ceiling. Anything new replaces or folds into an existing
function. Helpers prefixed with `_` (no default export) are not
counted.

## Manual Steps Required

1. Apply `web/supabase/migrations/20260522000001_keepalive.sql` to
   production Supabase.
2. Apply `web/supabase/migrations/20260523000001_user_scores_profiles_fk.sql`
   to production Supabase (optional — handler already works without
   it).
3. **NEW: Apply
   `web/supabase/migrations/20260524000001_profiles_theme_id.sql` to
   production Supabase.** Without it, the theme switcher writes the
   theme_id but it doesn't persist (the column doesn't exist), and
   the reveal-action toggles in the profile dropdown will fail RLS.
4. Set Discord OAuth env vars on Vercel:
   `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`,
   `DISCORD_REDIRECT_URI`.
5. Decide Vercel Deployment Protection state.

## Theme System Quick Map

- Registry: `web/src/themes/registry.ts`
- Contract: `web/src/themes/types.ts` (`ThemeManifest`, `ThemeSurfaces`)
- Context: `web/src/themes/ThemeContext.tsx` (`useTheme()`)
- Themes: `web/src/themes/frutiger-aero/`, `asian-vibrant/`, `ac130-thermal/`
- Profile dropdown (Frutiger Aero):
  `web/src/themes/frutiger-aero/components/ProfileDropdown.tsx`
- Decision: `.claude/memory/decisions/theme-system-architecture.md`
- How-to: `.claude/memory/patterns/theme-system.md`

## Git State

- Local: `main` advancing past `1896e70`.
- Remote: only `origin/main`.
- Vercel: `prj_NTA1v4ALsLHqJ5ZLE1Jf0PjBKpxR` ("project-iwmob"),
  root dir `web`, deploying from `main`. mheu.lol live.

## Untracked but Present

- `/Visual/` — old nested-clone folder. Gitignored. Preserved on
  disk; never tracked.
