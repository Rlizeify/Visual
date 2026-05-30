# Scores Snapshot Broken — Production Audit (2026-05-30, third pass)

## Symptom recap (production)

- U-tab leaderboard: Stone at position 0, all derivatives "—".
- Admin Life Scores tab: 500 "Could not find a relationship between
  'user_scores' and 'profiles' in the schema cache".
- Activity feed: events frozen ~9h old.
- Spotify listening continuous; no new events surfacing.

Prior session at 4619438 shipped server-side ingestion. Live diagnosis
showed ingestion was working — but the snapshot write was silently
failing and the FK was never actually applied.

## Root causes (two distinct bugs, both confirmed against live DB)

### Bug A — `user_scores` upsert silently no-ops

`writeScoreEventsIfChanged` in both `web/api/scores.ts` and
`web/api/cron/recompute.ts` upserts with `onConflict: 'user_id'`. The
live `user_scores` schema had NO unique constraint on `user_id`. The
upsert returned an error, but the helper never checked it.

Live evidence:

```sql
-- pg_constraint pre-fix
user_scores_pkey                     PRIMARY KEY (id)
user_scores_spotify_user_id_key      UNIQUE      (spotify_user_id)
user_scores_user_id_fkey             FK -> auth.users(id)
-- nothing on user_id
```

Consequence: `user_scores` had exactly 1 row, with `user_id = NULL` and
`spotify_user_id = 'stone.gaunce'` — the relic of the deprecated
`handleUpsertScore` path. Every cron / manual recompute since the
2026-05-26 ship logged 80 `score_events` rows but never materialized a
snapshot row. Every event was tagged `initial_calculation` because
`writeScoreEventsIfChanged` couldn't find an existing row.

The second nail: `spotify_user_id` was `NOT NULL UNIQUE` text, and the
new code passed `userId` (an auth UUID) as a placeholder. That kludge
clashed with the legacy text Spotify-handle constraint pattern and
made the row even harder to upsert cleanly.

### Bug B — FK migration was phantom-applied

`supabase migration list --linked` reported `20260523000001` as applied,
but `pg_constraint` had no FK from `user_scores` → `profiles`. Likely
cause: the migration row was inserted (manually or by a half-completed
push) before the file was authored, so `supabase db push` later treated
it as already-applied and skipped the DDL. PostgREST therefore could not
resolve `select(..., profiles(...))` against `user_scores` — admin
LifeScores tab 500ed.

## Fix shape

Migration `20260530000002_user_scores_unique_user_id_and_fk.sql`:

1. `DELETE FROM user_scores WHERE user_id IS NULL` — drop the legacy
   relic row.
2. `ALTER COLUMN spotify_user_id DROP NOT NULL` — kill the kludge
   requirement.
3. `ADD CONSTRAINT user_scores_user_id_key UNIQUE (user_id)` — make
   the upsert's ON CONFLICT actually fire.
4. `ADD CONSTRAINT user_scores_user_id_profiles_fk FOREIGN KEY (user_id)
   REFERENCES profiles(id) ON DELETE CASCADE` — the FK that
   20260523000001 was supposed to install.
5. `NOTIFY pgrst, 'reload schema'` — refresh PostgREST so admin
   LifeScores nested join works immediately.

Code:

- `web/api/scores.ts` — `writeScoreEventsIfChanged` no longer sets
  `spotify_user_id` to the auth UUID. Upsert now checks `error` and
  logs both the failure and the success path. `recomputeUser` returns
  `eventsWritten`. `handleRecomputeAll` now reports `events_written`
  (real count), no longer the lying `events_written_estimate: 0`.
- `web/api/cron/recompute.ts` — same upsert cleanup + error logging.

## Backfill

Stone's row was inserted via SQL using the latest week-scale value
from `user_position_history` (5.98). Derivatives left NULL — next cron
or curl `recompute-all` will populate. Avoids a "—" display while the
deploy propagates.

## Live verification (post-fix, pre-deploy)

```sql
-- FK + UNIQUE now present
user_scores_user_id_key              UNIQUE      (user_id)
user_scores_user_id_profiles_fk      FK -> profiles(id) ON DELETE CASCADE

-- Stone's snapshot row exists
user_id                              | display_name | position_score
7c889463-006e-49c1-98f3-136a0593a10f | stone        | 5.98

-- Nested join resolves
user_scores ⨝ profiles → 1 row matched
```

## Manual steps for Stone after deploy

1. Fire `curl -X POST https://mheu.lol/api/scores?action=recompute-all
   -H "Authorization: Bearer $CRON_SECRET"`. Response should include
   `events_written > 0` and `succeeded` ≥ 1.
2. Refresh `mheu.lol/u` — leaderboard should show Stone at 5.98 (or
   the freshly recomputed value); derivatives populate after at least
   two cron runs (z-scores need history span).
3. Refresh admin LifeScores tab — should load, no schema-cache 500.

## Cron status

- vercel.json cron entry confirmed: `/api/cron/recompute` daily at
  `0 0 * * *` UTC (Hobby tier max).
- Last verified fire: 2026-05-30 00:19:13 UTC (`user_position_history`
  rows at that timestamp for Stone).
- After fix, the cron will start producing real snapshot deltas
  (current run = first non-`initial_calculation` events).
