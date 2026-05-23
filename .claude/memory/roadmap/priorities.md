# Priorities

Last refreshed: 2026-05-23. Active product = MHEU web app
(https://mheu.lol). Visual desktop is in `legacy/desktop/`.

## Active Right Now

Nothing claimed. Last delivery was T4 social feed (2026-05-23).

## Next Up (in order)

1. Apply Supabase migrations `20260522000001_keepalive.sql` and
   `20260523000001_user_scores_profiles_fk.sql` to production.
2. Set Discord OAuth env vars on Vercel.
3. Decide Vercel Deployment Protection state.
4. H tab implementation.
5. Entertainment half of the E tab.
6. Premium-gate the M-tab seek.

## Coding Rules

- One job per file.
- No line limit on code. `.md` files cap at 200 lines.
- All numeric displays: editable text inputs with units.
- Tooltips on non-obvious controls.
- Archive retired working features under `web/src/archive/` (or
  `legacy/desktop/apps/desktop/src/archive/` for desktop history).
  Delete dead or broken code.
- File-per-plugin for effects.
- All colors from `web/src/styles/tokens.css`.

## Stack

### MHEU Web (active)

- React 18 + TypeScript 5.4 + Vite 5
- Supabase (auth + Postgres + RLS)
- Vercel (serverless functions + daily cron + custom domain)
- Butterchurn 2.6 (WebGL Milkdrop)
- recharts (admin charts)
- react-router-dom 7

### Visual Desktop (legacy)

- Electron 29 (cockpit + display + hub + studio)
- React 18 + TypeScript 5.4 + Vite 5 + vite-plugin-electron
- Tone.js 15
- better-sqlite3 (SQLite)
- Butterchurn (visualizer)
- LJV (2D oscilloscope)

## Layout

### MHEU Web tabs

- **M** — Music: full-screen Butterchurn + waveform progress bar +
  Controls + GearMenu. `MusicTab.tsx` returns `null` because the
  visualizer is mounted at App root.
- **H** — Health: stub.
- **E** — Entertainment + AccountPage (accent picker, avatar,
  display name).
- **U** — User competition: leaderboard + social feed.

### Visual Desktop windows (legacy)

- Hub: splash/launcher.
- Cockpit: DJ decks, MP3 playback, video module, Butterchurn
  preview, plugin rack.
- Studio: additive synth, sample editor, beat pads.
- Visualizer: code commented out — Butterchurn runs inside Cockpit.

## Aesthetic

- Background: `#010103`
- Accent: per-user from `profiles.accent_color` (default teal
  `#00dcc8`); applied via CSS variables on `:root`.
- Waveform gradient: `#87150a → #eea91c` (deliberate hex).
- Vibe: 80s Miami neon + vintage Audi amber instruments + sci-fi
  cockpit + JDM anime edge.

## Archive Locations

### Web

- `web/src/archive/spotify-audio-analysis/` — T2-archived Spotify
  analysis client.
- `web/src/archive/social-feed-inline/` — T4-archived inline feed
  block from `UserCompetitionTab.tsx`.

### Legacy desktop

- `legacy/desktop/apps/desktop/src/archive/visualizer-original/`
- `legacy/desktop/apps/desktop/src/archive/oscilloscopes-original/`
- `legacy/desktop/apps/desktop/src/archive/display-window-original/`
- `legacy/desktop/apps/desktop/src/archive/cockpit-left-panel/`
