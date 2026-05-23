-- Keepalive table — single row pinged by client + daily cron to prevent
-- Supabase free-tier auto-pause after 7 days of inactivity.

create table if not exists public.keepalive (
  id int primary key default 1,
  last_pinged_at timestamptz not null default now(),
  ping_count bigint not null default 0,
  constraint keepalive_singleton check (id = 1)
);

insert into public.keepalive (id, last_pinged_at, ping_count)
values (1, now(), 0)
on conflict (id) do nothing;

alter table public.keepalive enable row level security;

-- Anyone (anon or authed) may read + update the single row. This is intentional:
-- the goal is to register activity from any client visit.
drop policy if exists "keepalive select all" on public.keepalive;
create policy "keepalive select all" on public.keepalive
  for select using (true);

drop policy if exists "keepalive update all" on public.keepalive;
create policy "keepalive update all" on public.keepalive
  for update using (true) with check (id = 1);
