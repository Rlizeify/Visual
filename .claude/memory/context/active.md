# Active Context

**Last updated**: 2026-05-24 (Asian Vibrant theme shipped)

## Current State

Asian Vibrant theme is **fully built and live in the registry**.
Selecting it from the profile dropdown swaps the entire chrome to
crimson-lacquer + gold-leaf + rice-paper surfaces, with a sumi-e
backdrop, drifting cherry petals, scrolling kanji columns, and a
periodic dragon flight. All 11 theme surfaces have real components.
VisualizerPage now pulls PlaybackControls/WaveformBar/GearMenu from
`useTheme().components` so sibling themes can swap them too.

**No queued engineering task.** Next is AC-130 Thermal — currently
still a stub "coming soon".

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
- Themes:
  - `web/src/themes/frutiger-aero/` — full, default.
  - `web/src/themes/asian-vibrant/` — full. Decorative layers in
    `components/Decorations.tsx`, brush icons in `BrushIcons.tsx`,
    surface classes in `theme.css`, palette + fonts in `tokens.css`.
  - `web/src/themes/ac130-thermal/` — stub.
- VisualizerPage wires PlaybackControls/WaveformBar/GearMenu through
  `useTheme().components`.
- Decisions:
  - `.claude/memory/decisions/theme-system-architecture.md`
  - `.claude/memory/decisions/asian-vibrant-design-language.md`
- How-to: `.claude/memory/patterns/theme-system.md`
- Audit: `.claude/memory/progress/asian-vibrant-audit.md`

## Git State

- Local: `main` advancing past `1896e70`.
- Remote: only `origin/main`.
- Vercel: `prj_NTA1v4ALsLHqJ5ZLE1Jf0PjBKpxR` ("project-iwmob"),
  root dir `web`, deploying from `main`. mheu.lol live.

## Untracked but Present

- `/Visual/` — old nested-clone folder. Gitignored. Preserved on
  disk; never tracked.
