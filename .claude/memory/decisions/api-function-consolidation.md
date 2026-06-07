# API Function Consolidation — Design Doc

**Date**: 2026-06-06
**Commits**: `<c1>` auth+oauth, `<c2>` scores+settings+health,
`<c3>` admin x6, `<c4>` cron, `<c5>` cleanup+docs
(see `progress/changelog.md` for SHAs)

## Problem

Vercel Hobby tier caps a project at **12 serverless functions**. As of
the May 2026 state, `web/api/` had **exactly 12**:

| # | File | Purpose |
|---|------|---------|
| 1 | `api/auth.ts` | login / lookup-email / reset-password |
| 2 | `api/oauth.ts` | Spotify + Discord + Strava + MyNetDiary OAuth |
| 3 | `api/scores.ts` | score read/write, recompute-all action |
| 4 | `api/settings.ts` | per-user visibility + accent settings |
| 5 | `api/health.ts` | env-var smoke endpoint for deploy ritual |
| 6 | `api/admin/users.ts` | user CRUD + password reset/set |
| 7 | `api/admin/leaderboard.ts` | leaderboard CRUD + score visibility |
| 8 | `api/admin/tooltips.ts` | tooltip defaults + overrides |
| 9 | `api/admin/scoring.ts` | weights + formula config |
| 10 | `api/admin/presets.ts` | visualizer preset display names |
| 11 | `api/admin/oauth.ts` | view + revoke OAuth connections |
| 12 | `api/cron/recompute.ts` | daily Spotify ingestion + scoring |

Two prior features (Strava OAuth, Supabase keepalive) had to be folded
into existing handlers specifically to dodge the ceiling. The next
feature with its own endpoint would force a Pro upgrade or yet another
fold-in scramble.

## Solution

Two dispatcher functions, both in `web/api/`:

### `api/index.ts` — user + admin dispatcher

Reads `req.query._route`. Routes:

```
auth, oauth, scores, settings, health
admin.users, admin.leaderboard, admin.tooltips,
admin.scoring, admin.presets, admin.oauth
```

Admin routes detected by `admin.` prefix; handed to `adminDispatch`
which switches on the suffix.

### `api/cron.ts` — scheduled-job dispatcher

CRON_SECRET bearer check at the top (production + secret-present
gate). Then reads `req.query.job`. Currently:

```
recompute
```

### Handlers

Live under `web/api/_handlers/`:

```
_handlers/
  auth.ts
  oauth.ts
  scores.ts
  settings.ts
  health.ts
  admin/
    users.ts
    leaderboard.ts
    tooltips.ts
    scoring.ts
    presets.ts
    oauth.ts
  cron/
    recompute.ts
```

Each exports a **named** `handler` (not default) so the dispatcher
can import them by name. Underscore-prefix on `_handlers/` excludes
the directory from Vercel's function deploy — the files ship as
plain TS modules.

### Rewrites (preserves all frontend URLs)

`web/vercel.json`:

```jsonc
{
  "rewrites": [
    { "source": "/api/auth",             "destination": "/api/index?_route=auth" },
    { "source": "/api/oauth",            "destination": "/api/index?_route=oauth" },
    { "source": "/api/scores",           "destination": "/api/index?_route=scores" },
    { "source": "/api/settings",         "destination": "/api/index?_route=settings" },
    { "source": "/api/health",           "destination": "/api/index?_route=health" },
    { "source": "/api/admin/users",        "destination": "/api/index?_route=admin.users" },
    { "source": "/api/admin/leaderboard",  "destination": "/api/index?_route=admin.leaderboard" },
    { "source": "/api/admin/tooltips",     "destination": "/api/index?_route=admin.tooltips" },
    { "source": "/api/admin/scoring",      "destination": "/api/index?_route=admin.scoring" },
    { "source": "/api/admin/presets",      "destination": "/api/index?_route=admin.presets" },
    { "source": "/api/admin/oauth",        "destination": "/api/index?_route=admin.oauth" },
    { "source": "/api/(.*)",             "destination": "/api/$1" },
    /* SPA fallbacks */
  ],
  "crons": [
    { "path": "/api/cron?job=recompute", "schedule": "0 0 * * *" }
  ]
}
```

The frontend never had to change — every existing
`fetch('/api/...')` call still works. Vercel's rewrite engine merges
the synthetic `_route` query param with whatever the client already
passed (`?action=...`, `?provider=...`).

### Why `_route` and not `?action=`

Every handler already uses `?action=` for sub-routing
(`lookup-email`, `reset-password`, `strava-sync`, `recompute-stale`,
`connect`, `disconnect`, `connections`, etc.). Reusing `action` for
the dispatcher would collide with handler-internal sub-routing on
the same query key. `_route` is a synthetic namespace the dispatcher
owns; the underscore signals "internal — handlers don't read this".

## Final shape

Vercel inspect after deploy:

```
λ api/cron  (291 KB)
λ api/index (434 KB)
```

**Exactly 2 functions.** 10-function headroom on Hobby tier.

## Gotchas locked in

### Two `_admin.ts` helpers (preserved as-is)

There are **two** files named `_admin.ts`:

- `web/api/_admin.ts` — **BIG**. Returns
  `{ supabase, user: { id, email }, isSuperAdmin }`. Used by 5 of 6
  admin handlers (`users, leaderboard, tooltips, scoring, oauth`).
  Exports `logAudit`, `methodNotAllowed` too.
- `web/api/admin/_admin.ts` — **SMALL**. Returns `{ userId }` only.
  Used by ONE handler: `_handlers/admin/presets.ts`. Exports
  `getAdminSupabase`.

Both helpers were preserved — the refactor was strictly a
move-and-rewire, no behavioral changes. `_handlers/admin/presets.ts`
carries an inline comment at the top documenting the footgun:

```ts
// presets is the ONLY admin handler that uses the SMALL requireAdmin
// (returns {userId}) at web/api/admin/_admin.ts. The other five use the
// BIG requireAdmin at web/api/_admin.ts (returns {supabase, user,
// isSuperAdmin}). Preserved as-is — admin.userId below depends on it.
```

If a future session unifies them, presets.ts will need to switch
from `admin.userId` to `ctx.user.id`.

### `web/api/admin/` directory still exists

It now holds ONE file: `_admin.ts` (the SMALL variant). Empty-ish
but harmless — Vercel ignores underscore-prefixed files regardless
of parent directory. Not promoted to a top-level helper because
that would force a path/name rename and ripple through the inline
comment + presets import.

### CRON_SECRET moved up

The gate originally lived inside `cron/recompute.ts`. After
consolidation it sits in `api/cron.ts`:

```ts
const cronSecret = req.headers['authorization']
const expectedSecret = process.env.CRON_SECRET
if (process.env.NODE_ENV === 'production' && expectedSecret && cronSecret !== `Bearer ${expectedSecret}`) {
  return res.status(401).json({ error: 'Unauthorized' })
}
```

So every future job under `/api/cron?job=...` shares one gate. The
recompute handler now assumes auth already passed.

### Per-handler auth NOT moved

User + admin dispatcher `api/index.ts` does NOT pre-validate. Each
handler runs its own `requireAdmin` / `requireAuth` / public-allowed
logic. Moving auth into the dispatcher would break **public**
endpoints like leaderboard GET, presets GET, oauth callbacks, and
the auth handler's own login flow.

### `recomputeUserFromSpotify` export

The function is exported from `_handlers/cron/recompute.ts` but
only used internally (line 273 of the same file). Preserved as a
named export in case a future on-demand path wants to import it
cheaply.

### `/api/scores?action=recompute-all` untouched

Manual recompute trigger lives in `scores.ts`, not the cron handler.
Refactor did not change it; it still works through the same
`/api/index?_route=scores&action=recompute-all` rewrite path.

## Migration record

Five commits, all on `main`, each bisectable, each with its own
production deploy:

1. **auth + oauth** — moved to `_handlers/`, dispatcher created
2. **scores + settings + health** — added to dispatcher
3. **admin x6** — all six admin handlers moved
4. **cron** — `cron.ts` dispatcher + recompute handler moved,
   CRON_SECRET gate moved up
5. **cleanup + docs** — CLAUDE.md updated, this doc written

No commit was reverted. Each was smoke-checked in production before
the next began.
