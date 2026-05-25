# Decision Log

<!-- Newest first. Format: -->
<!-- ## YYYY-MM-DD — Decision Title -->
<!-- **Context**: Why this came up -->
<!-- **Decision**: What was decided -->
<!-- **Reasoning**: Why this choice over alternatives -->

## 2026-05-25 — Pre-authorize .md edits via project settings

**Context**: Permission prompts for memory file updates interrupt
long sessions. Stone wanted .md edits auto-approved.

**Decision**: Created `.claude/settings.json` with allow-list for
`Edit(.claude/)`, `Write(.claude/)`, and root markdown files. Project-
level config (committed), applies to all sessions.

**Reasoning**: Markdown is low-risk, high-frequency, reversible via
git. Code changes still require normal prompts. Prefix matching only
(no `*.md` glob), so only .claude/ and root docs are covered. See
`md-permissions.md` for full rationale.

## 2026-05-25 — Boot sequence contract: LoadingScreen owns first paint

**Context**: After `aff02d1` (Spotify token persistence), refreshing
on `/m` briefly routed through `/spotify-login` before snapping back.
LoadingScreen did not cover the gap. Three racing effects in App.tsx
read `mem` synchronously before `setUserAndHydrate` finished.

**Decision**: Add a Spotify hydration state machine
(`idle | loading | linked | not-linked | error`) to `AppRoutes`.
A derived `booting` flag combines `authLoading`, `/callback` in-flight,
and `spotifyHydration === 'loading'`. While `booting`, LoadingScreen
is the only thing on screen and all routing decision effects bail.
A single post-boot effect makes ALL routing decisions; the previous
three racing effects collapse to one.

**Reasoning**: Token state changes in module-level memory don't
trigger React re-renders, so any synchronous check from an effect is
fundamentally racy. Lifting the state into React (the state machine)
makes hydration observable and lets all routing collapse into one
clearly-ordered effect. `setUserAndHydrate` now races an 8s timeout
so a dead Supabase can't block boot indefinitely. Full contract:
`.claude/memory/decisions/boot-sequence-contract.md`.

## 2026-05-24 — Asian Vibrant polish pass: saturated woodblock direction

**Context**: The "monk's scriptorium" rebuild shipped earlier today
was restrained and low-density. Stone reviewed against two reference
images (`web/public/reference/dragon-reference.jpg` and
`pink-reference.jpg`) and flagged four concrete bugs (viewport
backdrop, flat dragon stroke, restrained palette, dropdown shadow
scrolling).

**Decision**: Override the restrained doctrine. Adopt a "saturated
woodblock + watercolor scene" direction. Tokens deepened (`--av-crimson
#A0001C`, new gold-leaf / pink / indigo / cinnabar / paper-pink
ranges). `RicePaperBackdrop` uses explicit `100vw × 100vh`, noise SVG
`stitchTiles="stitch"`, theme paints `body` + `#root` via scoped
selectors. New decorative layers: `SunDisk`, `DistantClouds`,
`BackgroundCalligraphy` (giant 龍 watermark), `CornerBranches`,
4-layer mountains. Kanji 6 desktop / 3 mobile; petals 18 desktop /
8 mobile. `Dragon` fully rebuilt as discrete illustrated SVG (head +
mane + 11 cream body segments with red underside banding + scales +
dorsal tufts, front+back legs with 3-toed gold claws, tail flame
tuft). `.av-scroll-panel` retired in favor of split outer/inner
pattern so the rolled gradient edges stay glued to the panel edge.

**Reasoning**: Reference imagery is dense and saturated; honoring
it means retiring "one crimson moment per region" and committing to
density. Audit: `progress/asian-vibrant-polish-audit.md`.

## 2026-05-24 — Self-healing loading screen replaces inline splash

**Context**: A poisoned `mheu_token_expiry = "Infinity"` in
localStorage threw a `RangeError` out of `migrateFromLocalStorage`,
stalled boot, and gave Stone no escape other than DevTools. The v1
splash had no time limit, no diagnostic, and no recovery action.

**Decision**: New `web/src/components/LoadingScreen.tsx` progresses
through four stages on a fixed time budget — 0-5s normal, 5-15s
"taking longer" message, 15-30s help card with Try again / Clear
cache & reload / Sign out & reload, 30s+ auto-clear cache + reload.
Loop protection via `sessionStorage.mheu_auto_recovered_at` (2-min
TTL) — second hit shows a final error state instead of re-firing.
Hardcoded brand-color hex fallbacks alongside every CSS var so the
splash renders even if `tokens.css` fails to load. Companion PART
1.5: `tokenStore.migrateFromLocalStorage` is now wrapped in nested
try/catch at every step; a pathological legacy value can no longer
escape the shim. Old inline JSX archived to
`web/src/archive/loading-screen-v1/`.

**Reasoning**: Belt-and-suspenders. Shim hardening prevents this
specific failure; the self-healing splash catches the entire class.
Stage 4 auto-clears cache (not signs out) because most stuck-boot
cases are client-state corruption and signing out is destructive.
Full reasoning in `loading-screen-self-healing.md`. Audit in
`progress/loading-screen-audit.md`.

## 2026-05-24 — Spotify tokens persist to Supabase, not localStorage

**Context**: Spotify OAuth tokens lived only in browser localStorage.
Signing in on a new browser or after clearing site data forced a full
re-link. The Spotify link followed the browser, not the user account.

**Decision**: New `public.spotify_tokens` table (per-user PK, self-only
RLS, updated_at trigger) is the source of truth. New
`services/spotify/tokenStore.ts` owns an in-memory cache + Supabase
persistence + one-time localStorage migration shim. Existing
`services/spotify/tokens.ts` is now a thin adapter preserving the
import surface for player.ts / polling.ts / session.ts / App.tsx.
Sign-out preserves the Supabase row; an explicit "Disconnect Spotify"
button in the profile dropdown is the only path to full unlink.
Migration shim copies legacy localStorage tokens into Supabase on
first boot after this ship, then clears local; TODO marks 2026-06-23
for removal.

**Reasoning**: Tying tokens to the Supabase user_id means the link
follows the account. Migration shim makes the rollout invisible for
Stone (already linked in his current browser). In-memory cache keeps
hot path the same speed as before. Full reasoning + lifecycle table in
`spotify-token-persistence.md`.

## 2026-05-24 — Theme system must be lock-safe

**Context**: A theme that throws during render previously locked the
entire app — once `profiles.theme_id` pointed at a broken theme, the
in-app theme switcher (inside the profile dropdown, which itself lives
inside the broken theme) became unreachable. Observed in production
with Asian Vibrant.

**Decision**: `ThemeProvider` wraps all theme-rendered content in a
`ThemeErrorBoundary`. On any throw the boundary swaps the active
theme to `DEFAULT_THEME_ID` for the session ONLY (no write to
`profiles.theme_id`), adds the failing id to a session-local
`blockedThemes` Set so the next hydration cannot undo the fallback,
and bumps a `resetCounter` so the boundary remounts clean.

**Reasoning**: One boundary at the provider level covers every
theme surface (shell + all 11 components + decorations) with no
per-theme glue. User preference is preserved — they keep their
chosen theme as soon as the underlying bug is fixed. The
`[theme] '<id>' threw during render` console line turns a "site
broken" report into a one-grep debugging session. Full reasoning +
hard rules in `theme-lock-safety.md`.

## 2026-05-23 — Status note: desktop retired into legacy/desktop/

The Electron desktop was moved to `legacy/desktop/` in commits
`dfda553` + `31d6cc4` before the branch consolidation, but the
move was never logged. Active product is the MHEU web app at
`/web`. See `desktop-retirement.md` for full implications.

## 2026-05-23 — Social feed avatar + reveal_action rules

**Context**: T4 split the U-tab feed into focused components. Two
ambiguous-on-first-read choices needed locking in: (1) where to read
avatars from (`profiles.avatar_url` vs `users.avatar_url`), (2) where to
enforce the `reveal_action` source-line visibility rule.

**Decision**:
- Avatar source is **always** `profiles.avatar_url`. The `public.users`
  table maps `spotify_user_id ↔ id` and does NOT carry avatar. Fall back
  to a colored letter circle (first char of username, background tinted
  by `accent_color`).
- `reveal_action` visibility is enforced **server-side** in
  `web/api/scores.ts:handleEvents`: `source_action` is set to null
  unless `isOwnEvent && (visibility_override ?? userVisibility)`. The
  client cannot widen this. Client re-asserts the same condition in
  `web/src/features/feed/eventCopy.ts` purely as defense in depth, with
  a doc-block at the top so a future change cannot silently widen
  rendering.
- Per-row accent colors come from `event.accent_color` (other users'
  hex from `profiles`), NOT from CSS variables. CSS `var(--accent-color)`
  is only used as a fallback when a row's accent_color is null.

**Reasoning**: Single avatar source = no schema ambiguity. Server-side
enforcement = no way for a client bug to leak source lines. Per-row hex
= rows paint their owner's color correctly regardless of who's viewing,
which is the whole point of having per-user accents on a social feed.

## 2026-05-22 — Tab-audio AnalyserNode is the single audio source

**Context**: M-tab needs Butterchurn reactivity, gear-icon signal meter, and a new T3 waveform progress bar — all from the same "currently playing" audio. Spotify's `/v1/audio-analysis` and `/v1/audio-features` have been 403'ing for most clients since late 2024.
**Decision**: One MediaStream (tab or system loopback) → one AnalyserNode → three consumers (Butterchurn, signal meter, `useAudioSource()` for T3). Spotify analysis client archived. Synthetic music-data pipeline deleted.
**Reasoning**: Real audio beats fake audio. One source means no drift between consumers. See `audio-source-routing.md` for the option matrix and trade-offs.

## 2026-05-22 — Consolidate to single `main` branch

**Context**: Four divergent branches (`Desktop`, `web-app`, `refactor/consolidate`, `claude/lucid-payne-2538da`) all carried partial work; Desktop was newest with all live features. Branch sprawl was confusing for deploys and rebasing.
**Decision**: Force-push Desktop state to `main`, delete the other three remotes, set `main` as default on GitHub. Single source of truth.
**Reasoning**: Desktop diffed +1627/-11522 vs web-app — clearly held all latest work. No PRs were open against the dead branches. History on `Desktop` is preserved as the new `main`.

## 2026-05-22 — Supabase keepalive folded into existing daily cron

**Context**: Supabase free tier pauses after 7 days idle. Need a reliable daily ping. Standalone `/api/keepalive.ts` cron would bring function count to 13 and break the Hobby tier 12-function limit.
**Decision**: Two-tier keepalive — (1) client-side ping from `App.tsx` on every visit, (2) server-side ping embedded in `api/cron/recompute.ts` (already runs daily). New `public.keepalive` table with permissive RLS holds the heartbeat row.
**Reasoning**: Zero new functions, redundant coverage (client + cron), heartbeat is auditable in Supabase. See `supabase-keepalive.md`.

## 2026-05-22 — Submodule gitlink removal

**Context**: Repo root carried a gitlink `160000 e4857af... Visual` with no `.gitmodules` file (legacy nested clone from session 17). Vercel deploys failed in 2 seconds with "Failed to fetch one or more git submodules".
**Decision**: `git rm --cached Visual` to drop the gitlink; add `/Visual/` to `.gitignore` so the local folder stays on disk but is no longer tracked. No .gitmodules entry needed to remove.
**Reasoning**: The nested clone is the same repo (https://github.com/Rlizeify/Visual.git) — its history is already in our main history. Preserving the folder locally honors the archive-don't-delete rule while unblocking Vercel.

## 2026-05-08 — Admin data console architecture

**Context**: `/admin` needs to view + edit every user-related table, reset passwords, manage the leaderboard, and never leak the service-role key to the browser.
**Decision**: All writes go through `web/api/admin/*` Vercel functions that validate the caller's Supabase JWT, check `profiles.is_admin`, and write through a service-role client. Every write inserts a row into a new `audit_log` table with before/after JSON. `force_set_password` is super-admin-only (gated by hardcoded `SUPER_ADMIN_EMAIL`) and never logs the password value. Leaderboard PUT is full replace. Migration 7 also adds `profiles.username` to support the Users tab. See `admin-data-console.md` for full file layout, audit-log semantics, and open follow-ups.

## 2026-05-08 — Admin role + first-admin bootstrap

**Context**: `/admin` console needs role-based access. First admin (CB) must be seeded without giving the client any privilege-escalation primitive.
**Decision**: `profiles.is_admin` column + `is_admin(uuid)` SECURITY DEFINER helper used in additive RLS policies + `bootstrap_admin(email)` function exposed only to `service_role` (called once via the Supabase SQL editor). Brute-force protection is currently a client-side localStorage counter; flagged as a stopgap. See `admin-bootstrap.md` for how to seed and the open follow-up on real rate limiting.

## 2026-05-08 — OAuth token encryption strategy

**Context**: Life Score feature requires storing OAuth tokens for multiple providers (Spotify, Discord, YouTube, MyNetDiary, Apple).
**Decision**: Use pgcrypto with PGP symmetric encryption (`pgp_sym_encrypt`/`pgp_sym_decrypt`).
**Reasoning**: Works on all Supabase plans (including free), simple two-function API, no external dependencies. Encryption key stored in Vault (prod) or env var (dev). See `oauth-token-storage.md` for full analysis.

## 2026-05-08 — Reactivity architecture for Tizen TV + Spotify

**Context**: Need true audio reactivity on Samsung Tizen TV browser with Spotify source and minimal user setup.
**Decision**: Path B — Desktop host captures system audio via WASAPI loopback, runs FFT, broadcasts bands over WebSocket to LAN clients.
**Reasoning**: Path A (pure web) killed by Spotify DRM blocking AnalyserNode access. Path C (cloud relay) too expensive at 60Hz and adds latency. Path B gives <50ms latency, zero ongoing cost, and one-install setup. See `reactivity-architecture.md` for full analysis.

## 2026-04-04 — Initialize infrastructure file system

**Context**: No CLAUDE.md, memory, agent, or soul files existed.
**Decision**: Created full directory-based memory system under `.claude/memory/` with six subdirectories.
**Reasoning**: Directory-based structure scales better than flat files. Separation of concerns (decisions, patterns, context, progress, roadmap) prevents any single file from becoming unwieldy.
