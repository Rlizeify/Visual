# Decision: Admin Role + First-Admin Bootstrap

**Date**: 2026-05-08
**Status**: Accepted
**Context**: `/admin` route requires a back-door auth path gated by `profiles.is_admin`. There must be a way to seed the very first admin (CB) without exposing privilege-escalation primitives to the client.

## Schema

`profiles.is_admin boolean default false` (migration `20260508000006_add_admin_role.sql`).

## Authorization helper

`public.is_admin(uid uuid) returns boolean` — SECURITY DEFINER, STABLE. Used inside
RLS policies to grant admin SELECT on every user-data table without recursing
through the table's own RLS (the SECURITY DEFINER bypass is what avoids the
"self-only policy returns 0 rows when checking yourself as admin" loop).

Granted to `authenticated` and `service_role`. Revoked from `anon` and `public`.

## Additive RLS policies

Per-table "Admins can read all ..." policies are added on top of the existing
self-only policies. PostgreSQL ORs permissive policies on the same command, so
non-admins keep their self-only access and admins get cross-row read.

## Bootstrap

`public.bootstrap_admin(email_in text) returns uuid` — SECURITY DEFINER,
PLPGSQL, looks up `auth.users.email`, sets `profiles.is_admin = true`.

Granted **only** to `service_role`. Explicitly revoked from `anon`,
`authenticated`, and `public`. The browser never has the service role key
(see Vercel env vars: `SUPABASE_SERVICE_ROLE_KEY` server-side only), so a
compromised account on the client cannot self-promote even if it discovers
the function name.

### How to call it (one-time, per environment)

1. Supabase dashboard → SQL Editor (the editor runs as `postgres` /
   `service_role`).
2. Run:

   ```sql
   select public.bootstrap_admin('cbauschek@gmail.com');
   ```

3. Verify:

   ```sql
   select id, display_name, is_admin
     from public.profiles
    where is_admin = true;
   ```

After CB is seeded, additional admins can be created via the future admin
console (Phase 2 — data tables) which will edit `profiles.is_admin` server-side
through a service-role edge function.

## Rationale — why a SQL function and not a one-off `update`

A function is named, idempotent, error-checking (raises on missing user/profile
row), and copy-pasteable into the SQL editor without parameter substitution
mistakes. It's also discoverable in `pg_proc` for anyone auditing how admin
status was created.

## Brute-force protection — current state

`/admin/login` uses a **client-side** counter (localStorage) that locks the
form for 15 minutes after 5 failed attempts from the same browser. This is a
stopgap, not a real defense:

- Trivially bypassed by clearing localStorage or using a private window.
- Does nothing against attackers hitting the Supabase auth endpoint directly.

Real rate limiting requires either:

- A Vercel edge function in front of Supabase auth that tracks failed attempts
  by IP in a KV store (Upstash, Vercel KV) and returns 429 on excess.
- Or Supabase's built-in rate limiting, which only kicks in at much higher
  thresholds and is account-wide rather than IP-bounded.

Track this as a follow-up before any real users (other than CB) exist.

## Why /admin/login is its own page rather than a flag on /login

Two reasons:

1. Visual confusion: the regular login is Frutiger Aero glass over the
   groovy wave; the admin login is a deliberately stark monospace terminal.
   Mounting them in the same page would force a styling branch.
2. Operational separation: the URL path itself signals "this is the privileged
   gate," which is useful for log greppability and for preventing the regular
   user-facing flow from accidentally surfacing admin-specific errors.

Both pages talk to the same Supabase session — there is no separate auth
backend. The `/admin` route just additionally checks `is_admin = true` after
authentication.
