# Scoring: server-side Spotify ingestion (2026-05-26)

**Context**

The score pipeline had been implicitly client-side. The daily cron at
`/api/cron/recompute` iterated `oauth_connections` and called the
scoring engine on whatever was already in `spotify_play_history` /
`user_listening_stats`, but it never actually called the Spotify API.
The only path that ingested new listening data was
`syncSpotifyData(userId, accessToken)` inside `/api/scores.ts`, called
only when the React U-tab POSTed `?action=recompute` with the user's
access token in the body. Result: Stone (and any user who didn't open
`/u` in a foreground tab) had empty ingestion tables, position score
locked at 0, derivative z-scores returning null ("—").

Secondary finding: the OAuth scope list in
`web/src/services/spotify/auth.ts` was missing
`user-read-recently-played`. The recently-played endpoint requires it.
Even the client-triggered ingestion was silently 403'ing.

**Decision**

- Extract ingestion helpers into `web/api/_spotify-ingestion.ts`
  (underscore prefix → not counted toward Vercel function ceiling):
  - `refreshSpotifyAccessToken(refresh)` — PKCE refresh (client_id
    only, no client_secret). Distinguishes 400/401 (revoked) from
    transient errors.
  - `ensureFreshAccessToken(supabase, tokens)` — refreshes + persists
    when access_token is within 60s of expiry; deletes the row on
    revocation.
  - `syncRecentlyPlayed(supabase, userId, accessToken)` — fetches
    /v1/me/player/recently-played, upserts into
    `spotify_play_history` (idempotent on
    `(user_id, track_id, played_at)`), aggregates daily into
    `user_listening_stats` (max(existing, new) so re-syncs never
    reduce counts).
  - `forEachLinkedUser(supabase, onUser, log)` — iterates
    `spotify_tokens`, refreshes per row, calls `onUser`, swallows
    per-user errors, throttles 150ms between calls. Returns
    `{users, refreshed, revoked, succeeded, failed}`.
- Rewire `/api/cron/recompute.ts` to use those helpers. Iterates
  `spotify_tokens` (not `oauth_connections` — the latter is for
  Discord/MyNetDiary only). Runs daily at `0 0 * * *` (Hobby tier cap).
- Add `?action=recompute-all` to `/api/scores.ts`, gated by
  `Authorization: Bearer ${CRON_SECRET}`. Same work as the cron; lets
  Stone fire on-demand from a terminal.
- Add `user-read-recently-played` scope to
  `services/spotify/auth.ts`. **Existing users must disconnect +
  reconnect Spotify before the new scope grants** — the Supabase row
  retains whatever scopes were authorized at link time.
- Defensive: every per-user step wrapped in try/catch; 403s logged
  with the re-link hint; helper logs counts at start/finish.

**Reasoning**

- The cron should be the source of truth for ingestion, not the
  client. Client visibility patterns are unrelated to "did this user
  listen to Spotify today."
- Using `spotify_tokens` (added 2026-05-24) closes the loop: that
  table is the per-user source of truth for OAuth state and already
  carries the refresh_token we need server-side.
- Helpers in `_spotify-ingestion.ts` instead of inline so the
  client-triggered path (`?action=recompute`) and the cron share one
  ingestion implementation. Underscore prefix keeps the Vercel
  function count at 12/12.
- Manual trigger via `?action=recompute-all` folded into the
  existing `/api/scores.ts` rather than a new route — same 12/12
  constraint. `CRON_SECRET` is reused, no new env var.

**Manual steps required**

1. Confirm `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `CRON_SECRET`, and (optionally) `SPOTIFY_CLIENT_ID` are set on
   Vercel. The Spotify client_id has a hardcoded fallback matching
   the browser PKCE client_id.
2. After deploy, disconnect + reconnect Spotify in the profile
   dropdown to grant the new `user-read-recently-played` scope.
3. Fire the manual recompute once to populate initial data:
   `curl -X POST https://mheu.lol/api/scores?action=recompute-all -H "Authorization: Bearer $CRON_SECRET"`
4. After that, daily cron at `0 0 * * *` UTC keeps it warm.

**Files**

- New: `web/api/_spotify-ingestion.ts`
- Modified: `web/api/cron/recompute.ts` (full rewrite)
- Modified: `web/api/scores.ts` (replace `syncSpotifyData` with
  helper call; add `handleRecomputeAll`)
- Modified: `web/src/services/spotify/auth.ts` (scope)

**Audit**: `.claude/memory/progress/scores-broken-audit.md`
