-- Admin audit log. Every write through the admin edge functions inserts a
-- row. Read-only for admins (via RLS); writes happen with the service role
-- which bypasses RLS, so no insert/update/delete policy is needed.

create table if not exists public.audit_log (
  id bigserial primary key,
  admin_id uuid not null references auth.users(id) on delete restrict,
  action text not null,            -- e.g. 'update_profile', 'delete_user', 'reset_password'
  target_type text not null,       -- e.g. 'profile', 'oauth_connection', 'life_score_derivative'
  target_id text,                  -- foreign id as text — uuid, or composite like "user:metric"
  before jsonb,
  after jsonb,
  created_at timestamptz default now() not null
);

create index if not exists idx_audit_log_admin
  on public.audit_log(admin_id, created_at desc);
create index if not exists idx_audit_log_target
  on public.audit_log(target_type, target_id);
create index if not exists idx_audit_log_created
  on public.audit_log(created_at desc);

alter table public.audit_log enable row level security;

create policy "Admins can read audit log"
  on public.audit_log
  for select
  using (public.is_admin(auth.uid()));
