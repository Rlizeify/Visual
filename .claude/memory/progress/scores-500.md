# /api/scores 500 — 2026-05-23

## Symptom
- `GET https://mheu.lol/api/scores` returns HTTP 500.
- Response body (98 bytes):
  ```json
  {"error":"Could not find a relationship between 'user_scores' and 'profiles' in the schema cache"}
  ```
- U-tab feed cannot render leaderboard or feed.
- `x-vercel-cache: MISS`, `Server: Vercel` — function is running.

## Root cause
PostgREST error code PGRST200. The leaderboard handler at
`web/api/scores.ts:handleLeaderboard` did:
```ts
.from('user_scores').select('..., profiles(username, avatar_url, accent_color)')
```
That nested-join syntax requires an explicit FK from `user_scores` to
`profiles`. The schema only has `user_scores.user_id REFERENCES auth.users(id)`.
Migration `20260509000004_add_profile_fks.sql` added FKs for four other
tables but missed `user_scores`.

## Fix (this commit)
1. `web/api/scores.ts:handleLeaderboard` now fetches profiles in a separate
   `.in('id', userIds)` query and merges client-side. Works without any
   schema change.
2. Top-level try/catch in the default `handler` returns
   `{ error: message, code }` JSON with status 500 instead of letting an
   unhandled error fall through. Future 500s are debuggable from the
   response body alone.
3. `[scores] request {method, action}` log at handler entry, plus
   `[scores] unhandled error` with stack on catch.
4. Migration `web/supabase/migrations/20260523000001_user_scores_profiles_fk.sql`
   adds the missing FK for future cleanliness. Optional to apply — the
   handler now works without it.

## Cookie warning (investigation summary)
`Cookie "__cf_bm" has been rejected for invalid domain` — Cloudflare
bot-management cookie. `git grep -i "__cf_bm"` in the repo returns no
matches, so nothing in our code sets it. Almost certainly originates from
Supabase's CF-fronted Auth or Storage endpoints. Browser rejects it
because the response domain doesn't match. Benign; ignored.

## Verification plan
- After deploy, hit `https://mheu.lol/api/scores` and confirm HTTP 200
  with `{ scores: [...] }`.
- Hit `https://mheu.lol/api/scores?action=events` and confirm HTTP 200.
- Load `https://mheu.lol/u` and confirm the leaderboard + feed render.
