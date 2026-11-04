# MHEU / Visual — Full Codebase Audit (Phase 0)

**Date:** 2026-10-31
**Branch:** `main` (read-only session; no source changed)
**Scope:** `web/` (active product). `legacy/desktop/` is retired and excluded except where noted.
**Live:** https://mheu.lol (Vercel project `project-iwmob`) — confirmed up, redirects to `/login`.

> **Verification note.** Every item below was checked against the current tree,
> not against prior memory. One owner-supplied assumption did **not** match the
> code — the E-tab "Scene" work (Ticketmaster, Leaflet/OSM, scrape cron) was never
> built. Line numbers are as of this commit.
>
> **Update (2026-10-31, §0 + §6 only).** The audit body was first written against
> base `50902e5`, where `/investing` did **not** exist. The `/investing` feature
> has since shipped to `main` (a full SPX-option comparison tool). Sections **0**
> and **6** below have been rewritten to reflect the shipped code; the rest of the
> audit still reads against `50902e5` and does not yet account for the investing
> files (see §10 Phase 3 note).

---

## 0. Headline reality-checks (read first)

| Owner assumption | Reality in code | Impact |
|---|---|---|
| Investing page `/investing` (SPX option comparison) = **KEEP** | **Built and shipped** (landed on `main` after the audit's `50902e5` base). Full feature: `src/features/investing/*` (13 files) + shared options engine `src/lib/options/*` (Black-Scholes, rates, scenarios, tests), route `/investing` in `App.tsx:367` (**public — guests use device-local storage, signed-in syncs via Supabase RLS**), migration `20261028000001_investing_tables.sql` (3 tables), server handler `_handlers/market-snapshot.ts` + cron job. | Investing is a **KEEP — already done**, not a net-new build. Still **2** serverless functions. See the rewritten §6. |
| E-tab / Scene work (Ticketmaster, Leaflet/OSM, scrape cron, admin review queue) = **CUT** | **None of it exists.** `/e` and `/h` are static "coming soon" placeholders. No ticketmaster/leaflet/osm/scrape/scene code anywhere. | Nothing to cut here beyond deleting two placeholder tabs. |
| Three themes to cut | Confirmed: `frutiger-aero` (active), `asian-vibrant`, `ac130-thermal`. | But **Obsession depends on `ac130-thermal`** — see BLOCKER B1. |
| Digital-audio-cable input to cut | Confirmed: the `getUserMedia` + BlackHole/VB-Cable auto-select path in `captureMicStream`. Tab capture (`getDisplayMedia`) already exists and is the replacement. | Section 4 + Phase 5. |

---

## 1. INVENTORY

### 1.1 Routes / pages (`web/src/App.tsx`)

| Route | Entry component | Auth gating today | Feature | Verdict |
|---|---|---|---|---|
| `/` | redirect | → `/login` (prod) / `/m` (localhost bypass) | shell | KEEP (rework) |
| `/login` | `pages/Login.tsx` | public | auth | KEEP |
| `/signup` | `pages/Signup.tsx` | public | auth | KEEP |
| `/spotify-login` | `features/spotify/LoginPage.tsx` | signed-in, not Spotify-linked | Spotify | KEEP |
| `/callback` | inline OAuth handler (element `null`) | public | Spotify OAuth | KEEP |
| `/admin/login` | `pages/AdminLogin.tsx` | public | admin | DECIDE |
| `/admin` | `pages/AdminDashboard.tsx` via `components/AdminProtectedRoute.tsx` | admin only (`profiles.is_admin`) | admin | DECIDE |
| `/m` | `components/tabs/MusicTab.tsx` (renders `null`) | auth **+ Spotify link** | visualizer | KEEP |
| `/h` | `components/tabs/HealthTab.tsx` → theme `HTabPlaceholder` | auth + Spotify link | placeholder | CUT |
| `/e` | `components/tabs/EntertainmentTab.tsx` → theme `ETabPlaceholder` | auth + Spotify link | placeholder | CUT |
| `/u` | `components/tabs/UserCompetitionTab.tsx` | auth (data needs session) | Life Scores / leaderboard | DECIDE |
| `/obsession/*` | `features/obsession/ObsessionRoutes.tsx` | signed-in + easter-egg (`useObsessionEgg`) | hidden self-discipline | DECIDE |
| `/visualizer` | `vercel.json` rewrite → `index.html` | — | legacy alias (no route handler) | CUT (dead rewrite) |
| `*` | redirect → `/m` (localhost) or `/login` | — | — | KEEP |

The visualizer (`features/visualizer/VisualizerPage.tsx`) is mounted **at App root**, not inside a route, and persists behind `/m /h /e /u`. The MHEU shell (`components/MHEUShell.tsx`) wraps `/m /h /e /u` only and delegates to the active theme's `DashboardShell`.

**Routing gate is auth + Spotify-link coupled:** signed-in users with no Spotify token row are bounced from `/m /h /e /u` to `/spotify-login`. This contradicts the new access model (visualizer + Spotify require login; the MHEU tab split is going away). Rework in Phase 3.

### 1.2 Theme system map

| Piece | File | Role |
|---|---|---|
| Registry | `src/themes/registry.ts` | 3 themes, `DEFAULT_THEME_ID = frutiger-aero` |
| Context | `src/themes/ThemeContext.tsx` | active theme, `setTheme`, persists to `profiles.theme_id` + `localStorage['mheu_theme_id']` |
| Error boundary | `src/themes/ThemeErrorBoundary.tsx` | catches theme render throws, falls back to default for session |
| Contract | `src/themes/types.ts` | `ThemeManifest` + 11 `ThemeSurfaces` |
| Shell consumer | `src/components/MHEUShell.tsx` | renders active theme's `DashboardShell` |
| Obsession override | `src/features/obsession/ThemeOverrideProvider.tsx` | **forces `ac130-thermal`** on `<html>` for `/obsession/*` |
| Tokens (CSS) | `src/styles/tokens.css` (fallback `:root`), per-theme `src/themes/<id>/tokens.css` | CSS custom properties |
| Tokens (TS) | `src/styles/tokens.ts` | TS refs to the CSS vars |
| Global CSS | `src/styles/global.css`, `src/styles/fonts.css` | base + `HitmarkerText` font |
| Shell CSS | `src/components/MHEUShell.css` | nav/card classes |

**Three themes**, each a folder with `index.ts` (manifest), `shell.tsx` (all pass-through now), `tokens.css`, and 11 surface components (`DashboardShell`, `NavBar`, `ProfileDropdown`, `MTab`, `HTabPlaceholder`, `ETabPlaceholder`, `UTab`, `PlaybackControls`, `GearMenu`, `WaveformBar`, `SocialFeedRow`):
- `frutiger-aero/` — active/default. No `theme.css` (uses tokens + global).
- `asian-vibrant/` — has `theme.css`, `components/BrushIcons.tsx`, `Decorations.tsx`.
- `ac130-thermal/` — has `theme.css`, `components/Decorations.tsx`, extra MTab/UTab/WaveformBar.

**Components with theme-specific branching:** everything consuming `useTheme()` — `MHEUShell`, `VisualizerPage` (pulls `PlaybackControls`/`WaveformBar`/`GearMenu` from theme), `MusicTab`/`HealthTab`/`EntertainmentTab`/`UserCompetitionTab` (pull surfaces), each theme's `NavBar`/`DashboardShell`/`ProfileDropdown`.

### 1.3 Serverless routes

**`api/index.ts`** (`?_route=` dispatcher, set by `vercel.json` rewrites):
`auth`, `oauth`, `scores`, `settings`, `health`, `admin.users`, `admin.leaderboard`, `admin.tooltips`, `admin.scoring`, `admin.presets`, `admin.oauth`.
Handlers under `api/_handlers/*` and `api/_handlers/admin/*`. Shared helpers: `_admin.ts` (big, 5 admin handlers), `admin/_admin.ts` (small, presets only — documented footgun), `_auth.ts`, `_db.ts`, `_jwt.ts`, `_spotify-ingestion.ts`.

**`api/cron.ts`** (`?job=` dispatcher, `CRON_SECRET` bearer gate at top): `recompute` → `_handlers/cron/recompute.ts`.

**Cron schedule (`vercel.json`):** `recompute` daily at `0 0 * * *` (midnight UTC; Hobby tier = daily only). Only 2 deployed functions (`index`, `cron`) — at design, well under the 12 limit.

### 1.4 Environment variables

**Server (`process.env`):** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPER_ADMIN_EMAILS`, `JWT_SECRET`, `CRON_SECRET`, `NODE_ENV`, `SPOTIFY_CLIENT_ID`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`, `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI`, `VERCEL_URL`, `MYNETDIARY_ENCRYPTION_KEY`.
**Client (`import.meta.env`):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPER_ADMIN_EMAILS`.

> **No `TICKETMASTER_API_KEY` is referenced in code** (owner's example of an unused var). If it exists in Vercel, it is already orphaned. See §3.3.

### 1.5 Dependencies (`web/package.json`) and what uses them

| Dep | Used by | Verdict |
|---|---|---|
| `@supabase/supabase-js` | client `lib/supabase.ts`, all server handlers | KEEP |
| `butterchurn`, `butterchurn-presets` | `features/visualizer/VisualizerEngine.ts`, admin `PresetsTab` | KEEP (dominant bundle weight) |
| `react`, `react-dom` | everywhere | KEEP |
| `react-router-dom` (v7) | `App.tsx`, shells, nav | KEEP |
| `qrcode.react` | `features/spotify/LoginPage.tsx` (device-link QR) | KEEP |
| `jsonwebtoken` + `@types/jsonwebtoken` | `api/_jwt.ts` | KEEP (server) |
| `@vercel/node` | serverless types | KEEP (server) |
| `recharts` + `@types/recharts` | **nothing** — zero imports (confirmed by grep, depcheck, knip) | **CUT (unused)** |

Dev: `typescript`, `vite`, `vitest`, `@vitejs/plugin-react`, `@types/node`, `@types/react`, `@types/react-dom` — all used.

---

## 2. CLASSIFICATION TABLE

> K=KEEP, C=CUT, D=DECIDE.

### Client source
| Path | K/C/D | Reason |
|---|---|---|
| `features/visualizer/**` | K | Butterchurn visualizer (the product). |
| `features/spotify/**`, `services/spotify/**` | K | Spotify integration + PKCE auth + playback. |
| `audio/audioSource.ts`, `audio/liveAnalyser.ts`, `audio/waveformBuffer.ts`, `audio/positionSource.ts`, `audio/sampleAmplitude.ts` | K | Feed the shared AnalyserNode / waveform progress bar. |
| `audio/AudioWSClient.ts` | C | Orphan (knip: unused file). WebSocket audio leftover from desktop. |
| `context/AuthContext.tsx`, `context/ProfileContext.tsx` | K | Auth + cached profile row. |
| `lib/supabase.ts`, `lib/accentColor.ts` | K | Supabase client; accent injection (accent toggle). |
| `lib/adminApi.ts` | D | Admin dashboard fetch layer. |
| `pages/Login.tsx`, `pages/Signup.tsx` | K | Auth pages (restyle). |
| `pages/AdminLogin.tsx`, `pages/AdminDashboard.tsx`, `components/AdminProtectedRoute.tsx`, `components/admin/**` (14 files) | D | Admin dashboard (users, leaderboard, tooltips, scoring, presets, oauth, palette, passwords, score-visibility, life-scores tabs). PresetsTab is the only admin surface the **visualizer** benefits from. |
| `components/MHEUShell.tsx` + `.css` | K (rework) | Shell; nav/card classes reused. |
| `components/GroovyBackground.tsx`, `components/LoadingScreen.tsx` | K | Background for auth pages; boot splash. |
| `components/tabs/MusicTab.tsx` | K | Visualizer route target. |
| `components/tabs/HealthTab.tsx`, `EntertainmentTab.tsx` | C | Placeholder tabs for unbuilt H/E sections. |
| `components/tabs/UserCompetitionTab.tsx` | D | Life Scores / leaderboard UI. |
| `features/feed/**` (9 files, `feed.css`) | D | Social feed — only consumed by `UserCompetitionTab` (Life Scores). |
| `features/oscilloscope/**` (4 files) | C | **Orphan** — never imported anywhere (knip + grep). |
| `features/obsession/**` (~30 files, `obsession.css`) | D | Hidden feature, not in owner's list. **Depends on ac130-thermal theme — BLOCKER B1.** |
| `scoring/engine.ts` (+ `engine.test.ts`) | D | Scoring curve; used by test + (indirectly) server concepts. |
| `scoring/connectors/**` (applehealth, discord, mynetdiary, spotify, index, types) | C | **Orphan client copies** (knip: unused files). Live ingestion is server-side `api/_spotify-ingestion.ts`. Verify before delete. |
| `shared/hooks/useMouseIdle.ts` | K | Visualizer controls auto-hide. |
| `ui/Slider.tsx` | K | Used by GearMenu/admin. |
| `ui/Panel.tsx` | C | Orphan (knip). |
| `themes/registry.ts`, `ThemeContext.tsx`, `ThemeErrorBoundary.tsx`, `types.ts` | C→rebuild | Multi-theme machinery; replaced by single dark theme. |
| `themes/frutiger-aero/**` | C (harvest) | Default look; harvest NavBar/DashboardShell/ProfileDropdown structure into the new single theme. |
| `themes/asian-vibrant/**`, `themes/ac130-thermal/**` | C | Both cut — but ac130 is a live dependency of Obsession (B1). |
| `archive/**` | — | Already archived; leave per Archive Policy. |

### API / cron
| Path | K/C/D | Reason |
|---|---|---|
| `api/index.ts`, `api/cron.ts` | K | The two deployed functions. |
| `api/_handlers/auth.ts`, `_db.ts`, `_jwt.ts`, `_auth.ts` | K | Auth + JWT + Supabase admin client. |
| `api/_handlers/health.ts` | K | Health check. |
| `api/_handlers/settings.ts` | K | Visualizer settings persistence (but see `user_settings` orphan, §3.2). |
| `api/_handlers/oauth.ts` | D | Discord/Strava/MyNetDiary OAuth — feeds scoring + Obsession (Strava). |
| `api/_handlers/scores.ts`, `cron/recompute.ts`, `_spotify-ingestion.ts` | D | Life Scores engine + daily recompute. Recompute also pings keepalive (KEEP side-effect). |
| `api/_handlers/admin/**` (6) + `_admin.ts` (×2) | D | Admin endpoints. |

### Supabase tables → see §3.2. Dependencies → see §1.5.

---

## 3. DEPENDENCY SAFETY CHECK (nothing we KEEP may break)

### 3.1 KEEP → CUT/DECIDE edges (BLOCKERS)

**B1 — Obsession forces the `ac130-thermal` theme.** 🔴
`features/obsession/ObsessionRoutes.tsx:24` wraps all obsession routes in `<ThemeOverrideProvider id="ac130-thermal">`, and `ThemeOverrideProvider` sets `document.documentElement.dataset.theme = 'ac130-thermal'`, pulling that theme's `tokens.css`/`theme.css`.
- **If Obsession is DECIDE→keep and themes are cut:** deleting `themes/ac130-thermal/` removes the tokens Obsession renders against → Obsession loses its visual identity (falls back to new dark theme or unstyled).
- **Fix to sever:** before cutting ac130, either (a) move the specific tokens/CSS Obsession needs into `features/obsession/obsession.css` as self-contained vars, or (b) retire Obsession in the same phase. Do not delete ac130 while `ThemeOverrideProvider` still references it.

**B2 — Theme `ProfileDropdown` (KEEP chrome) reads Life-Scores + palette tables.** 🟠
All three `ProfileDropdown.tsx` read `user_score_visibility` (reveal-action toggles), `app_settings` (`allow_custom_hex`), and `accent_color_palette` (preset list), and write `user_score_visibility`. The dropdown is KEEP chrome; `user_score_visibility` is DECIDE (Life Scores).
- **Fix to sever:** the new single-theme dropdown (Phase 2/3) must drop the "reveal action" section if Life Scores is cut, and read accent options from a fixed in-code list (red/teal/purple) instead of `accent_color_palette`/`app_settings`. Because the dropdown is being rebuilt anyway, this edge is severed naturally — just don't carry the score-visibility block over.

**B3 — `NavBar` hard-codes the M/H/E/U tab model.** 🟠
Every theme's `NavBar.tsx` defines `tabs = [M,H,E,U]`. Cutting H/E and the tab split means the nav must be regenerated from the new route registry (Phase 3), not patched. Low risk (rebuild), listed for completeness.

**No KEEP→CUT edge exists** from the visualizer or Spotify code into Life Scores / Obsession / themes-to-cut, **except** the three above (all in chrome that is being rebuilt). The visualizer/Spotify stack only touches: `profiles`, `spotify_tokens`, `visualizer_presets`, `keepalive`, `avatars` bucket — all KEEP.

### 3.2 Supabase objects

**Tables (33), views (1), functions (9), bucket (1 — `avatars`).** FK note: `profiles.id → auth.users(id) ON DELETE CASCADE`; most feature tables → `profiles(id) ON DELETE CASCADE`; `spotify_tokens`/some early tables → `auth.users(id) ON DELETE CASCADE`. **`user_scores.user_id → profiles(id) ON DELETE CASCADE`** (migration `20260523000001`) — deleting a profile cascades to its scores; safe.

| Table | Read by | Written by | Verdict |
|---|---|---|---|
| `profiles` | AuthContext, ProfileContext, ThemeContext, AdminProtectedRoute, NavBar, ProfileDropdown, server (scores/auth/oauth/admin) | ProfileDropdown, ThemeContext, admin | **KEEP** (FK hub) |
| `spotify_tokens` | `services/spotify/tokenStore.ts`, server `_spotify-ingestion`, oauth | tokenStore, server | **KEEP** |
| `visualizer_presets` | server `settings`/admin `presets` | admin presets | **KEEP** |
| `keepalive` | server cron/recompute | cron | **KEEP** |
| `accent_color_palette` | ProfileDropdown, admin `PaletteTab` | admin | **DECIDE** — new accent model is 3 fixed options; table becomes optional. Safe to drop once dropdown reads a fixed list. |
| `app_settings` | ProfileDropdown (`allow_custom_hex`), server | admin | **DECIDE** — drop the custom-hex gate with the new fixed palette. |
| `users` | server `auth.ts:108` (upsert) | auth | **DECIDE** — separate from `profiles` (migration `20260509000003`); possible legacy duplication. Verify what reads it. |
| `user_settings` | server `settings.ts:20,30` (read+upsert) | settings | ⚠️ **ORPHAN REFERENCE** — no migration creates `user_settings`. Either hand-created in Supabase or a latent bug. Verify before relying on `/api/settings`. |
| `user_scores` | server scores/cron | server | **DECIDE** (Life Scores) |
| `life_score_derivatives`, `life_score_samples`, `user_position_history`, `user_listening_stats`, `score_events`, `scoring_field_weights`, `recompute_locks`, `spotify_play_history`, `leaderboard_config`, `user_score_visibility`, `tooltip_defaults`, `tooltip_overrides` | server scores/cron; `user_score_visibility` also ProfileDropdown | server / dropdown | **DECIDE** (all Life Scores). `spotify_play_history`/`user_listening_stats` written by scoring ingestion only. |
| `oauth_connections` (+ `oauth_connections_unified` view) | server oauth/admin | server | **DECIDE** (feeds scoring + Obsession Strava) |
| `audit_log` | server admin | admin | **DECIDE** (admin) |
| `obsession_*` (11 tables) | `features/obsession/lib/*`, server recompute (strava) | obsession client | **DECIDE** (hidden feature) |

**Zero KEEP references** into Life-Scores tables or Obsession tables **except** `user_score_visibility` via `ProfileDropdown` (B2) and `oauth_connections`/`obsession_strava_*` via the recompute cron. The visualizer/Spotify KEEP set depends on **none** of the DECIDE tables.

#### Proposed DROP SQL — **DO NOT RUN** (ordered for FK safety)

Only valid **after** the owner rules Life Scores + Obsession OUT and B1/B2 are severed. Drop children before parents; `CASCADE` handles dependent policies/constraints.

```sql
-- === IF Life Scores is CUT ===
-- Order: leaf/child tables first, config last.
DROP TABLE IF EXISTS public.score_events CASCADE;
DROP TABLE IF EXISTS public.life_score_derivatives CASCADE;
DROP TABLE IF EXISTS public.life_score_samples CASCADE;
DROP TABLE IF EXISTS public.user_position_history CASCADE;
DROP TABLE IF EXISTS public.user_listening_stats CASCADE;
DROP TABLE IF EXISTS public.spotify_play_history CASCADE;
DROP TABLE IF EXISTS public.user_score_visibility CASCADE;   -- sever B2 in client first
DROP TABLE IF EXISTS public.recompute_locks CASCADE;
DROP TABLE IF EXISTS public.scoring_field_weights CASCADE;
DROP TABLE IF EXISTS public.tooltip_overrides CASCADE;
DROP TABLE IF EXISTS public.tooltip_defaults CASCADE;
DROP TABLE IF EXISTS public.leaderboard_config CASCADE;
DROP TABLE IF EXISTS public.user_scores CASCADE;

-- === IF Obsession is CUT === (all cascade from profiles; drop sets before sessions)
DROP TABLE IF EXISTS public.obsession_lifts_sets CASCADE;
DROP TABLE IF EXISTS public.obsession_lifts_sessions CASCADE;
DROP TABLE IF EXISTS public.obsession_lifts_exercises CASCADE;
DROP TABLE IF EXISTS public.obsession_meditation_drafts CASCADE;
DROP TABLE IF EXISTS public.obsession_meditations CASCADE;
DROP TABLE IF EXISTS public.obsession_mynetdiary_entries CASCADE;
DROP TABLE IF EXISTS public.obsession_strava_activities CASCADE;
DROP TABLE IF EXISTS public.obsession_strava_tokens CASCADE;
DROP TABLE IF EXISTS public.obsession_training_goals CASCADE;
DROP TABLE IF EXISTS public.obsession_quote_pool CASCADE;
DROP TABLE IF EXISTS public.obsession_preferences CASCADE;

-- === IF OAuth connectors (Discord/Strava/MyNetDiary) are CUT ===
DROP VIEW  IF EXISTS public.oauth_connections_unified CASCADE;
DROP TABLE IF EXISTS public.oauth_connections CASCADE;

-- === IF accent palette is replaced by fixed in-code list ===
-- (sever ProfileDropdown reads first)
DROP TABLE IF EXISTS public.accent_color_palette CASCADE;

-- Functions tied to the above (drop only if no remaining caller):
-- public.encrypt_token / decrypt_token  (used by oauth connectors)
-- public.backfill_usernames             (one-shot migration helper)
```

**Never drop:** `profiles`, `spotify_tokens`, `visualizer_presets`, `keepalive`, `avatars` bucket, `app_settings`/`users`/`audit_log` until their DECIDE status is resolved.

### 3.3 Env vars that become unused (remove from Vercel **later**, not this session)

- `TICKETMASTER_API_KEY` — **not in code at all**; remove from Vercel if present.
- If Life Scores + OAuth connectors are cut: `DISCORD_CLIENT_ID/SECRET/REDIRECT_URI`, `STRAVA_CLIENT_ID/SECRET/REDIRECT_URI`, `MYNETDIARY_ENCRYPTION_KEY` (Strava is also Obsession — keep if Obsession stays).
- `SPOTIFY_CLIENT_ID` (server) — used only by `_spotify-ingestion` (scoring). Client uses a hard-coded `CLIENT_ID` in `services/spotify/auth.ts`. If scoring is cut, the **server** `SPOTIFY_CLIENT_ID` is unused but the client one still drives OAuth — do not remove client-side.
- Keep always: `SUPABASE_*`, `JWT_SECRET`, `CRON_SECRET`, `SUPER_ADMIN_EMAILS` (admin-dependent), `VITE_SUPABASE_*`.

---

## 4. AUDIO + SPOTIFY INVESTIGATION (findings only)

### 4.1 How the visualizer gets audio today

One `AudioContext` → one shared `AnalyserNode` (`fftSize 4096`, `smoothing 0.65`) in `features/visualizer/liveAudioRouter.ts` (`LiveAudioRouter`). Consumers: Butterchurn `connectAudio`, the gear-icon SIGNAL meter, and the waveform progress bar via `audio/audioSource.ts`.

Two capture modes in `features/visualizer/liveAudioCapture.ts`:
- **`captureMicStream(deviceId?)`** — `getUserMedia({audio})` with DSP off; if no device given, auto-selects a **BlackHole/VB-Cable** input by label regex. **This is the digital-audio-cable route the owner wants cut.**
- **`captureTabStream()`** — `getDisplayMedia({video:true,audio:true})`, drops video, keeps tab audio; throws if the user didn't check "Share tab audio". **This is the no-install replacement and already exists.**

No Web Playback SDK is used. No attempt to tap Spotify audio via Web Audio (there is no such API for DRM media).

### 4.2 Spotify integration

- **Auth:** user OAuth **PKCE** (S256), client-side. `CLIENT_ID` hard-coded in `services/spotify/auth.ts`; redirect derived from `window.location.origin + '/callback'`. CSRF `state` nonce in `sessionStorage`.
- **Scopes:** `user-read-email`, `user-read-private`, `playlist-read-private`, `playlist-read-collaborative`, `user-read-playback-state`, `user-modify-playback-state`, `user-read-currently-playing`, `user-read-recently-played`.
- **Token storage:** source of truth is Supabase `spotify_tokens` (per-user, self-only RLS), fronted by an in-memory cache (`tokenStore.ts`); one-time legacy-localStorage migration (scheduled for removal 2026-06-23).
- **Refresh + 6-month expiry:** `tokens.ts:refreshToken()` dedups concurrent refreshes; on **400 invalid_grant / 401** it calls `notifyRefreshInvalid()` → emits `refresh_invalid` → `disconnect()` deletes the row (no retry). The UI keeps the user on `/m` and shows an inline RECONNECT pill (`VisualizerPage`) + a fallback banner (`App.tsx`). **This already implements the required "discard token, no retry, route back to sign-in" behavior.**

### 4.3 No-install audio options — recommendation

- **(a) `getDisplayMedia` tab/system capture.** Already implemented for tabs. **Caveat (critical):** Chromium **mutes captured audio from tabs playing EME/Widevine-protected media** — the **Spotify Web Player tab yields silence**. Spotify *desktop app* audio is captured only via **"Entire screen" + system audio** (Chrome/Edge on **Windows**; macOS does not expose system audio through `getDisplayMedia`, which is exactly why the BlackHole route existed). I could not script-test the DRM-mute behavior here because `getDisplayMedia` requires the OS picker + a user gesture that can't be automated in this environment; the EME-mute behavior is well-established Chromium behavior and matches the existing code's "pick a TAB and share tab audio" guidance.
- **(b) Microphone fallback.** `getUserMedia` mic works on mobile/any device (ambient capture) — keep as the universal fallback; drop only the BlackHole/VB-Cable auto-select branch.
- **(c) Web Playback SDK audio cannot be tapped** — EME/Widevine routes decoded audio outside the Web Audio graph. Confirmed by architecture; no code path attempts it.

**Recommended Phase 5 design:** replace the virtual-cable branch with a capture picker — `getDisplayMedia` (tab/system) primary, `getUserMedia` mic fallback — behind a single "Audio source" control in the gear menu. Files: `features/visualizer/liveAudioCapture.ts` (drop BlackHole branch from `captureMicStream`, keep `captureTabStream`), `liveAudioRouter.ts` (unchanged API), theme `GearMenu` (source picker UI), and copy explaining the Spotify-Web-Player-DRM caveat (steer Windows users to desktop app + system audio).

---

## 5. AUTH + PROVIDER STRUCTURE

### Actual provider tree (from source — each mounted **once**)
```
main.tsx:   <StrictMode> → <AuthProvider>              (console.log '[theme-diag] AuthProvider MOUNT')
App.tsx:      <BrowserRouter> → <ProfileProvider> → <ThemeProvider>   ('[theme-diag] ThemeProvider MOUNT')
                → <ThemeErrorBoundary resetKey={themeId:resetCounter}>
                  → <ThemedApp> → theme.shell → <AppRoutes>
                    → (route) <AdminProtectedRoute>    ('[theme-diag] AdminProtectedRoute MOUNT')
```

### Root cause of the observed "AuthProvider ×3 / ThemeProvider ×4 / AdminProtectedRoute ×2"
In **source there is exactly one** of each. The multiplication is a **runtime remount artifact**, not duplicate JSX:
1. **`React.StrictMode`** (main.tsx) double-invokes mount in **dev** → ×2 immediately. (Does not apply in prod.)
2. **`ThemeErrorBoundary` `resetKey`** = `` `${themeId}:${resetCounter}` `` changes on every theme switch and every error-fallback, **remounting its entire child subtree** (`ThemedApp` → routes → `AdminProtectedRoute`). This is the vector for extra `AdminProtectedRoute` mounts and anything below the boundary.
3. **`ThemedApp` swaps `theme.shell`** on theme change — a different component type → React unmounts/remounts the subtree.
`AuthProvider` sits **above** `BrowserRouter`/`ThemeProvider`, so it cannot be remounted by theme churn; a genuine prod ×3 of `AuthProvider` would require the whole `App` to remount (not reproducible from source). The `[theme-diag]` console.logs (added in commit `50902e5`) are instrumentation to confirm this at runtime — they are **leftover diagnostics to remove** (§8).

### What disappears once the theme system is replaced
- No `theme.shell` swap, no `ThemeErrorBoundary` `resetKey` remount, no per-theme `ProfileDropdown`/`NavBar` duplication → remount vectors (2) and (3) vanish.
- The ThemeErrorBoundary / "Phase 2C" lock-out problem (a broken theme bricking the app) is moot with one hard-coded theme.
- Remove all `[theme-diag]` logs and the `blockedThemesRef`/`resetCounter`/`handleThemeError` machinery.
- Keep `AuthProvider`/`ProfileProvider`; collapse `ThemeProvider` to a thin accent-only context (or fold accent into `ProfileContext`).

---

## 6. INVESTING STORAGE

**Investing shipped after the audit's `50902e5` base.** This section documents what
was actually built (it supersedes the earlier "net-new build" recommendation).

### 6.1 What `/investing` is

SPX option-candidate comparison at `/investing` (`App.tsx:367`, **public route — no
account required**). The user enters candidates with the premium typed from the
broker; IV is **solved** from premium + spot at entry, then projected P&L is shown
across the user's scenario dates × SPX levels with a European **Black-Scholes** model
at constant IV (plus a global IV shift). Entry: `features/investing/InvestingPage.tsx`.

- **Feature code:** `src/features/investing/` (13 files) — `InvestingPage.tsx`, `investing.css`, `components/{CandidateForm,CandidateList,MarketBar,ScenarioEditor,ScenarioGrid,WhatIfChart}.tsx`, `lib/{api,format,model,model.test,types}.ts`.
- **Shared options engine:** `src/lib/options/` — `blackScholes.ts`, `rates.ts`, `scenario.ts`, `dates.ts`, `marketData.ts`, `index.ts` + `options.test.ts` / `marketData.test.ts`. Pure, reusable, with unit tests.
- **Visualizer:** `/investing` is in `STANDALONE_BG_ROUTES` (`App.tsx:39`) — it renders standalone, with no Butterchurn background behind it.

### 6.2 Storage model (built as "public, per-device, optionally linkable")

The design recommended in the pre-ship draft is essentially what landed, with one
difference: per-user data uses **direct Supabase tables** (RLS), not a single JSON
blob, and guests use localStorage as **plain JSON arrays**, not a versioned envelope.

- **Guest (not signed in, `userId === null`):** `features/investing/lib/api.ts` reads/writes `localStorage` keys **`mheu_investing_candidates`** and **`mheu_investing_scenarios`** (JSON, try/catch-wrapped, private-mode safe). IDs via `crypto.randomUUID()`.
- **Signed-in:** the same API fans out to Supabase with `auth.uid() = user_id` RLS — `option_candidates` (per-row CRUD) and `investing_scenarios` (one settings row per user, upsert `onConflict:'user_id'`). Scenario saves are debounced 600 ms (`InvestingPage.tsx:90`).
- **Store separation:** guest localStorage and account data are **separate stores** — the loader reruns on sign-in/out (`InvestingPage.tsx:73`). **There is no merge-on-login** (the draft's "newest-wins union" was not built). A guest who later signs in does **not** see their device-local candidates migrated into the account — a known gap if seamless linking is wanted later.

### 6.3 Supabase schema (`migration 20261028000001_investing_tables.sql`)

Three tables, all RLS-enabled, FK → `profiles(id) ON DELETE CASCADE`:

| Table | Rows | RLS | Written by |
|---|---|---|---|
| `option_candidates` | per-user candidates (type/strike/expiry/premium/contracts/iv_override/spot_at_entry/archived) + CHECK constraints | self-only CRUD (`auth.uid() = user_id`) | client (signed-in) |
| `investing_scenarios` | one settings row per user (`scenario_dates[]`, `scenario_levels[]`, `iv_shift`, `div_yield`), PK = `user_id` | self-only CRUD | client (signed-in) |
| `market_snapshot` | **shared** — SPX close + Treasury par-yield curve; `as_of` UNIQUE so refreshes upsert | SELECT for signed-in only; **no write policy** (service role only) | server (cron + on-demand) |

### 6.4 Market data path (no new serverless function)

`market_snapshot` is populated **server-side**, keeping the **2-function** limit intact:
- **Handler** `web/api/_handlers/market-snapshot.ts`, dispatched via `api/index.ts` `?_route=market-snapshot` (rewrite `vercel.json:10`) — **not** a 3rd function.
- **Public GET** returns the latest snapshot; refreshes on-demand if the stored row is >6 h old (anonymous traffic triggers at most one upstream fetch per 6 h). `?force=1` (refresh button) re-fetches if >60 s old. SPX via Yahoo chart API → FRED CSV fallback; Treasury curve from treasury.gov CSV; on failure the previous values carry forward and the UI lets the user type spot manually.
- **Daily cron** `?job=market-snapshot` (`_handlers/cron/market-snapshot.ts`, `vercel.json:28`) calls `refreshMarketSnapshot()` directly — a **second cron job** alongside `recompute` (both daily, within Hobby limits).
- **Client fallback:** if `/api/market-snapshot` fails, `lib/api.ts:fetchMarketSnapshot` does a direct `market_snapshot` table read (signed-in only), else prompts manual spot entry.

### 6.5 Verdict

Investing is a **KEEP — already shipped and consistent with the owner's model** (public,
device-local for guests, synced for accounts). No cut or rebuild. Open follow-ups, none
blocking: (1) no guest→account merge on login (§6.2); (2) a hard-coded `CLIENT_ID` is not
involved here, but the market handler reuses `SUPABASE_SERVICE_ROLE_KEY` server-side as
expected. The three investing tables are **KEEP** and must be added to the §3.2 table
inventory and excluded from any DROP SQL.

**Other current localStorage/sessionStorage keys (namespace reference):**
`mheu_accent_color`, `mheu_theme_id`, `mheu_time_scale`, `mheu_session` (JWT), `mheu_spotify_hydrated` (session), `code_verifier` + `spotify_oauth_state` (session, PKCE), `mheu_investing_candidates` + `mheu_investing_scenarios` (investing guest data), legacy `mheu_access_token`/`mheu_refresh_token`/`mheu_token_expiry` + `spotify_*` (migration-only). Plus viz settings (`useVizSettings`) and oscilloscope (`storage.ts`, orphan).

---

## 7. RESPONSIVE / VISUAL BREAKAGE

**Tooling:** Playwright is **not installed** (and no `audit-screenshots` are committed — dir is gitignored). Used the in-app Chromium browser against **local dev** (`localhost:5173`) and **live** (`mheu.lol`). The localhost auth-bypass skips the route gate but creates **no Supabase session**, so all data-driven views render their signed-out state and the data-rich layouts are **NOT REACHED**; those got a static CSS review.

### Reached
| Route | Viewport | Finding | Responsible file |
|---|---|---|---|
| `/login` | 375 (first paint) | **FOIT** — `Sign In` + `Continue with Spotify` button labels render invisibly until `HitmarkerText` webfont loads; after load they're fine (re-verified). Not a contrast bug (dark-on-cyan / white-on-green are high contrast). | `styles/fonts.css` (`@font-face` lacks `font-display: swap`); affects every `HitmarkerText` surface on cold load. |
| `/login`, `/signup` | 375 / desktop | Card otherwise fine (`maxWidth:400`, centered). | `pages/Login.tsx:47` |
| `/u` (signed-out) | 375 / desktop | Nav + "Sign in to compete" card render cleanly; tabs evenly spaced, no overflow. | `UserCompetitionTab.tsx:289` |
| `/` live `mheu.lol` | desktop | Redirects to `/login`; up. | — |

### NOT REACHED (need a real session / admin) → static review
| Route | Static-review risk | File |
|---|---|---|
| `/u` leaderboard + 5-score grid | `gridTemplateColumns: repeat(5, 1fr)` with `fontSize 24px` values → on 375 each cell ≈ 68px; derivative z-scores like `+0.00` fit but prestige glow + `jerk/snap` labels may clip. `table-layout: fixed` with a 100px POSITION col on a ~343px body is tight. | `UserCompetitionTab.tsx:478` (grid), `:394` (table) |
| ProfileDropdown | Desktop variant is `width:360px` fixed; on a 320–360px phone it switches to full-width at `<600px` (`isMobile`), OK. Long `profiles.username`/email rely on `ellipsis` (present). | `themes/frutiger-aero/components/ProfileDropdown.tsx:226` |
| `/m` visualizer HUD | Bottom-left now-playing card (`maxWidth:200`) + bottom-right fullscreen + gear top-right at fixed offsets; on 375 the now-playing card + controls can overlap the waveform bar. | `VisualizerPage.tsx:214,274,312` |
| `/admin` dashboard | Admin tables (`components/admin/AdminTable.tsx`) — tabular admin UI rarely responsive; static risk of horizontal overflow on phones. | `components/admin/*` |
| `/obsession/*` | Has its own `obsession.css` with **`height:100vh`** (`:18`) — the classic mobile 100vh / browser-chrome bug; one media query at `max-width:720px`. | `features/obsession/obsession.css:18,531` |

### Global CSS hazards (static)
- `features/obsession/obsession.css:18` — `height: 100vh` (use `100dvh` on mobile).
- `components/MHEUShell.css:76` — `min-width:120px`; `:183` `max-width:300px` (check on 320px).
- `styles/global.css:106` + `obsession.css:201` — `white-space:nowrap` (clip risk on narrow).
- Only 3 `@media` queries in the whole app (`obsession.css:531`, `asian-vibrant/theme.css:323`, plus reduced-motion) → **the app is essentially non-responsive by media query**; it leans on fl/clamp. New shell should add real breakpoints.

---

## 8. BLOAT

### Build (`npm run build`, exit 0, vite 5.4.21)
- **Single JS chunk: `index-*.js` = 3,760 KB raw / 762 KB gzip.** CSS: `index-*.css` = 36.5 KB / 7.55 KB gzip. `index.html` 0.41 KB.
- **No code-splitting, no lazy routes** — `App.tsx` statically imports Admin, Obsession, all themes, recharts-free but butterchurn-heavy code into one bundle. Vite warns (>500 KB).
- **Dynamic/static import conflict defeats splitting:** `LoadingScreen.tsx` dynamically imports `lib/supabase.ts`, but 20 other modules static-import it → Vite keeps it in the main chunk (warning in build log).
- **Biggest contributors:** `butterchurn` + `butterchurn-presets` (Milkdrop preset packs — the dominant weight), then react/react-dom, `@supabase/supabase-js`, `react-router-dom`, `qrcode.react`.

### Unused deps (`depcheck` + `knip` + manual grep agree)
- **`recharts` + `@types/recharts` — zero imports. Remove both** (`npm rm recharts @types/recharts`). Not in the bundle (tree-shaken), but dead in `package.json`/lockfile.
- (knip also flagged `jsonwebtoken`/`@types/jsonwebtoken`/`@vercel/node` — **false positives**: used server-side; knip wasn't configured with the Vercel `api/` entrypoints.)

### Unused files / orphans (`knip`, non-archive)
`src/audio/AudioWSClient.ts`, `src/ui/Panel.tsx`, `src/features/oscilloscope/{OsciPanel,ScopeCanvas,storage,types}.ts(x)`, `src/scoring/connectors/{applehealth,discord,mynetdiary,spotify,index,types}.ts` (client copies superseded by server ingestion — verify, then delete per Archive Policy).

### Unused exports (knip, selected)
`accentColor.ts:hexToRgb`, `engine.ts:{formatDerivative,getPrestigeClass,CONSTANTS}`, `session.ts:fetchUserProfile`, `eventCopy.ts:hashId`, `adminApi.ts:adminApi`, `audio/audioSource.ts:getAudioSnapshot`, each `NavBar.tsx:tabs`, `BrushIcons.tsx:{GearBloom,FullscreenBrush}`, obsession lib exports (`deleteDraft`, `deleteSet`, `parseCsv`, `mapMndRows`, `PREFERENCE_DEFAULTS`).

### Leftover diagnostics
- **`[theme-diag]` instrumentation (commit `50902e5`)** — `console.log('[theme-diag] … MOUNT')` in `AuthContext.tsx:24`, `ThemeContext.tsx:47`, `AdminProtectedRoute.tsx:18`, and `ThemeErrorBoundary.tsx:53` (CATCH). Remove.
- ~24 `console.log/warn/info` lines across `src` (many are legit `console.warn` error paths; audit the `[theme-diag]` + any stray `console.log` specifically).
- No `throw-theme` test hooks found in current tree.

### Orphaned markdown / stale docs
- **`web/REFACTOR_AUDIT.md` + `web/REFACTOR_PLAN.md`** (2026-05-09) — superseded by this audit; stale, delete or archive.
- **`web/supabase-schema.sql`** (558 B stub) — predates the migrations; stale vs `supabase/migrations/`.
- `web/public/manifesto.md` — served publicly; confirm it's linked, else orphan.
- `web/public/reference/` — 5 theme reference images (AC130, bird, dragon, pink) → **CUT with the themes**.
- `web/docs/` — 9 docs (several scoring/oauth/security) → re-evaluate relevance after CUT decisions.

### Duplicated code / types (web/api ↔ client)
- Two `_admin.ts` admin-client helpers (documented footgun) — `api/_admin.ts` vs `api/admin/_admin.ts`.
- Scoring types/logic exist both client (`src/scoring/*`) and server (`api/_spotify-ingestion.ts`, `_handlers/scores.ts`) — the client `scoring/connectors/*` are the orphan duplicates.
- Spotify `CLIENT_ID` duplicated: hard-coded client (`services/spotify/auth.ts`) vs server env `SPOTIFY_CLIENT_ID`.

---

## 9. L3HARRIS RED

**Confirmed from the live site** (`l3harris.com`, computed styles across the DOM): dominant brand red is **`#FF000A`** (49 element hits; minor anti-aliased variant `#F0000A`, 2). The site exposes **no** `--*red*` CSS custom properties. The third-party candidate **`#ED1C24` is NOT used.** → **Use `#FF000A`** as the L3Harris red.

**Existing accent hexes (from code):** teal (default) **`#00dcc8`** (`styles/tokens.css:8`, `rgba(0,220,200,*)`); purple **`#a855f7`** (accent palette preset, `ProfileDropdown.tsx:49`).

### Proposed token scales (dark-mode only)

```css
:root {
  /* L3Harris red (default accent) — base 500 = #FF000A */
  --red-50:  #fff1f1;
  --red-100: #ffd7d9;
  --red-200: #ffa8ad;
  --red-300: #ff6b73;
  --red-400: #ff3842;
  --red-500: #ff000a;  /* brand */
  --red-600: #d60009;
  --red-700: #a80007;
  --red-800: #7a0005;
  --red-900: #4d0003;

  /* Teal (keep) — base 500 = #00dcc8 */
  --teal-50:  #e6fffb;
  --teal-100: #b8fff5;
  --teal-200: #7cf7e8;
  --teal-300: #3aeedd;
  --teal-400: #11e4d2;
  --teal-500: #00dcc8;  /* current */
  --teal-600: #00b3a3;
  --teal-700: #008a7e;
  --teal-800: #006159;
  --teal-900: #003b36;

  /* Purple (keep) — base 500 = #a855f7 */
  --purple-50:  #faf5ff;
  --purple-100: #f0e2ff;
  --purple-200: #e0c4ff;
  --purple-300: #c99bfb;
  --purple-400: #b877f9;
  --purple-500: #a855f7;  /* current */
  --purple-600: #8b3fd6;
  --purple-700: #6d2eab;
  --purple-800: #4f2080;
  --purple-900: #331456;

  /* Dark surfaces/background/border/text (dark-mode only) */
  --bg:          #050507;   /* page (near-black, from current --color-bg #010103, lifted) */
  --surface-1:   #0d0f12;   /* cards */
  --surface-2:   #16191d;   /* raised */
  --border:      rgba(255,255,255,0.10);
  --border-strong: rgba(255,255,255,0.18);
  --text:        #f2f4f6;
  --text-muted:  rgba(242,244,246,0.64);
  --text-faint:  rgba(242,244,246,0.40);

  /* Accent wiring — default red; per-user override (red|teal|purple) sets these three */
  --accent:        var(--red-500);
  --accent-weak:   color-mix(in srgb, var(--accent) 12%, transparent);
  --accent-border: color-mix(in srgb, var(--accent) 40%, transparent);
}
```

The per-user toggle writes `profiles.accent_color` to one of `#FF000A` / `#00dcc8` / `#a855f7` and `accentColor.ts` paints `--accent*`. Logged-out default = `#FF000A`. (Shades above are perceptually-even ramps; tune 600–900 against surfaces if contrast needs it.)

---

## 10. PHASE PLAN

Target folder structure (Phase 3):
```
src/app/routes.ts          # route registry: {path,title,icon,requiresAuth,element/lazy}
src/app/Shell.tsx          # nav + landing generated from registry
src/pages/<name>/          # one folder per page (index.tsx + local parts)
src/theme/tokens.css       # single dark theme (red default + teal/purple accents)
src/theme/accent.ts        # 3-option accent toggle → profiles.accent_color
```

### Phase 1 — Cuts (1 session; low risk, do NOT run DROP SQL)
- **Delete orphans:** `features/oscilloscope/*`, `audio/AudioWSClient.ts`, `ui/Panel.tsx`, `scoring/connectors/*` (verify unused first).
- **Delete placeholder tabs:** `components/tabs/HealthTab.tsx`, `EntertainmentTab.tsx`; remove `/h` `/e` routes + each theme's `HTabPlaceholder`/`ETabPlaceholder`.
- **Remove diagnostics:** all `[theme-diag]` logs (`AuthContext`, `ThemeContext`, `AdminProtectedRoute`, `ThemeErrorBoundary`).
- **Remove dead dep:** `recharts` + `@types/recharts`.
- **Remove stale docs:** `web/REFACTOR_AUDIT.md`, `web/REFACTOR_PLAN.md`, `web/supabase-schema.sql`; drop `/visualizer` rewrite from `vercel.json`.
- Risk: none touches visualizer/Spotify. Confirm build after.

### Phase 2 — Single dark theme + accent toggle (1–2 sessions)
- New `src/theme/tokens.css` (§9); delete `themes/registry.ts`, `ThemeContext`'s multi-theme machinery, `ThemeErrorBoundary`, `themes/asian-vibrant/*`.
- **Keep `ac130-thermal/*` tokens only until B1 is severed** — fold the tokens Obsession needs into `obsession.css`, then delete ac130.
- Collapse `ThemeProvider` → accent-only (or fold into `ProfileContext`). Harvest `frutiger-aero` NavBar/DashboardShell/ProfileDropdown into the single theme; **drop the score-visibility block** from the dropdown (severs B2); accent picker reads a fixed `[red,teal,purple]` list (no `accent_color_palette`/`app_settings`).
- Logged-out default accent = `#FF000A`.
- **Split flag:** touches themes + context + all surfaces (>5 files, separate concern from Phase 3) → its own session.

### Phase 3 — Modular shell + route registry + landing + new auth gating (2 sessions)
- Build `src/app/routes.ts` + registry-driven nav/landing tiles.
- New access model: public landing; **Investing public** (already shipped — §6); **Visualizer + Spotify require login**. Remove the Spotify-link route gate that bounces users off `/m`.
- **Investing** (`/investing`) is **already built and public** (§0, §6) — fold its route/tile into the new registry and landing; no rebuild. (The rest of §10 still reads against `50902e5`; the investing files are not otherwise accounted for in Phases 1–5.)
- **Split flag:** registry + landing + auth-gate rewrite = multiple domains → shell/registry first, then landing/gating.

### Phase 4 — Responsive pass (1 session)
- Real breakpoints (app has ~3 media queries total). Fix: `/u` 5-score grid + fixed table (§7), visualizer HUD overlap on 375, `100vh`→`100dvh` in `obsession.css`, `font-display: swap` in `fonts.css` (kills the login FOIT).

### Phase 5 — Audio capture rework (1 session)
- Drop BlackHole/VB-Cable branch from `captureMicStream`; keep `captureTabStream`; add gear-menu source picker (tab/system vs mic) with the Spotify-Web-Player-DRM caveat copy (§4.3). `liveAudioRouter.ts` API unchanged.

### DECIDE items (owner must rule before DROP SQL / env cleanup)
1. **Life Scores / `user_scores` + leaderboard + feed + scoring cron + 13 tables** — keep or cut? (`/u`, `UserCompetitionTab`, `features/feed/*`, `scoring/*`, `api/_handlers/scores.ts`, `cron/recompute.ts`.)
2. **Admin dashboard** (`AdminDashboard`, `AdminProtectedRoute`, 14 admin components, 6 admin endpoints, `audit_log`). Note: `PresetsTab` is the only admin surface the visualizer uses.
3. **Obsession** (hidden; 11 tables; **B1 ac130 dependency**) — keep (and sever B1) or retire?
4. **`/videos`** — no code exists; build or drop the idea.
5. **OAuth connectors** (Discord/Strava/MyNetDiary) — only matter if Life Scores and/or Obsession stay.
6. **`users` table** (separate from `profiles`) and **`user_settings`** (referenced by `settings.ts`, **no migration creates it**) — verify/clean.

---

*End of Phase 0 audit. No source modified; no Vercel/Supabase changes made; DROP SQL not run.*

---

## Reconciled findings (2026-11-03)

Sources compared: **v1** = this file (2026-10-31, base `50902e5` + investing update),
**v2** = `AUDIT-2026-11-03.md` (re-run with unslop). Each disagreement was re-checked
against `main` @ `0463a53` and, where noted, against prod with the **public anon key**
(read-only; RLS applies). Owner decisions dated 2026-11-03 override both audits.

### Agreed (v1 = v2, re-verified)
- 2 serverless functions; routes; env var list; `recharts` + `@types/recharts` unused (Investing's chart is hand-written SVG).
- Orphans with zero importers: `features/oscilloscope/*`, `audio/AudioWSClient.ts`, `ui/Panel.tsx`.
- `[theme-diag]` logs in `AuthContext.tsx:24`, `ThemeContext.tsx:47`, `AdminProtectedRoute.tsx:18`, `ThemeErrorBoundary.tsx:54`.
- Stale `web/REFACTOR_AUDIT.md`, `web/REFACTOR_PLAN.md`, `web/supabase-schema.sql`; dead `/visualizer` rewrite.
- B1 (Obsession → ac130 theme), B2 (ProfileDropdown → `user_score_visibility`), B3 (NavBar M/H/E/U).
- `user_settings` is referenced by `api/_handlers/settings.ts` and created by no migration.

### Disagreements, and which audit was right
| # | Topic | v1 | v2 | Verified on `main` / prod | Right |
|---|---|---|---|---|---|
| D1 | `throw-theme` test hook | none | exists | `components/admin/LifeScoresTab.tsx:27-30` throws on `?debug=throw-theme` | **v2** |
| D2 | Login FOIT cause | `font-display: swap` missing | `font-display: block` set | `styles/fonts.css:7,15,23,31` = `block` | **v2** |
| D3 | `@media` count | 3 | 5 | 5 CSS queries + 19 JS width checks | **v2** |
| D4 | Investing migration | (memory: pending) | applied | `/api/market-snapshot` 200 with data; `option_candidates`/`investing_scenarios`/`market_snapshot` exist | **v2** |
| D5 | `scoring/connectors/*` "orphan client copies" | orphan | orphan | **Neither.** Imported by `api/_handlers/cron/recompute.ts:28`; knip had no `api/` entry point. Moot: cut with Life Scores. | **neither** |
| D6 | Strava | "feeds scoring + Obsession"; "obsession_strava_* via the recompute cron" | (carried v1) | Strava OAuth (`_handlers/oauth.ts` `handleStrava*`) writes **only** `obsession_strava_tokens`/`_activities` and redirects to `/obsession/training`. `recompute.ts` never touches Strava. **Strava is Obsession-only.** | **neither** |
| D7 | Keepalive | "recompute also pings keepalive" | (carried) | True: `pingKeepalive()` runs first in `recompute.ts`. The memory doc's **client-side** ping (`src/lib/keepalive.ts`) no longer exists (removed in `612898e`). Prod `keepalive`: last ping 2026-11-03 00:01 UTC, count 316. | **v1**, memory doc out of date |
| D8 | `users` table | "verify what reads it" | (carried) | Written on **every Spotify login**: `App.tsx:210` → `postSessionAuth` → `_handlers/auth.ts:108`. Surviving Spotify code uses it, so it **cannot be dropped**. 🔴 **New: the table is readable with the public anon key and returns spotify_id, display_name and email.** | new finding |
| D9 | `user_settings` | latent bug | (carried) | **Exists in prod** (anon read → 200 `[]`). The sync that uses it is broken in **both** directions: the POST sends the blob but `settings.ts:30` reads `req.body.settings`, so it upserts `null`. GET returns `{settings}` but `useVizSettings.ts:97` reads top-level keys, so nothing is applied. localStorage is the real store. | new finding |
| D10 | `market-snapshot` cron | — | weekdays `30 21 * * 1-5` | `vercel.json` confirms. CLAUDE.md doesn't list it. | **v2** |
| D11 | `audit_log` | DECIDE | DECIDE | The kept admin **users** handler writes it (`_handlers/admin/users.ts:26,57,127,155`). **Keep.** | resolved |

### Owner decisions vs the audits (owner wins)
- **Strava (owner: CUT) vs Obsession (owner: KEEP, untouched).** Per D6, cutting Strava would break Obsession Training. **Strava routes and `STRAVA_*` env vars are KEPT.** Only Discord, the MyNetDiary API-key connector, `oauth_connections` actions and the unused Spotify-connect action are cut. Obsession's MyNetDiary feature is a CSV import (`obsession_mynetdiary_entries`), separate from `MYNETDIARY_ENCRYPTION_KEY`.
- **`web/public/audio-setup.md`, `web/public/E-roadmap.md`:** **already gone** (`public/` = `fonts/`, `manifesto.md`, `reference/`). Skipped.
- **`.env.example`:** **doesn't exist.** Phase 1C creates one.
- **Admin palette tab:** cut (the admin is slimmed to users + presets). The `accent_color_palette` and `app_settings` tables **stay**, because all three ProfileDropdowns still read them and the themes are untouched.

### New findings (in neither audit)
- 🔴 **N1 PII exposure:** `public.users` returns email/display_name/spotify_id to the anon key. `user_scores`, `score_events`, `user_position_history`, `recompute_locks` and `tooltip_defaults` are also anon-readable (they're dropped in 1C).
- **N2:** With only the public anon key, **rows can't be backed up** (RLS hides most of them), and the container has **no** Supabase service key, DB URL, Vercel token or `.vercel` link. This blocks the 1C backups/apply and `vercel env rm`.

### Phase 1 status before this session (Step 2)
Checked `git log`, the code and the live site:
- **1A not done.** Keepalive is still inside `recompute`. Life Scores code, routes, admin tabs and endpoints are all present.
- **1B not done.**
  - `/h` and `/e` are still routed.
  - `captureMicStream`'s BlackHole/VB-Cable branch is still there.
  - Orphans, `recharts` and the stale docs are still present.
  - Already done: the two `public/*.md` files are gone.
- **1C not done.** No drop migration exists. The Life Scores tables are live in prod.

---

## Phase 1 complete (2026-11-03): code done and live; 1C database steps STOPPED (unapplied)

All code changes are on `main` and live on mheu.lol. Pushes to `main` auto-deploy
through the Vercel GitHub integration on the existing project; a new bundle hash
appeared 45–60s after each push. `npx vercel --prod` was **not** run: the cloud
container has no Vercel token and no `.vercel` link, and creating a link was off-limits.

### Commits
| Phase | Commit | What |
|---|---|---|
| Step 1 | `bc2a4f9` | docs: reconcile audits |
| 1A | `2eed2ea` | standalone daily keepalive cron job |
| 1A | `3433c1e` | remove Life Scores (incl. Discord/MyNetDiary connectors; Strava kept for Obsession) |
| 1A | `67c224b` | admin slimmed to users + passwords + presets, behind `features/admin/sections.ts` |
| 1B | `24d5ecd` | remove `/h` `/e` placeholders + H/E nav tabs |
| 1B | `7f587d4` | drop BlackHole/VB-Cable route; tab/screen share primary, mic fallback |
| 1B | `ffe9ff2` | orphans, `recharts`, stale docs, `/visualizer` rewrite, `[theme-diag]` logs |
| 1C | `65426c2` | remove the broken `/api/settings` sync (`user_settings` usage) |
| 1C | `82f2784` | `/api/auth` writes `public.users` with the service role (security, see N1) |
| 1C | `9354aed` | **unapplied** drop migration + users lockdown migration; `backups/` ignored |

### Keepalive
- Was `pingKeepalive()` inside the Life Scores recompute job.
- Now its own job: `/api/cron?job=keepalive`, `0 0 * * *`. It does a head-only count on `profiles` plus the `keepalive` heartbeat write, and returns 500 on failure.
- `market-snapshot` cron unchanged. Still 2 functions.
- Before the switch, the prod row read `last_pinged_at 2026-11-03 00:01 UTC, ping_count 316`. A follow-up check is scheduled for 2026-11-04 00:15 UTC.
- Calling the cron path without `CRON_SECRET` correctly returns 401. A 200 couldn't be shown because the secret isn't available here.
- **Confirmed 2026-11-04 01:10 UTC:** the standalone job ran on schedule. The prod row now reads `last_pinged_at 2026-11-04 00:21:14 UTC, ping_count 317` (was 316). Hobby fires daily crons anywhere in the hour, so 00:21 is normal.

### 1C status: STOPPED before anything destructive
Stop conditions hit:
- **(a) Backups impossible.** Only the public anon key is available, and RLS hides rows (e.g. `life_score_derivatives`, `leaderboard_config`, `user_score_visibility`, `tooltip_overrides`, `oauth_connections` all return 401). The export failed.
- **(b) No automated apply method.** No service key, DB URL or Supabase CLI auth.
- **(c) Ambiguity.** Prod has drifted from migrations before (`20260523000001`), so prod FKs couldn't be confirmed.

**Nothing was dropped. No backups exist yet.**

**Drop list** (`web/supabase/migrations/20261103000001_drop_cut_features.sql`, single transaction, `IF EXISTS`, `RESTRICT`):
- Views: `oauth_connections_unified`.
- Life Scores tables:
  - `score_events`, `life_score_derivatives`, `life_score_samples`
  - `user_position_history`, `user_listening_stats`, `spotify_play_history`
  - `recompute_locks`, `user_score_visibility`, `scoring_field_weights`
  - `leaderboard_config`, `tooltip_overrides`, `tooltip_defaults`, `user_scores`
- Connector tables and functions: `oauth_connections`, `encrypt_token(text,text)`, `decrypt_token(bytea,text)`.
- Settings: `user_settings`.

No `profiles` columns were Life-Scores-only; the score columns live on `user_scores`.

**Pulled from the drop list:**
- `users`: written on every Spotify sign-in. Locked down instead (`20261103000002`).
- `audit_log`: the admin users handler writes it.
- `app_settings`, `accent_color_palette`: all three ProfileDropdowns read them.
- `update_updated_at()`: a generic trigger function that prod may use elsewhere.
- All `obsession_*` tables, the investing tables, `keepalive`, `profiles`, `spotify_tokens`, `visualizer_presets`.

**`user_settings`:** it exists in prod (anon read → 200 `[]`). The only code using it was the `/api/settings` sync, which was broken in both directions, so the usage was removed (`65426c2`) and the table added to the drop list. No CREATE migration was written.

**To finish 1C (owner, with DB access):**
1. Run the `pg_dump` in the migration header into `backups/db-20261103/` and write the row-count manifest.
2. Apply `20261103000002_lock_down_users.sql`. It's urgent and safe now, since `82f2784` is live.
3. Apply `20261103000001_drop_cut_features.sql`.
4. Run the verification queries at the bottom of each file.

### Env vars
- **Zero references now:**
  - `TICKETMASTER_API_KEY`
  - `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`
  - `MYNETDIARY_ENCRYPTION_KEY`
  - `SPOTIFY_CLIENT_ID` (server; the client keeps its hard-coded ID)
- **Not removed:** `vercel env rm` needs a Vercel token. Remove each from every environment by hand.
- **Kept:**
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - `JWT_SECRET`, `CRON_SECRET`, `SUPER_ADMIN_EMAILS`, `VERCEL_URL`
  - `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI`
  - Client: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPER_ADMIN_EMAILS`
- **Found:** live `/api/oauth?provider=strava` returns `500 Strava OAuth not configured`, the same check as before this session. **`STRAVA_CLIENT_ID` is not set in prod**, so Obsession's Strava connect has never worked live.
- `.env.example` **was not created**: `.claude/settings.json` denies writes to `.env*` in the repo root and `web/`.

### Bundle
`index-*.js` **3,690 KB / 742 KB gzip** (baseline 3,760 / 762), with admin sections now in
separate lazy chunks (~23 KB). CSS 44.4 KB. Tests 43/43; 21 scoring-engine tests were
removed with the engine.

### Smoke test (Playwright, final run 42/42)
- **Pages:** live `/`, `/login`, `/m`, `/investing` all 200 with no console errors.
- **Removed routes:** `/u`, `/h`, `/e` redirect; locally they hit the catch-all.
- **Kept APIs:**
  - `/api/health`, `/api/market-snapshot`, `/api/admin/presets`: 200
  - `/api/admin/users`: 401 without auth
  - `POST /api/auth` with a bad token: 401 (the service client initialises)
- **Removed APIs** (`/api/settings`, `/api/scores`, `/api/admin/{scoring,leaderboard,tooltips,oauth}`): serve the SPA fallback, no JSON handler.
- **Cron paths:** 401 without the secret.
- **Local checks** (placeholder env, stubbed Supabase):
  - typing "obsession" opens and renders Obsession
  - the `/m` gear menu offers "Share tab / screen" first and "Microphone" second, with no cable option
- **Not testable here:** signed-in admin sections against prod data, Obsession prod data loading, Vercel function logs (no token).

---

## Refactor complete (2026-11-03) — code finished; database + Vercel CLI steps pending owner

One-session run of Parts 0–6. All code is on `main` and live on mheu.lol
(pushes auto-deploy through the Vercel GitHub integration). **Blocked in this
session:** the Supabase MCP was not authenticated and the Vercel CLI was not
logged in, so every database change below is written but **NOT APPLIED**, no
env vars were removed, and `vercel logs` / `get_logs` / `get_advisors` / cron
200 checks could not run. The owner chose to continue code-only and finish the
DB steps manually.

### What changed
- **Theme:** one dark token system (`styles/tokens.css`); brand red `#FF000A`
  default; per-user accent red / teal / purple via `<html data-accent>`, painted
  before React mounts; IBM Plex Sans + HitmarkerText with `font-display: swap`
  and metric-matched fallbacks (fixes the login FOIT). Three-theme system,
  `ThemeContext`, `ThemeErrorBoundary`, `ThemeOverrideProvider`, `src/archive/`
  and theme reference images deleted.
- **Architecture:** route registry `app/routes.ts` drives router, nav, landing
  tiles, gating and titles; one shell (`app/shell/`); new public landing page;
  every route lazy. `/admin/login` → shared `/login?next=/admin`.
- **Investing:** red system that flips to neon green `#00FF5E` while the
  what-if point is a gain; guest → account merge on sign-in (8 unit tests);
  chart sized by ResizeObserver.
- **Visualizer:** HUD in one grid (no overlap at 375px), full-height settings
  drawer, sliders wrap; audio source picker (share tab/screen where supported,
  mic everywhere and default on phones; remembered per device; clear errors).
  Invalid Spotify refresh → token row deleted → `/m` routes to Spotify sign-in,
  no retry.
- **Obsession:** self-contained red HUD tokens, always red, visible bird focus
  ring, own chunk with a neutral file name (`h-*.js`). Strava UI removed.
- **Strava:** removed entirely (OAuth handler, `/api/oauth` rewrite, Training
  connect/sync/feed, source-conflict preference).
- **Cleanup:** knip + depcheck clean; 47 unused exports, 9 dead functions, the
  expired localStorage token shim and the duplicate `api/admin/_admin.ts`
  helper removed; market snapshot type shared between API and client.

### Bundle
| | Before | After |
|---|---|---|
| Main JS (`index-*.js`) | 3,760 KB / 762 KB gz (everything) | **414.6 KB / 121.4 KB gz** |
| Initial JS for `/` | 762 KB gz | **≈122 KB gz** (main + landing 0.8 KB) |
| Visualizer (`/m` only) | in main | 2,414 KB / 442 KB gz + presets 645 KB / 122 KB gz |
| Investing | in main | 36.5 KB / 12.0 KB gz |
| Obsession (`h-*.js`) | in main | 38.5 KB / 10.8 KB gz |
| Spotify link page (QR) | in main | 18.8 KB / 7.3 KB gz |
| Admin (page + 3 sections + toolbar) | in main | 2.0 + 4.3 + 5.9 + 7.8 + 5.4 KB |
| Login / Signup / Landing / Callback | in main | 1.8 / 3.1 / 1.7 / 0.8 KB |
| CSS main | 36.5 KB | 20.5 KB (+ per-route CSS chunks) |

### Provider mounts
| | Before (source / observed) | After |
|---|---|---|
| AuthProvider | 1 / ×3 observed | **1** (`App.tsx`), 1 definition in bundle |
| ProfileProvider | 1 | **1** |
| ThemeProvider + ThemeErrorBoundary | 1 / ×4 observed (resetKey remounts) | **0** (removed) |
| AdminProtectedRoute | 1 / ×2 observed | **0** — `/admin` gated once by the registry `Gate` |
The remount vectors (theme `shell` swap, boundary `resetKey`) no longer exist.
Production bundle: no `useTheme`, no `[theme-diag]`.

### Database — written, NOT APPLIED (owner to run via MCP)
1. `20261103000002_lock_down_users.sql` — owner reports already applied via the
   SQL editor; still to verify (0 policies, RLS on, anon GET `[]`), record with
   `apply_migration`, mark header APPLIED.
2. `20261103000001_drop_cut_features.sql` — Life Scores tables, `oauth_connections`
   (+ view, encrypt/decrypt fns), `user_settings`, **plus Strava:**
   `obsession_strava_tokens`, `obsession_strava_activities`,
   `obsession_preferences.source_preference_conflicts`. Before applying: query
   `pg_catalog` for dependents and any other `%strava%` objects; back up to
   `backups/db-20261103/` with a manifest; apply in one transaction (RESTRICT);
   run the verify queries; `get_advisors`.
3. `20261103000003_accent_enum.sql` — hex → `red|teal|purple` (`#a855f7` →
   purple, everything else → red), default `red` + CHECK; drops
   `profiles.theme_id`, `accent_color_palette`, and `app_settings` (only if
   empty after deleting `allow_custom_hex`). The client already reads both
   shapes, so it is safe to apply any time.
No backups exist yet; nothing was dropped.

### Env vars — NOT removed (Vercel CLI not logged in)
Zero code references, remove from every environment:
`TICKETMASTER_API_KEY`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`,
`DISCORD_REDIRECT_URI`, `MYNETDIARY_ENCRYPTION_KEY`, server `SPOTIFY_CLIENT_ID`,
`STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI`.

### Contrast (WCAG 2.1, script-checked)
| Foreground | surface-0 | surface-1 | surface-2 | surface-3 | AA |
|---|---|---|---|---|---|
| `--text-primary` #eef0f3 | 17.73 | 17.02 | 16.01 | 14.64 | pass |
| `--text-secondary` #a9aeb7 | 9.09 | 8.72 | 8.20 | 7.50 | pass |
| `--text-muted` #858a94 | 5.84 | 5.61 | 5.27 | 4.82 | pass |
| `--danger` #ff5c5c | 6.69 | 6.42 | 6.04 | 5.52 | pass |
| `--warning` #f5b544 | 11.16 | 10.71 | 10.07 | 9.21 | pass |
| `--success` #3ddc84 | 11.35 | 10.89 | 10.24 | 9.37 | pass |
| `--accent-text` red #ff3842 | 5.68 | 5.46 | 5.13 | 4.69 | pass |
| `--accent-text` teal #00dcc8 | 11.64 | 11.17 | 10.51 | 9.61 | pass |
| `--accent-text` purple #b877f9 | 6.79 | 6.52 | 6.13 | 5.61 | pass |
| `--accent-text` green #00ff5e | 14.91 | 14.31 | 13.46 | 12.31 | pass |

| Fill | `--accent-fill` / `--accent-on-fill` | Ratio |
|---|---|---|
| red | #d60009 / #ffffff | 5.44 pass |
| teal | #00dcc8 / #060608 | 11.64 pass |
| purple | #8b3fd6 / #ffffff | 5.56 pass |
| green | #00ff5e / #060608 | 14.91 pass |
White on raw `#FF000A` is 4.00 (fails AA normal text) — hence `--red-600` fills.

**Color literal sweep** (hex/rgb/hsl in `.ts/.tsx/.css` outside `tokens.css`):
before 467 (≈140 outside the theme folders) → after **2** (the QR code's
light/dark pair, kept fixed for camera contrast). `index.html` keeps one
`theme-color` meta.

### test:responsive
Signed out: **pass** — 7 routes (`/`, `/m`, `/investing`, `/admin`,
`/obsession`, `/login`, `/signup`) × 9 widths, no page overflow, no clipped
controls. Signed in: **skipped** — needs `SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY` (not available this session).

### Known remaining issues
- All DB steps and env-var removal above (owner).
- Signed-in surfaces (admin tables, visualizer HUD with a live Spotify link,
  Obsession pages, accent sync to the profile, guest→account merge against
  prod) are verified by build/unit tests and code review only, not end-to-end.
- Cron 200 checks, `vercel logs`, Supabase `get_logs` / `get_advisors` not run.
- The Visualizer chunk is still large (Butterchurn + preset packs); it loads
  only on `/m`.
