# Preset + OAuth Admin Audit (2026-05-30)

Audit for Part B of Stone's session brief: fix the empty admin OAuth
tab, expand the Butterchurn preset library, and add audio-gated
auto-shuffle.

## Part 1 — OAuth admin tab is empty

### What the admin tab does

`web/src/components/admin/OAuthTab.tsx` fetches
`GET /api/admin/oauth`. The handler
(`web/api/admin/oauth.ts`) does:

```ts
ctx.supabase.from('oauth_connections')
  .select('id, user_id, provider, expires_at, scope, created_at,
           updated_at, profiles(username, display_name)')
  .order('created_at', { ascending: false })
```

Then joins emails via `auth.admin.listUsers()` and returns rows.

### What's actually in the database

Three storage locations for OAuth-ish tokens currently exist:

| Location | Created | Used by | Current state for Stone |
|---|---|---|---|
| `public.oauth_connections` (TABLE) | 2026-05-08 mig 02 | api/oauth.ts (Discord callback, MyNetDiary, generic disconnect, `handleSpotifyConnect`), admin/oauth.ts (SELECT/DELETE) | **Empty** — Stone hasn't done Discord or MyNetDiary; old `handleSpotifyConnect` path may not have run since the spotify_tokens migration |
| `public.spotify_tokens` (TABLE) | 2026-05-24 mig | services/spotify/tokenStore.ts (live source of truth for Spotify), api/cron/recompute.ts, api/_spotify-ingestion.ts | **Has Stone's row** |
| `public.obsession_strava_tokens` (TABLE) | 2026-05-25 mig | api/oauth.ts (Strava OAuth callback + sync) | Empty unless Stone connected Strava |

So the admin tab queries `oauth_connections` and gets back zero rows
because that table never received Stone's Spotify connection (the new
flow writes to `spotify_tokens` instead).

### Recommended fix (chosen)

Create a Postgres VIEW that UNIONs the provider-specific tables into
the shape the admin tab expects. Future provider tables (Discord,
MyNetDiary in their own dedicated tables, etc.) get added to the view
definition; no admin code changes.

**Naming compromise.** Stone's brief asks for a VIEW literally named
`oauth_connections`. That name is already a real TABLE with active
callers in `api/oauth.ts` (Discord callback upsert, MyNetDiary submit,
spotify connect, generic disconnect, connections list) plus the admin
handler. Renaming the table to free the view name would require
surgery on 5+ call sites and a migration that
DROP TABLE + CREATE VIEW with the same name is not safe to do
casually.

**Compromise**: name the view `oauth_connections_unified`. The admin
tab queries the view directly. The legacy `oauth_connections` table
keeps working for Discord / MyNetDiary writes (out of scope for this
ship). The view name is documented as the single reference point for
"all OAuth connections" going forward; new providers add a SELECT
branch.

Follow-up (logged in blockers/follow-ups): retire the legacy
`oauth_connections` TABLE after Discord and MyNetDiary get their own
dedicated per-provider tables, then rename the view to plain
`oauth_connections`.

### View shape

```sql
CREATE OR REPLACE VIEW public.oauth_connections_unified
WITH (security_invoker = true) AS
SELECT
  ('spotify:' || user_id::text)         AS id,
  user_id,
  'spotify'::text                       AS provider,
  scope,
  expires_at,
  created_at,
  updated_at
FROM public.spotify_tokens
UNION ALL
SELECT
  ('strava:' || user_id::text)          AS id,
  user_id,
  'strava'::text                        AS provider,
  scope,
  expires_at,
  created_at,
  updated_at
FROM public.obsession_strava_tokens;
```

`security_invoker = true` (Postgres 15+, Supabase supports it) means
the per-user RLS on the underlying tables applies when a normal user
queries the view. Service role (admin endpoint) bypasses RLS as
usual.

### Admin DELETE routing

Synthetic IDs `${provider}:${user_id}` let the admin handler parse and
route DELETE to the correct underlying table:

```ts
const [provider, userId] = id.split(':')
const table = provider === 'spotify' ? 'spotify_tokens'
            : provider === 'strava'  ? 'obsession_strava_tokens'
            : null
```

## Part 2 — Butterchurn preset library expansion

### Current loading path

`web/src/features/visualizer/VisualizerEngine.ts`:

```ts
import butterchurnPresets from 'butterchurn-presets'
// ...
this.presets = butterchurnPresets.getPresets()
this.presetKeys = Object.keys(this.presets)
```

Just the main bundle. **100 presets** currently shipped.

### Available packs (already installed)

`butterchurn-presets@2.4.7` ships SIX bundles in `lib/`:

| Bundle | Count | Notes |
|---|---|---|
| `butterchurnPresets.min.js` (main) | 100 | currently used |
| `butterchurnPresetsExtra.min.js` | 146 | community-favorite extras |
| `butterchurnPresetsExtra2.min.js` | 122 | second extras batch |
| `butterchurnPresetsMD1.min.js` | 87 | MilkDrop 1-era classics |
| `butterchurnPresetsNonMinimal.min.js` | 71 | heavier / non-minimal |
| `butterchurnPresetsMinimal.min.js` | (subset of main) | skip — overlaps main |

Sum naively: **100 + 146 + 122 + 87 + 71 = 526**. After
dedup by name there will be some collisions (e.g., `$$$ Royal - Mashup`
series spans main and extra with similar numbering). Merging with
main-wins precedence (main → extra → extra2 → MD1 → nonMin) gives a
total close to 500 distinct presets — confirmed at build time.

### MHEU renaming scheme (existing)

There is NO auto-renaming function. The "renaming scheme" is the
Supabase `visualizer_presets` table — admin maps `original_name` →
`display_name` via the `/admin/Presets` tab. `usePresetNames()` joins
the override at render time; presets without an override show their
original Butterchurn name.

For newly imported presets: they show their original Butterchurn name
by default (the existing fallback path). Admin can rename via the
existing Presets tab. No collision logic needed — `usePresetNames()`
looks up by `original_name` which is unique per loaded preset.

### Module-level Object.assign collisions

Merging multiple packs with the same `original_name` keys collapses
to a single entry. Counts after merge confirmed at build time; logged
in the commit message.

## Part 3 — Auto-shuffle while playing

### Current cycling behavior

`VisualizerEngine.startCycleTimer()` runs a `setInterval` at
`cycleSpeed` seconds (default 15s, range 5–300s in GearMenu) and
calls `nextPreset()` which advances **sequentially**
(`currentPresetIndex = (idx + 1) % length`). No randomness, no audio
gating, no off state.

### Changes needed

- `nextPreset({ random?: boolean })` — random pick from
  `presetKeys`, skipping the last 5 played + current.
- `startCycleTimer()` — checks audio signal level each tick; if
  `getCurrentSignalLevel()` has been below threshold (e.g., 0.005) for
  >10 consecutive seconds, skip the advance until signal returns.
  Manual `loadPreset()` from user click resets the silence-counter
  and the next-cycle countdown.
- Off state: `cycleSpeed = 0` (or a separate `shuffleEnabled` flag)
  disables the interval entirely.
- `blendTime`: already exists, currently default 2.5s — within the
  2-3s "sensible blend" range.

### GearMenu changes

Add an "AUTO-SHUFFLE" row with a select for duration:
`OFF / 15s / 30s / 45s / 90s / 3min`. Default 45s.
Persists to localStorage via existing `useVizSettings` machinery
(already persists `cycleSpeed`; add `shuffleEnabled` boolean).

### Preset count display

Subtle row at the top of the gear menu showing
`PRESETS: 487` (or whatever final count comes out to). Uses tokens.

## Plan of attack

1. B.2 — OAuth view migration + admin handler routing + OAuthTab adjust
2. B.3 — Import additional preset packs in VisualizerEngine
3. B.4 — Auto-shuffle: engine random + audio gating + GearMenu UI
4. B.5 — Hygiene: tokens, 200-line cap, document collisions
5. B.6 — Build + tsc + supabase db push
6. B.7 — Memory updates
7. B.8 — Two commits (OAuth, then presets+shuffle), push

## Risks / things I'll watch

- Supabase view + `security_invoker` requires PG 15+. Supabase free
  tier currently runs PG 15+ across the board; if `supabase db push`
  rejects the option, fall back to a regular view + document.
- The legacy `oauth_connections` table still gets writes from
  Discord / MyNetDiary callbacks. Out of scope to migrate them; the
  view simply doesn't show them yet. Admin tab will surface Spotify
  and Strava only after this ship.
- Adding ~400 presets may bloat the bundle (each pack is a separate
  webpack chunk via dynamic `import` to keep initial load lean — TBD
  if static import is too heavy). If bundle warning escalates,
  switch to dynamic `await import(...)` and load packs in the
  background after first paint.
