-- Public-read RLS for users on the visible leaderboard.
--
-- The /u tab needs to render names + derivative scores for every user on the
-- leaderboard, but the existing RLS on `profiles` and `life_score_derivatives`
-- only lets a user see their own rows. Without this migration, the /u
-- leaderboard would show only the viewer's own row.
--
-- Consent model: an admin opts a user in by inserting a `leaderboard_config`
-- row with `visible = true`. That admin write is the consent record. These
-- policies then expose the corresponding profile + derivatives to public
-- reads (anon + authenticated).
--
-- Spec listed migrations 7 + 8 only; this is a pragmatic addition because
-- the user spec ("wire the /u tab to leaderboard_config + life_score_derivatives")
-- isn't achievable under the existing RLS without it. Documented in
-- decisions/admin-data-console.md follow-ups.

create policy "Public can read leaderboard users' profiles"
  on public.profiles
  for select
  using (
    exists (
      select 1 from public.leaderboard_config
      where leaderboard_config.user_id = profiles.id
        and leaderboard_config.visible = true
    )
  );

create policy "Public can read leaderboard users' life score derivatives"
  on public.life_score_derivatives
  for select
  using (
    exists (
      select 1 from public.leaderboard_config
      where leaderboard_config.user_id = life_score_derivatives.user_id
        and leaderboard_config.visible = true
    )
  );
