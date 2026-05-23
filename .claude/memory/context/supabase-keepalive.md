# Supabase Keepalive

Supabase free tier auto-pauses projects after 7 days of inactivity. The keepalive system guarantees at least one write per day so the project never sleeps.

## Architecture

Two redundant pings, both writing to `public.keepalive` (single-row table):

1. **Client-side** (`web/src/lib/keepalive.ts`)
   - Fires once per visit from `App.tsx` (mount effect, session-scoped flag).
   - Uses anon key + permissive RLS policy on `keepalive` table.
   - Wrapped in try/catch — failures log and never bubble.

2. **Server-side** (folded into `web/api/cron/recompute.ts`)
   - Runs daily at `0 0 * * *` (Vercel Hobby tier allows daily-only crons).
   - Pings keepalive **first**, before user iteration, so it runs even when no users have Spotify connections.
   - Uses service-role key (bypasses RLS).

### Why folded into recompute.ts?

The Vercel project is at the Hobby tier 12-function limit. Adding a standalone `/api/keepalive.ts` would push to 13 functions and break deploys. Since `cron/recompute.ts` already runs daily, embedding the ping there is the cleanest no-cost backup.

## Schema

Migration: `web/supabase/migrations/20260522000001_keepalive.sql`

```sql
create table public.keepalive (
  id int primary key default 1,
  last_pinged_at timestamptz not null default now(),
  ping_count bigint not null default 0,
  constraint keepalive_singleton check (id = 1)
);
```

RLS enabled; permissive select/update policies for anon role (the table holds no sensitive data — only a heartbeat).

## Verification

In the Supabase dashboard SQL editor:

```sql
select id, last_pinged_at, ping_count, now() - last_pinged_at as age
from public.keepalive;
```

- `age` should be < 24h if the cron is running.
- `ping_count` should climb with every visit + every daily cron run.

## Failure Modes

| Symptom | Likely cause | Fix |
|---|---|---|
| `age` > 7 days | Cron not running AND no visitors | Check Vercel cron dashboard; manually hit `/api/cron/recompute` |
| `age` < 24h but `ping_count` flat | Update RLS blocking writes | Re-apply the migration's policies |
| Client errors in browser console | Anon key wrong or RLS misconfigured | Check `VITE_SUPABASE_ANON_KEY` and policies |
| Project still paused | Migration never applied to production | Apply migration via Supabase dashboard SQL editor |

## Deployment Checklist

- [ ] Run migration `20260522000001_keepalive.sql` against the production Supabase project.
- [ ] Verify table exists: `select * from public.keepalive`.
- [ ] Confirm next daily cron run increments `ping_count`.
- [ ] Optional: visit mheu.lol and confirm `ping_count` ticks up immediately.
