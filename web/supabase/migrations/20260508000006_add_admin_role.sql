-- Admin role: add is_admin to profiles, helper function, RLS policies, bootstrap.

-- 1. Column
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- 2. Helper function: is_admin(uid). SECURITY DEFINER so it can read profiles
--    bypassing the row-level policy (otherwise the policy would recurse —
--    "is the caller admin?" → "look in profiles" → "self-only policy" → 0 rows).
--    STABLE because it's deterministic within a transaction.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = uid),
    false
  );
$$;

revoke execute on function public.is_admin(uuid) from public, anon;
grant  execute on function public.is_admin(uuid) to authenticated, service_role;

-- 3. Additive admin SELECT policies. Non-admins still hit the existing
--    "Users can read own ..." policies; PostgreSQL ORs together permissive
--    policies on the same command.
create policy "Admins can read all profiles"
  on public.profiles
  for select
  using (public.is_admin(auth.uid()));

create policy "Admins can read all oauth connections"
  on public.oauth_connections
  for select
  using (public.is_admin(auth.uid()));

create policy "Admins can read all life score samples"
  on public.life_score_samples
  for select
  using (public.is_admin(auth.uid()));

create policy "Admins can read all life score derivatives"
  on public.life_score_derivatives
  for select
  using (public.is_admin(auth.uid()));

-- 4. Bootstrap function — service-role only. Used once via the Supabase SQL
--    editor to seed the first admin (CB's account). Never expose to clients;
--    that would be a privilege-escalation hole.
--
--    Usage:
--      select public.bootstrap_admin('cb@example.com');
create or replace function public.bootstrap_admin(email_in text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_id uuid;
begin
  select id into target_id from auth.users where email = email_in;
  if target_id is null then
    raise exception 'bootstrap_admin: no user found with email %', email_in;
  end if;
  update public.profiles set is_admin = true where id = target_id;
  if not found then
    raise exception 'bootstrap_admin: no profile row for user % (%)', email_in, target_id;
  end if;
  return target_id;
end;
$$;

revoke execute on function public.bootstrap_admin(text) from public, anon, authenticated;
grant  execute on function public.bootstrap_admin(text) to service_role;
