# Scoring Recompute Strategy

## Why not Vercel cron
Vercel Hobby is capped at one cron per day. That's the safety net, not the source of freshness.

## Real-time path
Position must move within minutes of activity, so the client drives recomputes:

1. **On every authenticated client load** — the U tab and E tab POST to `/api/scores?action=recompute` for the current user. Body includes `spotifyAccessToken` so the server can sync recently-played data before scoring.
2. **On `visibilitychange` to visible** on those tabs — same call.
3. **Leaderboard self-heal** — when the U tab renders, it asks the server to recompute any visible leaderboard user whose `user_scores.updated_at` is older than 5 minutes (`/api/scores?action=recompute-stale`). The server skips users with no Spotify connection.
4. **Spotify token refresh** — when the server-side refresh path exchanges a refresh token it also syncs recent plays and recomputes. (Today the client owns the refresh; once we move it server-side this trigger fires.)

## Server-side lock
`recompute_locks(user_id, last_computed_at)` enforces a 5-minute window. Calls that arrive within the window return `429 rate_limited` and do nothing. The lock is the only contention guard — clients can call as often as they like.

## Daily fallback
`/api/cron/recompute` still runs once a day at midnight UTC. It iterates `oauth_connections` and recomputes any user the client-driven path missed.

## Math
With even two active users hitting the site every few minutes, every active user gets a recompute well inside the 5-minute window. No paid cron required. The daily cron only matters for users who never open the site.

## Spotify data sync
Before scoring, the server fetches `https://api.spotify.com/v1/me/player/recently-played?limit=50` using the user's access token. Plays are inserted into `spotify_play_history` (idempotent on `user_id, track_id, played_at`). Daily aggregates are upserted into `user_listening_stats`. Then the scoring engine reads from those tables exactly as before.

If the client does not include a Spotify token, the server still computes from whatever data is in the tables — position will move on the next call that includes a token.
