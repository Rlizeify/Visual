-- Add is_admin column to profiles
alter table public.profiles
  add column if not exists is_admin boolean default false not null;

-- Helper function to check if a user is admin
-- Security definer so it runs as the function owner, not the caller
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = uid),
    false
  );
$$;

-- Grant execute to authenticated users (needed for RLS policies to call it)
grant execute on function public.is_admin(uuid) to authenticated;

-----------------------------------------------------------
-- Admin SELECT policies: admins can read all rows
-----------------------------------------------------------

-- profiles: admins can read all
create policy "Admins can read all profiles"
  on public.profiles
  for select
  using (public.is_admin(auth.uid()));

-- oauth_connections: admins can read all
create policy "Admins can read all oauth_connections"
  on public.oauth_connections
  for select
  using (public.is_admin(auth.uid()));

-- life_score_samples: admins can read all
create policy "Admins can read all life_score_samples"
  on public.life_score_samples
  for select
  using (public.is_admin(auth.uid()));

-- life_score_derivatives: admins can read all
create policy "Admins can read all life_score_derivatives"
  on public.life_score_derivatives
  for select
  using (public.is_admin(auth.uid()));

-----------------------------------------------------------
-- Bootstrap admin function (service role only)
-----------------------------------------------------------

-- Function to set a user as admin by email
-- Only callable via SQL editor or service role, not exposed to anon/authenticated
create or replace function public.bootstrap_admin(target_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_uid uuid;
begin
  -- Find user by email in auth.users
  select id into target_uid
  from auth.users
  where email = target_email;

  if target_uid is null then
    raise exception 'User with email % not found', target_email;
  end if;

  -- Set is_admin = true
  update public.profiles
  set is_admin = true
  where id = target_uid;

  if not found then
    raise exception 'Profile for user % not found', target_email;
  end if;
end;
$$;

-- Revoke execute from public roles - only service_role can call this
revoke execute on function public.bootstrap_admin(text) from anon;
revoke execute on function public.bootstrap_admin(text) from authenticated;
