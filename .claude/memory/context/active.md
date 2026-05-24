# Active Context

**Last updated**: 2026-05-24 (theme lock-safety shipped)

## Current State

The theme system is now **lock-safe**. A new
`web/src/themes/ThemeErrorBoundary.tsx` wrapped inside
`ThemeProvider` catches any throw from a theme-rendered subtree and
falls back to `DEFAULT_THEME_ID` for the session only — without
writing to `profiles.theme_id`. The failing theme id is added to a
session-local `blockedThemes` Set so the auth-load hydration cannot
immediately re-lock the user. Console gets a
`[theme] '<id>' threw during render — falling back to default for
this session.` breadcrumb.

This unblocks Stone's account (currently stuck on Asian Vibrant)
once the build deploys. The durable admin escape hatch is still:

```sql
UPDATE profiles SET theme_id = 'frutiger-aero' WHERE id = '<user-uuid>';
```

The Asian Vibrant theme's visual code was NOT touched in this
session per Stone's explicit instruction. Audit identified three
risk surfaces (Promise.all of 4 supabase queries in
`ProfileDropdown`, `--av-gold-faint` referenced but undefined,
KanjiColumn wrap calc ignores 12px row padding) — the boundary now
protects them while their root causes are fixed separately.

Scheduled-agent skill loading also diagnosed — see
`.claude/memory/progress/scheduled-agent-skill-loading.md` +
`.claude/memory/patterns/scheduled-agent-workflow.md`. Local
Windows Claude Code has no `/mnt/` tree at all; skills are
surfaced via the `Skill` tool, not via filesystem.

**No queued engineering task.** Next is AC-130 Thermal — currently
still a stub "coming soon" — plus the three Asian Vibrant root
causes the boundary now papers over.

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
