# Obsession — Build Audit + Plan

**Started**: 2026-05-25
**Scope**: Per-user, hidden, AC-130-locked self-discipline feature.
Easter-egg access. Five surfaces. New database tables. Strava
OAuth scaffolding. CSV uploads for MyNetDiary. Strict 7-min timed
write surface for daily meditations.

## Existing context the build sits inside

- **Theme system** (`web/src/themes/`): registry of sibling theme
  manifests. `ThemeContext` reads `profiles.theme_id` once per
  auth-load + writes back on `setTheme()`. `ThemeProvider` mounts
  `ThemeErrorBoundary` so a broken theme falls back to
  `DEFAULT_THEME_ID` for the session.
- **AC-130 Thermal theme** (`web/src/themes/ac130-thermal/`): full,
  shipped 2026-05-25. Tokens `--ac-*` family, surface classes
  `.ac-hud-frame`, `.ac-wire-button`, `.ac-bracket-tab`,
  `.ac-hud-text`, `.ac-thermal-bar`. HitmarkerText font globally
  loaded via `web/src/styles/fonts.css`. Decorations layer with
  shared 30fps RAF for live HUD plates.
- **Route structure** (`web/src/App.tsx`): `BrowserRouter` →
  `ThemeProvider` → `ThemedApp` (theme.shell wraps) →
  `AppRoutes`. Auth gate uses `session` from `useAuth()`. MHEU
  routes share `MHEUShell`. Visualizer is mounted once and
  z-index-swaps per route.
- **Supabase client setup** (`web/src/lib/supabase.ts`): anon-key
  PostgREST client. Service-role key only in `web/api/_admin.ts`
  (server-only).
- **OAuth pattern**: Spotify uses code-with-PKCE
  (`services/spotify/auth.ts` + `tokenStore.ts`). PKCE works
  client-side; no secret in browser. Discord + MyNetDiary use
  classic OAuth via `api/oauth.ts` (a single Vercel function
  switching on `?service=` query param). The pattern Strava
  follows is **the latter**, because Strava token exchange
  requires `client_secret` which cannot ship to the browser.
- **Token persistence**: per-user Supabase tables fronted by an
  in-memory module-level cache + subscribe/emit event bus. See
  `services/spotify/tokenStore.ts` as the template.

## Critical constraint: 12/12 Vercel Hobby function ceiling

The build introduces:
- Strava OAuth handshake (start + callback exchange).
- Strava activities sync (`SYNC NOW` button).

**Decision**: extend the existing `api/oauth.ts` (currently handles
discord + mynetdiary) to add a `strava` branch for handshake.
Activities sync also folds in as `?action=strava-sync`. This keeps
us at 12 functions. The function file grows; no new function
appears.

If `api/oauth.ts` proves too large to host both, fall back plan is
to consolidate `admin/leaderboard.ts` + `admin/oauth.ts` (both
admin-only, both small) and reclaim a slot. Decision deferred until
PART 8 lands and we can see actual file size.

## Files to create (grouped by surface)

### Database (PART 2)

```
web/supabase/migrations/20260525120000_obsession_tables.sql
```

11 tables, all `obsession_*` prefixed, all RLS where
`auth.uid() = user_id` (read/write own row only). Quote pool is
shared (read-anyone, write-service-role only).

### Easter egg + theme override + routes (PARTS 3, 4, 5)

```
web/src/features/obsession/
  OBSESSION.md                       — feature README + manifesto
  useObsessionEgg.ts                 — global keystroke listener hook
  ThemeOverrideProvider.tsx          — forces ac130-thermal in subtree
  ObsessionRoutes.tsx                — <Routes> for /obsession/*
  ObsessionLayout.tsx                — shared shell (grid bg + scan lines)
  lib/
    supabase.ts                       — re-exports app client + helpers
    types.ts                          — Row types for all 11 tables
    localDate.ts                      — timezone-aware "today" helper
    quotes.ts                          — deterministic-per-day quote selector
    dayCount.ts                        — days-since-first-entry helper
    csv.ts                              — minimal CSV parser (no deps)
    download.ts                         — file-download helper
    zip.ts                              — minimal zip writer (no deps)
```

### Landing (PART 6)

```
web/src/features/obsession/pages/
  Landing.tsx
  components/
    BirdButton.tsx                    — small organic bird-image button
    NavTile.tsx                       — wire-frame nav card
    QuoteWatermark.tsx                — bottom-right rotating quote
    StatusReadout.tsx                 — DAY count + meditation status
```

### Meditations + write flow (PART 7)

```
web/src/features/obsession/pages/
  Meditations.tsx                     — list view
  MeditationsWrite.tsx                — confirmation + write surface
  components/
    EntryRow.tsx
    DebriefConfirmation.tsx           — "READY TO BEGIN" panel
    WriteSurface.tsx                  — 7-min timer + textarea + autosave
    TagFlash.tsx                      — 10s post-submit tag chip input
  hooks/
    useDraftAutoSave.ts                — 5s upsert with retry
    useMeditationStatus.ts             — today-complete query
    useWriteSurfaceTimer.ts            — timestamp-driven countdown
```

### Training (PART 8)

```
web/src/features/obsession/pages/
  Training.tsx
  StravaCallback.tsx                  — handles ?code=... return
  components/
    GoalsBlock.tsx
    StravaBlock.tsx                   — connect / sync / disconnect
    MyNetDiaryUpload.tsx              — drop zone + parse + report
    ActivityFeed.tsx                  — combined feed + filters
    ConflictPill.tsx                  — per-row conflict indicator
  lib/
    strava.ts                          — client-side wrappers
    mnd.ts                             — CSV parser + dedupe + report
```

### Lifts (PART 9)

```
web/src/features/obsession/pages/
  Lifts.tsx                           — exercise list
  LiftsLog.tsx                        — active session
  components/
    ExerciseRow.tsx
    SetEntryRow.tsx
    StopReasonControl.tsx              — W/P/V/F segmented
    IntensityControl.tsx               — 0/1/2 segmented
    SessionShorthand.tsx               — live "35#12W / 40#10F,..." display
```

### Amor (PART 10)

```
web/src/features/obsession/pages/
  Amor.tsx                            — manifesto + bird watermark
```

### Settings (PART 11)

```
web/src/features/obsession/pages/
  Settings.tsx
  components/
    DurationControl.tsx                — slider with confirm-on-lower
    SourcePreferenceControl.tsx
    UploadHistory.tsx
```

### Export (PART 12)

```
web/src/features/obsession/components/
  ExportModal.tsx                      — generic per-surface modal
  ExportEverythingButton.tsx           — bundles via zip.ts
web/src/features/obsession/lib/
  export.ts                            — per-table → md/csv writers
```

### Server (PART 8)

```
web/api/oauth.ts                       — extend with strava branch
```

### Style

```
web/src/features/obsession/obsession.css
                                       — grid overlay, status pills,
                                       — bracket headers, etc.
```

## Database tables (PART 2)

All RLS `auth.uid() = user_id` read+write own rows. Service-role
bypasses. Quote pool is shared read-anyone, no write policy.

| Table | PK | Notes |
|---|---|---|
| obsession_meditations | id | body, tags, session times, day_of_entry (date) |
| obsession_meditation_drafts | id | one row per user per day; auto-saved |
| obsession_training_goals | id | name, target_date, kind enum, achieved_at |
| obsession_lifts_sessions | id | session_date, notes |
| obsession_lifts_sets | id | FK session, exercise_name, weight, reps, stop_reason, intensity, pain_location, set_order |
| obsession_lifts_exercises | id | UNIQUE (user_id, name), up_arrow_flag, last_session_id |
| obsession_strava_tokens | user_id | access, refresh, expires_at, scope, athlete_id |
| obsession_strava_activities | id | strava_id UNIQUE, type, distance, times, raw_payload |
| obsession_mynetdiary_entries | id | entry_date, food_name, calories, P/C/F, raw_csv_row |
| obsession_preferences | user_id | meditation_duration_seconds (60-1800), daily_limit (1-10), source_preference_conflicts |
| obsession_quote_pool | id | shared; Stone seeds later |

`obsession_meditation_drafts` is upserted on `(user_id, day_of_entry)`
during the write window. Promoted to `obsession_meditations` on
timer-zero, then deleted. Orphan drafts older than 24h are deleted
on next sight (handled in the resume path).

## Easter-egg listener (PART 3)

```
useObsessionEgg(navigate)
```

Mounted from `App.tsx` once `useAuth().user` is present.

- Maintains a `useRef<string[]>` of last 9 keystrokes (`window`
  level `keydown`).
- Skips when `document.activeElement?.tagName ∈ {INPUT, TEXTAREA}`
  or `isContentEditable`.
- Skips when `e.metaKey || e.ctrlKey || e.altKey` (system shortcuts).
- Skips when there's no signed-in user.
- Tracks `lastKeyTime`. If gap > 3000ms, buffer resets before push.
- On buffer `endsWith('obsession')`: `navigate('/obsession')` +
  buffer cleared.

Decision logged at `decisions/obsession-architecture.md`.

## Route-level theme override (PART 4)

```
<Route element={<ThemeOverrideProvider id="ac130-thermal" />}>
  <Route path="/obsession" element={<Landing />} />
  ...
</Route>
```

`ThemeOverrideProvider` is a re-implementation of just enough of
`ThemeContext` to scope the override to a subtree:

- It does NOT call `setTheme()` on the global context (no
  Supabase write).
- It sets `document.documentElement.dataset.theme = id` on mount +
  restores the prior value on unmount.
- It provides a local `ThemeContext.Provider` with the AC-130
  manifest as `theme`. Inside `/obsession/*`, `useTheme()` returns
  the AC-130 manifest.
- The profile dropdown theme switcher still calls `setTheme()` on
  the underlying `ThemeContext`; while inside `/obsession/*` it
  shows the note "Obsession is locked to AC-130 Thermal." — but
  the user's choice persists for when they navigate out.

This approach is the smallest-surface override that satisfies the
spec without re-jigging the theme system. The user's preference is
preserved cleanly.

## What this build does NOT do

- No new top-level nav tile. The feature is hidden.
- No admin surface — obsession is per-user, no admin CRUD.
- No notifications, no email, no reminders.
- No mobile-first design (desktop primary; mobile degraded).
- No client-side OAuth secret usage. Strava handshake + sync go
  through `api/oauth.ts` server-side.

## Risk register

| Risk | Mitigation |
|---|---|
| Vercel function ceiling | Fold Strava into existing `api/oauth.ts` |
| Write surface lost-data on net failure | Local textarea state is truth; upsert retries every 5s with logging |
| Timer drift across sleep / tab switch | Use `started_at` timestamp for elapsed-time math, never setInterval counts |
| Daily-limit timezone bugs | Derive `day_of_entry` from user's local time at LOCK IN; store as `date` |
| Easter egg eaten by inputs | Skip when activeElement is INPUT/TEXTAREA/contentEditable |
| Theme override leaking | Restore prior `data-theme` on unmount; preserved on remount via prop |
| Migration breaking prod | Tables are isolated (`obsession_*` prefix); zero existing FKs |
| Auto-recover orphan drafts deleting in-progress work | Only delete if `started_at` is > 24h old |
| Build size from new code | Per-surface code-split via `React.lazy` is a possibility; skipped unless build fails |

## Dependencies to add

- `papaparse` — for MyNetDiary CSV parsing. NOT currently in
  `web/package.json`. Either add it or hand-roll a tiny CSV parser
  in `lib/csv.ts`. **Plan**: hand-roll a minimal CSV parser
  (~30 lines, no quotes-in-quotes edge cases — MyNetDiary export
  is well-formed). Skips a dependency.
- `jszip` — for the EXPORT EVERYTHING bundle. **Plan**: hand-roll
  a minimal zip writer (uncompressed STORE method, ~80 lines), or
  add the dep. **Decision**: add `jszip` to `web/package.json`.
  Hand-rolling zip is fiddly (CRC-32, central directory offsets);
  the dep is well-maintained and adds ~30 KB gzipped.

## Verification plan (PART 17)

```
cd web && npx tsc --noEmit          # must pass
cd web && npm run build              # must pass
supabase db push                     # from web/ (already linked)
supabase migration list --linked     # confirm new row applied
```

Manual smoke (Stone, documented in commit):
- Type `obsession` outside an input → /obsession lands in AC-130.
- Begin debrief → confirm → LOCK IN → write surface activates.
- Type → close tab → reopen → type `obsession` → resume restored.
- Wait timer → auto-submit → tag flash → return to landing.
- Confirm Begin Debrief disabled (daily limit met).
- /obsession/lifts: log a set; verify shorthand format.
- /obsession/training: Connect Strava → graceful "[ STRAVA
  UNAVAILABLE — ADMIN CONFIG PENDING ]" without env vars.
- Upload a MyNetDiary CSV; verify ingestion + feed.
- /obsession/amor: manifesto + bird render.
- /obsession/settings: lower duration to 60s, confirm next
  debrief uses new duration.
- Export meditations → markdown downloads.
- Navigate out → normal theme returns.

## Surface ordering rationale

Build order: database → easter egg → theme override → routes →
landing → meditations → lifts → training (server) → amor → settings
→ export → polish → memory → verify → commit.

Meditations + lifts before training because they're fully
client-side and let the rest of the architecture stabilize before
we touch `api/oauth.ts`. Amor is trivial and a good palate cleanser.
