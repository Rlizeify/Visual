# Decision: Admin Data Console Architecture

**Date**: 2026-05-08
**Status**: Accepted (Phase 1 — backend; UI in subsequent commits)
**Context**: `/admin` needs a tabbed UI that views and edits every user-related table — profiles, oauth_connections, life_score_derivatives — plus password reset, user delete, and a leaderboard configuration that drives the public `/u` tab.

## Service-role boundary

The browser holds only the Supabase **anon** key. The **service role** key never leaves Vercel (env var `SUPABASE_SERVICE_ROLE_KEY`). Every admin write goes through `web/api/admin/*` serverless functions which:

1. Read `Authorization: Bearer <jwt>` from the request.
2. Validate the JWT via `supabase.auth.getUser(token)` using the service-role client.
3. Look up `profiles.is_admin` for the resolved user.id.
4. Return 401/403 if either check fails; otherwise execute the operation.

This means a leaked client bundle still cannot escalate — the worst case is a non-admin user calling `/api/admin/*` and getting 403.

The shared helper that does all of this is [_admin.ts](../../../web/api/_admin.ts):

- `requireAdmin(req, res)` → `AdminContext | null`
- `logAudit(ctx, args)` → records every write
- `methodNotAllowed(res, allowed)`

## Audit log

Every admin write inserts a row into `public.audit_log` with `before` and `after` JSON snapshots so we can reconstruct what changed and roll back if needed. The log is append-only — no admin write/update/delete policy, only a SELECT policy gated by `public.is_admin(auth.uid())`. Inserts happen via the service-role client which bypasses RLS, so the table is effectively write-once-from-server.

`logAudit` is best-effort: a logging failure is `console.error`'d but does not roll back the user-visible action that just succeeded. The trade-off is "rare missing audit row" vs. "the UI says it failed when it actually worked"; the latter is worse.

`force_set_password` deliberately does **not** record the new password in the audit `after` column. The fact-of-event and target user are recorded; the value is not.

## Super-admin gating for `force_set_password`

`POST /api/admin/set-password` is the only endpoint that wraps the most dangerous Supabase admin primitive (overwrite a user's password without a recovery email). It is gated to a single super admin identified by **email**, hardcoded as `SUPER_ADMIN_EMAIL = 'stone.gaunce@gmail.com'` in `web/api/_admin.ts`.

Email vs. user_id: chose email because `user_id` is per-Supabase-project (the bootstrap returned a fresh UUID; a different env would have a different one). Email is operationally stable and survives schema rebuilds. If CB ever changes email, the constant change is audit-trail-worthy in code review.

The UI hides the button entirely for non-super admins (cosmetic), and the endpoint additionally returns 403 if a regular admin attempts the call (real defense).

## Leaderboard replace strategy

`PUT /api/admin/leaderboard` accepts the full slot list and **replaces** the table contents (delete-all then insert). The table is admin-managed, ≤ ~10 rows in practice, so the cost is negligible and the semantics ("the slots you sent are now the slots") are easier to reason about than diff-and-patch. RLS-protected rows are non-issue because the service-role client bypasses RLS.

`/u` reads visible rows directly via the anon client; the public-read RLS policy makes that work without any session.

## File layout

```
web/api/admin/
  users.ts                                  GET (list)
  users/[id].ts                             PATCH (update profile fields), DELETE (cascades)
  reset-password.ts                         POST { email } — sends recovery link via Supabase
  set-password.ts                           POST { user_id, new_password } — super admin only
  oauth.ts                                  GET (list)
  oauth/[id].ts                             DELETE (only our row, NOT the upstream grant)
  life-scores.ts                            GET (list)
  life-scores/[user_id]/[metric].ts         PATCH (derivative values)
  leaderboard.ts                            GET, PUT (replace)
```

`web/api/_admin.ts` is the shared helper. `web/src/lib/adminApi.ts` is the browser-side fetch wrapper that attaches the JWT.

## Username column

Migration 7 also adds `profiles.username text` (unique-when-present partial index) so the Users tab can edit username + display_name + is_admin together. Folded into the leaderboard migration to keep the migration count to the two specified by the spec.

## Open follow-ups

- **Recompute life scores**: the UI has a "Recompute" button that's a placeholder. It should call a future Edge Function that re-derives `position/velocity/acceleration/jerk/snap` from `life_score_samples`. Out of scope for this phase.
- **OAuth provider revoke**: disconnecting only removes our row; the upstream grant on Spotify/Discord/etc remains valid until the user revokes it themselves. Documented in the endpoint comment and in the UI confirm dialog.
- **Server-side rate limit on /admin/login**: still a stopgap localStorage counter. See [admin-bootstrap.md](admin-bootstrap.md).
