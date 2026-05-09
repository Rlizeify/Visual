# Active Context

**Last updated**: 2026-05-08

## Current Task
Feat: Admin data console — full 5-tab build + /u tab wired to live data.

## Status
Complete. All five admin tabs functional. The `/u` leaderboard reads from `leaderboard_config` joined with `life_score_derivatives` and falls back to mock data when no admin-configured slots exist.

- Migrations 7 + 8 + 9 applied: `leaderboard_config`, `audit_log`, public-read RLS for leaderboard-listed users' `profiles` and `life_score_derivatives` (consent-by-admin model — opting a user into a `visible=true` row exposes their profile + derivatives to anon/authenticated reads).
- Edge functions under `web/api/admin/`: users (GET list, PATCH/DELETE per-id), reset-password, set-password (super-admin only), oauth (GET list, DELETE per-id), life-scores (GET list, PATCH per user_id+metric), leaderboard (GET admin view, PUT replace).
- Shared backend helpers in `web/api/_admin.ts` (`requireAdmin` + `logAudit` + `methodNotAllowed`); shared browser helper in `web/src/lib/adminApi.ts` (auth-attaching fetch wrapper).
- Admin UI primitives in `web/src/components/admin/`: `AdminTable` (sortable, dense, monospace), `AdminModal`, `AdminConfirmDialog` (optional typed-confirmation gate), `AdminToolbar` (search + status + actions), shared `theme.ts`.
- Five tabs wired in `AdminDashboard.tsx`: **Users** (list + edit username/display_name/is_admin + delete with typed-confirmation), **Passwords** (reset email + super-admin force-set with audit-log warning banner), **OAuth** (list with provider color + expiry status + disconnect-only-our-row), **Life Scores** (list + edit any of 5 derivatives + recompute placeholder), **Leaderboard** (HTML5 drag-reorder + visibility toggle + add-from-dropdown + dirty-state save/discard).
- `/u` `UserCompetitionTab.tsx` now fetches `leaderboard_config` (visible only) joined with `profiles`, then `life_score_derivatives` for those user_ids, aggregating across metrics (sum) into the single-row-per-user shape the leaderboard table expects. Falls back to mock with a "MOCK · admin not configured" badge when the config table has no visible rows.
- Decision doc `decisions/admin-data-console.md` covers service-role boundary, audit log semantics, super-admin email gating, leaderboard replace strategy, file layout, and follow-ups (recompute edge function, provider-side OAuth revoke, server-side rate limiting).
- `tsc --noEmit` and `vite build` clean across all six commits in this phase (`76e20a9 4bb8608 220ff7a a54358a bec1ef2` + the U-tab/migration-9 commit).

## Previous Task
Feat: Admin auth shell — `/admin` route with separate login + role gate.
- Migrations 7 + 8 applied: `leaderboard_config` (admin-write/public-read-visible) and `audit_log` (admin-read, service-role-write). Migration 7 also adds `profiles.username text` (unique-when-present partial index) so the Users tab can edit username + display_name + is_admin together.
- Edge functions under `web/api/admin/`: `users.ts`, `users/[id].ts` (PATCH/DELETE), `reset-password.ts`, `set-password.ts` (super-admin only), `oauth.ts`, `oauth/[id].ts` (DELETE), `life-scores.ts`, `life-scores/[user_id]/[metric].ts` (PATCH), `leaderboard.ts` (GET/PUT replace).
- Shared helper `web/api/_admin.ts`: `requireAdmin(req,res)` validates JWT → checks `profiles.is_admin` → returns service-role-keyed Supabase client + caller identity (`isSuperAdmin` derived from hardcoded email). `logAudit(ctx, args)` records every write best-effort. `methodNotAllowed(res, allowed)` for HTTP method dispatch.
- Browser helper `web/src/lib/adminApi.ts`: attaches Supabase JWT to fetch, throws on non-2xx with server's error message. Convenience wrappers `adminGet/adminPost/adminPatch/adminPut/adminDelete`.
- Tab framework + UI primitives in `web/src/components/admin/`: `theme.ts` (palette + monospace font), `AdminTable.tsx` (sortable click-headers, dense rows, monospace, generic Column<T> API), `AdminModal.tsx` (Esc-to-close, click-outside dismiss), `AdminConfirmDialog.tsx` (optional typed-confirmation for destructive actions), `AdminToolbar.tsx` (search + status + actions row), `TabPlaceholder.tsx` (placeholder for not-yet-built tabs).
- `AdminDashboard.tsx` now hosts a 5-tab nav (Users, Passwords, OAuth, Life Scores, Leaderboard); Users tab is real, others are placeholders.
- Users tab: lists all auth.users joined with profiles, dense table with sortable columns (email/username/display_name/is_admin/created/last_sign_in/id), client-side search, refresh button, row-click → edit modal (username, display_name, is_admin), delete button → typed-confirmation dialog (must type the user's email or id to enable Delete) → cascades through `auth.admin.deleteUser`.
- Decision doc `decisions/admin-data-console.md`: service-role boundary, audit log semantics, super-admin gating rationale, leaderboard replace strategy, file layout, open follow-ups.
- `tsc --noEmit` and `vite build` both clean.
- Repo-root `.gitignore` now covers stray `/supabase/.temp/` if `npx supabase` is ever invoked from the wrong cwd; canonical path remains `web/supabase/`.

## Previous Task
Feat: Admin auth shell — `/admin` route with separate login + role gate.

## Status
Complete (gate only; data tables are Phase 2).
- Migration `20260508000006_add_admin_role.sql`: adds `profiles.is_admin` column, `is_admin(uuid)` SECURITY DEFINER helper, additive admin SELECT policies on profiles/oauth_connections/life_score_samples/life_score_derivatives, and `bootstrap_admin(email)` function exposed only to `service_role`.
- `web/src/pages/AdminLogin.tsx`: standalone terminal-style page (black bg, monospace, red accents). 5-attempt → 15-min lockout via localStorage; documented as a stopgap. `?error=access_denied` query param renders a banner.
- `web/src/pages/AdminDashboard.tsx`: shell with header + sign-out + "Phase 2: data tables coming" placeholder. Same terminal aesthetic.
- `web/src/components/AdminProtectedRoute.tsx`: queries `profiles.is_admin` for the current session user. Unauthed → redirect `/admin/login`. Authed but not admin → `supabase.auth.signOut()` then redirect `/admin/login?error=access_denied`. Renders children only when `is_admin = true`.
- `web/src/App.tsx`: routes `/admin/login` and `/admin` (gated). Added `STANDALONE_BG_ROUTES = ['/admin', '/admin/login']` to suppress both the GroovyBackground and the Butterchurn visualizer on admin pages.
- `/admin` is intentionally not linked from the MHEU shell — URL-only access by design.
- Decision doc: `.claude/memory/decisions/admin-bootstrap.md` covers schema/RLS rationale, how to seed CB via `select public.bootstrap_admin('cbauschek@gmail.com')` in the Supabase SQL editor, and the open follow-up on real (server-side) rate limiting.
- Verified live: terminal page renders bare on `/admin/login` (0 canvases, no Frutiger glass), unauthed `/admin` redirects to `/admin/login`, lockout banner + disabled submit appear when localStorage marks 5 attempts, `?error=access_denied` shows the banner. `tsc --noEmit` and `vite build` clean.

## Previous Task
Feat: Port desktop Hub groovy wave background to web pre-auth pages.

## Status
Complete.
- Located source: `legacy/desktop/apps/desktop/src/components/hub/HubApp.tsx` → `WaveCanvas` (lines 19–112). 8 bezier-band wave layers with phase-shifted sine + radial vignette over `#05000f` base, rAF loop, 8-color palette (dark purples / teal / magenta).
- Created `web/src/components/GroovyBackground.tsx`: faithful port with DPR scaling and `visibilitychange` pause. `position: fixed; inset: 0; z-index: -1; pointer-events: none; aria-hidden`.
- Wired in `web/src/App.tsx`: `GROOVY_BG_ROUTES = ['/login', '/signup', '/']`. Mutually exclusive with `showVisualizer` so MHEU routes (`/m /h /e /u`) keep the Butterchurn viz only.
- `web/src/pages/Login.tsx` and `Signup.tsx` outer wrappers changed from `background: colors.bg` → `background: 'transparent'` so the wave shows through behind the translucent form panel.
- Verified end-to-end via Vite dev server: canvas mounts on `/login` and `/signup`, absent on `/m /h /e /u`, animation advances frame-to-frame, `pointer-events: none` so form inputs receive focus/clicks, hit-tests confirm form interactivity.
- `tsc --noEmit` clean. `vite build` clean.

## Previous Task
Feat: MHEU 4-tab shell with viz background behavior + User Competition UI.

## Status
Complete.
- Built `MHEUShell.tsx` with 4 tabs: M (Music), H (Health), E (Entertainment), U (User Competition)
- Tab navigation persistent, Frutiger Aero styling with HitmarkerText font
- Visualizer stays mounted on all tabs — no remount on tab switch
- Fog overlay (backdrop-filter blur 20px + rgba overlay) on H/E/U tabs, 300ms fade transition
- M tab: fullscreen viz, no overlay
- H/E tabs: "Coming soon" frosted glass placeholder cards
- U tab full scaffold: connection panel (Spotify/Discord/MyNetDiary/Apple), score panel (5 derivatives), leaderboard table (4 mock rows), history chart (Recharts line chart)
- Added react-router-dom and recharts dependencies
- Updated App.tsx with BrowserRouter, routes /m /h /e /u, default redirect to /m on localhost
- Added hideUI prop to VisualizerPage to suppress controls when viz runs as background
- Commit: `49ebdb9 feat: add MHEU 4-tab shell with viz background behavior`

## Previous Task
Feat: Supabase auth + Life Score schema setup.
- Reactivated Supabase project (credentials already in `.env.local`)
- Added `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for client access
- Created `web/src/lib/supabase.ts` client singleton
- Built `Login.tsx` and `Signup.tsx` pages (Frutiger Aero style)
- Created `AuthContext.tsx` with user, session, signIn, signUp, signOut, signInWithSpotify
- Updated `App.tsx` with protected routes and auth flow integration
- Created 3 schema migrations in `web/supabase/migrations/`:
  - `profiles` (linked to auth.users, auto-created on signup)
  - `oauth_connections` (encrypted tokens via pgcrypto)
  - `life_score_samples` and `life_score_derivatives`
- All tables have RLS policies (user can only access own rows)
- Decision document: `.claude/memory/decisions/oauth-token-storage.md`

## Previous Task
Research: Tool and MCP server integration survey.

## Previous Task
Decision: Reactivity architecture for Tizen TV + Spotify source.

## Previous Status
Complete.
- Investigated three architecture paths for true audio reactivity on Samsung Tizen TV with Spotify source.
- **Path A (Pure web)**: KILLED — Spotify Web Playback SDK blocks audio routing via DRM/Widevine. AnalyserNode access explicitly denied per GitHub issue #25.
- **Path B (Desktop host + LAN WebSocket)**: RECOMMENDED — WASAPI loopback captures system audio, FFT runs locally, bands broadcast over WebSocket. Tizen supports WebSocket. <50ms latency, zero ongoing cost.
- **Path C (Cloud relay)**: Viable fallback — Pusher/Ably relay works cross-network but 60Hz messaging exceeds free tiers ($390/mo on Ably) and adds 65-100ms latency.
- Decision written to `.claude/memory/decisions/reactivity-architecture.md`.

## Previous Task
Fix: Hitmarker Text fonts not bundled by Vite.

## Status
Complete.
- Root cause: `fonts.css` referenced `../../fonts/18082023_Hitmarker/Text/WOFF/...` — that path leaves the Vite source root (`apps/desktop/src/`), so Vite did not copy the woff2/woff files into `dist/assets/`. Confirmed empirically: pre-fix `dist/assets/` contained `SDGlitch-*.ttf` (which lives at `src/styles/fonts/SDGlitch.ttf`, inside the source tree) but **zero** Hitmarker files. Vite has no `publicDir` configured, so anything outside `src/` is invisible to the bundler.
- Fix: copied the 8 referenced files (Regular/Italic/Medium/Bold × woff2+woff) from `apps/desktop/fonts/18082023_Hitmarker/Text/WOFF/` into `apps/desktop/src/styles/fonts/HitmarkerText/`. Updated `fonts.css` `url()` paths from `../../fonts/18082023_Hitmarker/Text/WOFF/` → `./fonts/HitmarkerText/` (mirrors the SDGlitch pattern).
- Verified: `npx vite build` now emits all 8 hashed Hitmarker files into `dist/assets/` (e.g. `HitmarkerText-Regular-APgbd4-k.woff2`). `npx tsc --noEmit` clean.
- Original `apps/desktop/fonts/18082023_Hitmarker/` tree left untouched (still contains the full Condensed/Normal/Wide/VF families if needed later).

## Previous Task
Fix: stale Spotify token + CSP blocking file:// video + Windows drive colon encoding.

## Status
Complete.
- `electron/spotify-auth.ts:11` — bumped `REQUIRED_SCOPE_VERSION` from `'2'` to `'3'`. Existing tokens granted under older scope set are cleared on next launch via `checkAndInvalidateScopeChange()`, forcing re-OAuth with the full `playlist-read-private`/`playlist-read-collaborative` scopes. Symptom on collaborator's machine: `/v1/me/playlists` returned playlists with `tracks` field undefined and `/v1/playlists/{id}/tracks` returned 403.
- `index.html` (only HTML with CSP) — added `file:` to `media-src` and `img-src`. Other HTML files (hub/studio/display) have no `<meta>` CSP and inherit Electron defaults; no main.ts header injection found.
- `src/audio/SpotifyPlayerAPI.ts` — `console.warn` now logs `typeof p.tracks` so undefined / null / `{total:0}` are distinguishable.
- `src/components/cockpit/SpotifyBrowser.tsx` — when `playlists.length > 0` but every playlist has `trackCount === 0`, renders a `sp-reconnect-banner` prompting disconnect/reconnect. Catches stale-scope case in UI.
- `src/components/cockpit/VideoPreview.tsx` — `toFileURL()` now restores Windows drive letter colon after URL-encoding (`/C%3A/` → `/C:/`) via `replace(/^\/([A-Za-z])%3A/, '/$1:')`. Trace: `C:\Users\nikob\Videos\clip.mp4` → `file:///C:/Users/nikob/Videos/clip.mp4`. `<video onError>` was already wired in earlier session.
- `npx tsc --noEmit` clean.

## Previous Task
Feat: Wire Spotify visualizer audio capture via Electron loopback (real implementation).

## Status
Complete — visualizer loopback is **now actually implemented**.
- `SpotifyPlayerAudio.ts` — silent oscillator stub **removed**. Replaced with `getDisplayMedia({ video: true, audio: true })` capture; video tracks stopped/removed immediately, audio track wired into the analyser via `MediaStreamAudioSourceNode`. Analyser is **not** connected to destination (avoids speaker feedback). Wrapped in try/catch — failures (no audio tracks on macOS/Linux, NotAllowedError, etc.) log a warning and return `false` instead of crashing. New exports: `isLoopbackRunning()`; `startLoopback()` now returns `boolean`.
- `SpotifyBrowser.tsx` — added "Enable Audio Reactivity" button in the toolbar. Visible when `activeSource === 'spotify'` and loopback idle; switches to "Audio Reactivity: On" on success or "Audio capture is Windows-only" on failure. Click is the user-gesture entrypoint for `getDisplayMedia`. Component now takes an `activeSource` prop.
- `CockpitGrid.tsx` — forwards `activeSource` to `<SpotifyBrowser>`.
- `CockpitApp.tsx` — auto-reconnect path no longer calls renderer-side `startLoopback()` (would throw NotAllowedError without user gesture). `handleSpotifyConnected` still attempts it best-effort with a comment noting the OAuth callback may not preserve the gesture chain; the button is the reliable fallback.
- Caveat: loopback captures **all** system audio, not just Spotify (inherent to Electron's loopback handler). UI text avoids claiming Spotify-only.
- Correction to earlier note below: previous "Spotify visualizer loopback is NOT IMPLEMENTED" line is **now stale** — loopback is implemented as of this session.

## Previous Task
Fix: Spotify API error surfacing.
- `SpotifyPlayerAPI.ts` — `fetchPlaylists()`/`fetchPlaylistTracks()` `console.error` status + statusText on non-OK responses.
- `SpotifyBrowser.tsx` — empty playlist state (when `isConnected`) shows error hint.

## Previous Task
Fix: VideoPreview `toFileURL()` URL-encoding (real fix this time).

## Status
Complete.
- `VideoPreview.tsx:13` — `toFileURL()` now URL-encodes each path segment via `encodeURIComponent`. Paths containing spaces, `#`, `?`, or other reserved chars now produce valid `file://` URLs (e.g. `clip #1.mp4` → `clip%20%231.mp4`).
- `VideoPreview.tsx` — added `loadError` state and `onError` handler on `<video>` that logs the failed src + `MediaError` to console and renders a visible "Failed to load video" overlay (`vp-error` class) instead of a silent black box.
- Earlier session 25 note claimed encoding was "already in place" — that was wrong; the prior `toFileURL` only normalized slashes. Corrected.

## Previous Task (DVR import + long MP4 playback)
- `electron/main.ts:385` — added `dvr`, `mkv`, `m4v` to import filter.
- `VideoFiles.tsx` — updated empty-state hint to mention dvr.
- `VideoPreview.tsx` — `preload="auto"` → `preload="metadata"` so long videos don't pre-buffer entire file.
- No size/duration limits existed in import or playback paths; nothing to remove.
- DVR playability depends on the actual container — Chromium handles MPEG-TS but not DVR-MS. Verification (manual test) will confirm per-file.

## What Was Completed (session 24)
1. **Removed Web Playback SDK** — `SpotifyPlayer.ts` no longer loads SDK script, creates Player object, or calls `init()`. All SDK-related code deleted.
2. **Web API control** — `SpotifyPlayerControls.ts` (new) handles all playback commands via `PUT/POST /v1/me/player/*`. No `device_id` required — plays on user's active Spotify device.
3. **Polling** — `SpotifyPlayer.ts` polls `GET /v1/me/player` every 2s when connected. State (track, position, isPlaying) flows through existing subscribe/listener pattern.
4. **WASAPI loopback** — `electron/audio-loopback.ts` (new) uses `naudiodon` `AudioIO` to capture system audio output as Float32 PCM. Streams chunks to renderer via `win.webContents.send('audio:pcm-data', ...)`.
5. **PCM routing** — INCOMPLETE / NOT IMPLEMENTED. `SpotifyPlayerAudio.ts` is still the silent oscillator stub from earlier sessions; `getUserMedia({chromeMediaSource:'desktop'})` crashed the renderer and a real WASAPI loopback was deferred until VS Build Tools are installed. The visualizer does **not** react to Spotify audio.
6. **IPC bridge** — `preload-cockpit.ts` exposes `startLoopback`, `stopLoopback`, `onAudioData` to renderer.
7. **Source switching** — `CockpitApp.tsx`: Spotify connect → starts loopback, `setActiveSource('spotify')`. MP3 load → stops loopback, `setActiveSource('mp3')`.
8. **castlabs removal** — `electron` dep changed to standard `^29.4.6`. `components.whenReady()` Widevine block removed from `main.ts`.
9. **UI updates** — `SpotifyBrowser` shows now-playing bar always (not behind `isReady` gate). `SpotifyNowPlaying` gains progress bar. Devices list shown if no active device.

## Codebase Summary
- Multi-window: Hub (launcher + tools + tutorial), Cockpit (DJ + video + viz + plugins + Spotify), Studio (synth + sampler)
- Persistence: SQLite at userData/visual.db — projects, project_state, media_library, settings tables
- Spotify: OAuth PKCE (hardcoded client ID, 127.0.0.1 redirect), Web API polling (no SDK), playlist browser, now-playing bar with progress. Visualizer audio loopback is NOT implemented — `SpotifyPlayerAudio.ts` is a silent stub.

## Spotify file map
| File | Purpose | Lines |
|------|---------|-------|
| `SpotifyPlayerTypes.ts` | Interfaces (SpotifyTrack, SpotifyPlaylist, SpotifyPlayerState) | 28 |
| `SpotifyPlayerAPI.ts` | fetchPlaylists, fetchPlaylistTracks | ~48 |
| `SpotifyPlayerControls.ts` | playTrackUri, pause/resume/next/prev, getDevices, getNowPlaying | ~70 |
| `SpotifyPlayerAudio.ts` | getDisplayMedia loopback → MediaStreamAudioSourceNode → AnalyserNode | ~85 |
| `SpotifyPlayer.ts` | Service class (polling, state, controls) | ~100 |
| `SpotifyNowPlaying.tsx` | Now-playing strip + progress bar | ~35 |
| `SpotifyTrackList.tsx` | Expandable track list | 44 |
| `SpotifyBrowser.tsx` | Main browser + devices list | ~115 |
| `electron/audio-loopback.ts` | Electron native displayMedia loopback IPC | ~14 |

## Git State
- Branch: main
- All changes are local only

## Up Next
- Manual test: start app → connect Spotify → verify Electron loopback starts → check visualizer reacts
