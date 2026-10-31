# MHEU / Visual — Full Codebase Audit (Phase 0)

**Date:** 2026-10-31
**Branch:** `main` (read-only session; no source changed)
**Scope:** `web/` (active product). `legacy/desktop/` is retired and excluded except where noted.
**Live:** https://mheu.lol (Vercel project `project-iwmob`) — confirmed up, redirects to `/login`.

> **Verification note.** Every item below was checked against the current tree,
> not against prior memory. Several owner-supplied assumptions did **not** match
> the code — see the ⚠️ callouts (most important: `/investing` does not exist, and
> the E-tab "Scene" work was never built). Line numbers are as of this commit.

---

## 0. Headline reality-checks (read first)

| Owner assumption | Reality in code | Impact |
|---|---|---|
| Investing page `/investing` (SPX option comparison) = **KEEP** | **No route, no component, no code.** Not in `App.tsx`, no `Investing*` file, no SPX/option logic. | Investing is **net-new build**, not a keep. Section 6 + Phase 3. |
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

**There is no Investing code today** (no route, component, or storage). This section is a recommendation for the net-new build.

**Current localStorage/sessionStorage keys in the app (for namespace consistency):**
`mheu_accent_color`, `mheu_theme_id`, `mheu_time_scale`, `mheu_session` (JWT), `mheu_spotify_hydrated` (session), `code_verifier` + `spotify_oauth_state` (session, PKCE), legacy `mheu_access_token`/`mheu_refresh_token`/`mheu_token_expiry` + `spotify_*` (migration-only). Plus viz settings (`useVizSettings`) and oscilloscope (`storage.ts`, orphan).

**Recommendation for Investing (public, per-device, optionally linkable):**
- Key: `mheu_investing_v1` (versioned JSON blob) in `localStorage`, wrapped in try/catch (private-mode safe, matches existing pattern).
- Shape: `{ version: 1, comparisons: [{ id, createdAt, underlying:'SPX', legs:[...], notes }], prefs:{...} }`.
- **Account-linking later:** add table `public.investing_saves (user_id uuid refs profiles(id) on delete cascade, payload jsonb, updated_at timestamptz, primary key(user_id))` with self-only RLS. Merge-on-login: read local blob, read row; if row empty → upload local; else newest-`updatedAt`-wins per comparison id (union by `id`), then clear local or keep as cache. Keep Investing fully functional with **no** account (localStorage only) — linking is purely additive.

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
- New access model: public landing; **Investing public** (localStorage, §6); **Visualizer + Spotify require login**. Remove the Spotify-link route gate that bounces users off `/m`.
- Net-new **Investing** page (`/investing`, SPX option comparison) — this is a build, not a port (⚠️ §0).
- **Split flag:** registry + landing + Investing build + auth-gate rewrite = multiple domains → 2 sessions (shell/registry first, Investing second).

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
