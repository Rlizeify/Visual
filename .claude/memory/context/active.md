# Active Context

**Last updated**: 2026-05-24 (Spotify token persistence shipped)

## Current State

Spotify OAuth tokens now persist to Supabase, not just browser
localStorage. New `public.spotify_tokens` table (self-only RLS, per-
user PK, updated_at trigger). New `services/spotify/tokenStore.ts`
owns an in-memory cache + Supabase persistence + one-time legacy
localStorage migration (dormant after 2026-06-23). `tokens.ts` is now
a thin adapter — existing call sites unchanged. "Disconnect Spotify"
button added to both ProfileDropdowns. Top-of-page banner surfaces
save / refresh-invalid failures non-blockingly. Build clean, tsc
clean. Migration `20260524000002_add_spotify_tokens_table.sql` needs
to be applied to production Supabase. Audit:
`.claude/memory/progress/spotify-token-persistence-audit.md`.
Decision: `.claude/memory/decisions/spotify-token-persistence.md`.

### Prior current state — Asian Vibrant rebuild (2026-05-24)

The Asian Vibrant theme has been **fully rebuilt** with frontend-
design skill guidance. The rebuild ran as a 10-part plan:

1. Audit existing build → `progress/asian-vibrant-rebuild-audit.md`
   (6 bugs B1-B6, 10 visual concerns V1-V10).
2. Rewrite design language doc → "a monk's scriptorium" vision,
   single-kanji-per-panel rule, one-crimson-moment-per-region rule,
   surface vocabulary classes.
3. Rebuild `tokens.css` — added missing `--av-gold-faint` (audit B1)
   + 5 shadow tokens.
4. Rebuild all 11 components — every component now uses the surface
   vocabulary (`.av-paper-card`, `.av-section-title`, `.av-label`,
   `.av-brush-button`, `.av-instrument-shelf`, `.av-lacquer-band`,
   `.av-hanko`).
5. Rework `Decorations.tsx` — single shared RAF for kanji columns
   (audit B4), padding-aware wrap math (B3), `useLayoutEffect` petal
   seed (B6), simpler 5-lobe blossom (V7), reduced dragon (V6).
6. Defensive coding pass — `Promise.allSettled` in ProfileDropdown
   (B2), every RAF cleans up + nulls `lastTime`, all CSS vars resolve.
7. Archive + hygiene — no obsolete files; previous stub already
   archived at `web/src/archive/asian-vibrant-stub/`.
8. Verify — `tsc --noEmit` clean, `vite build` clean (3.59s,
   189 modules).

The `ThemeErrorBoundary` shipped earlier in the day remains in place
as a safety net; the bugs it papered over have now been fixed at
their root causes.

Admin escape hatch (still valid):

```sql
UPDATE profiles SET theme_id = 'frutiger-aero' WHERE id = '<user-uuid>';
```

Scheduled-agent skill loading also diagnosed — see
`.claude/memory/progress/scheduled-agent-skill-loading.md` +
`.claude/memory/patterns/scheduled-agent-workflow.md`. Local
Windows Claude Code has no `/mnt/` tree at all; skills are
surfaced via the `Skill` tool, not via filesystem.

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
3. **Apply
   `web/supabase/migrations/20260524000001_profiles_theme_id.sql` to
   production Supabase.** Without it, the theme switcher writes the
   theme_id but it doesn't persist (the column doesn't exist), and
   the reveal-action toggles in the profile dropdown will fail RLS.
3b. **NEW: Apply
   `web/supabase/migrations/20260524000002_add_spotify_tokens_table.sql`
   to production Supabase.** Without it, Spotify links don't follow
   the account — every new browser / device requires a re-link, same
   as before this change.
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
