# Scores Pipeline — Broken Link Audit

**Date**: 2026-05-26
**Reporter**: Stone (position 0, derivatives "—" on /u despite daily
Spotify listening since project start).

## Pipeline shape, as built

Server side:
1. **Ingestion** — `syncSpotifyData()` (lives in `web/api/scores.ts:114`)
   calls Spotify `/v1/me/player/recently-played?limit=50` with an
   access token supplied **in the request body**. Upserts into
   `public.spotify_play_history` and aggregates daily into
   `public.user_listening_stats`.
2. **Field aggregation** — `fetchAll()` in `src/scoring/connectors/index.ts`
   calls each connector's `fetch(userId, timeScale)`.
   `spotify.fetch()` reads only from the two Supabase tables above.
   **Never touches Spotify.**
3. **Scoring** — `calculateScores()` in `src/scoring/engine.ts` — pure
   math: weights × field values → rawScore → soft-cap curve → position
   (0-200). Z-scores derived from `user_position_history`.
4. **Persistence** — `writeScoreEventsIfChanged()` upserts
   `public.user_scores`, inserts deltas into `public.score_events`,
   pushes a row into `public.user_position_history`.

## Triggers (where it actually runs)

| Trigger | What runs | Ingests new Spotify data? |
|---|---|---|
| Vercel cron `0 0 * * *` → `/api/cron/recompute` | iter `oauth_connections`, fetchAll+scoring per user | **NO** |
| Client POST `/api/scores?action=recompute` | full pipeline INCLUDING `syncSpotifyData` | YES — but only if the body contains `spotifyAccessToken` |
| Client POST `/api/scores?action=recompute-stale` | scoring only (no token in body) | **NO** |
| `UserCompetitionTab.triggerRecompute()` on focus/visibility | POSTs `recompute` with `getSpotifyAccessToken()` in body | YES — only when /u is open in a foreground tab |

## Tables (relevant subset)

| Table | Purpose | Populated by |
|---|---|---|
| `spotify_tokens` | per-user access + refresh tokens | OAuth callback, client refresh |
| `oauth_connections` | legacy multi-provider token mirror | Discord/MyNetDiary handshake |
| `spotify_play_history` | individual track plays | `syncSpotifyData` |
| `user_listening_stats` | daily roll-up (listening_minutes, track_count) | `syncSpotifyData` |
| `user_scores` | current scores per user (read by leaderboard) | `writeScoreEventsIfChanged` |
| `score_events` | deltas (read by social feed) | `writeScoreEventsIfChanged` |
| `user_position_history` | history for derivative z-scores | `writeHistory` |
| `recompute_locks` | 5-minute per-user lock | `updateRateLimitLock` |
| `scoring_field_weights` | admin-tunable weights | admin panel |

## vercel.json crons

```json
"crons": [{ "path": "/api/cron/recompute", "schedule": "0 0 * * *" }]
```

One entry — daily UTC midnight. Hobby tier allows daily only.

## The broken link

**Candidate C confirmed** — the ingestion model is implicitly client-
side. Server-side polling does not exist.

Specifically:
- The cron at `/api/cron/recompute` iterates users from
  `oauth_connections` and runs `fetchAll(userId, 'week')`. `fetchAll`
  reads only Supabase tables. **The cron never calls Spotify with a
  user's token.** It is a re-aggregation pass over data that may or
  may not have been ingested.
- The only path that fetches new Spotify data is
  `syncSpotifyData(userId, spotifyAccessToken)`, which requires a
  caller to supply the token. The only caller that does so is the
  React U-tab in a logged-in browser session.
- `spotify_tokens` table (added 2026-05-24) holds Stone's
  refresh_token server-side, but **no server code references it**
  for ingestion. The cron predates it and was never wired.

Result for Stone:
- He listens to Spotify constantly but rarely opens /u.
- When he doesn't open /u, his `spotify_play_history` /
  `user_listening_stats` get no new rows.
- `rawScore` → 0 → `position` → 0.
- `user_position_history` rows are either missing or all-zero →
  stdev=0 → z-scores return null → "—" for v/a/j/snap.

The cron docstring even claims "Runs every 5 minutes via Vercel cron"
which contradicts `vercel.json` (daily) and the Hobby tier limit
(daily only). That's a separate documentation lie, but immaterial to
the root bug — even an hourly cron wouldn't fix ingestion.

## Fix shape

1. Rewire `/api/cron/recompute` to:
   - Iterate `spotify_tokens` (not `oauth_connections`).
   - Per user: refresh access_token if expired (POST Spotify
     /api/token with `grant_type=refresh_token`), persist back.
   - Call recently-played with the fresh token.
   - Run the existing ingestion + scoring + history pipeline.
   - Wrap per-user in try/catch; log {users, ingested, errors}.
   - Throttle defensively (Spotify allows ~180 rpm for this
     endpoint).
2. Keep schedule daily (Hobby cap).
3. Add manual trigger `/api/scores?action=recompute-all` gated by
   `Authorization: Bearer <CRON_SECRET>` so Stone can fire ad-hoc
   without waiting for midnight UTC. Folded into `scores.ts` to
   stay at 12/12 functions.
4. Extract token-refresh + recently-played-sync helpers to
   `web/api/_spotify-ingestion.ts` (underscore prefix → not counted
   as a Vercel function) so cron and scores share one
   implementation.

## Env vars (already present, verify)

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — used everywhere.
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` — required for the
  refresh-token grant. Already present (client-side OAuth uses PKCE,
  but server refresh needs the secret).
- `CRON_SECRET` — already exists, used by current cron auth check.
