-- Casino: play-money chips, shared tables, chip requests.
--
-- STATUS: APPLIED 2026-11-08 (owner, SQL Editor; verified in pg_catalog: 6 tables
-- with RLS, 7 functions with service-role-only grants except casino_wallet and
-- casino_request_chips, 4 tables in Realtime, 4 seeded tables).
--
-- No real money: chips never convert to anything.
--
-- casino_wallets        one chip balance per account. Created on first visit
--                       by casino_wallet(): 50,000 chips, or 0 for fund
--                       members (they bring their share over instead, see
--                       casino_fund_pull). Owner reads own row only.
-- casino_chip_log       every chip movement (bets, payouts, grants, pulls).
--                       Owner reads own rows only.
-- casino_chip_requests  "please send chips" requests. Players file them with
--                       casino_request_chips(); super admins decide through
--                       /api/admin/casino (service role).
-- casino_tables         one row per table: public state only (seats, bets,
--                       face-up cards, pots, whose turn). Shared tables have
--                       owner NULL and are readable by every signed-in user;
--                       solo games (Ride the Bus) have owner = the player.
-- casino_secrets        the shoe/deck and dealer hole card. No client grants
--                       at all: only the API (service role) reads it.
-- casino_hands          private hole cards (Hold'em), one row per player per
--                       table, readable only by that player.
--
-- Dealing is server-authoritative: the API (api/_handlers/casino.ts) loads a
-- table, applies one action with the game engine in src/features/casino/lib,
-- and writes the result with casino_commit(), which checks the table version
-- (optimistic lock) and moves chips in the same transaction.

BEGIN;

-- ── wallets ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.casino_wallets (
  user_id             uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  chips               bigint NOT NULL DEFAULT 0 CHECK (chips >= 0 AND chips < 1000000000000),
  fund_pulled_through date,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.casino_wallets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.casino_wallets FROM anon, authenticated;
GRANT SELECT ON public.casino_wallets TO authenticated;
DROP POLICY IF EXISTS "Players read own wallet" ON public.casino_wallets;
CREATE POLICY "Players read own wallet" ON public.casino_wallets
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.casino_chip_log (
  id       bigserial PRIMARY KEY,
  user_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delta    bigint NOT NULL,
  balance  bigint NOT NULL,
  reason   text NOT NULL CHECK (length(reason) <= 80),
  table_id text,
  at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS casino_chip_log_user_idx ON public.casino_chip_log (user_id, at DESC);
ALTER TABLE public.casino_chip_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.casino_chip_log FROM anon, authenticated;
GRANT SELECT ON public.casino_chip_log TO authenticated;
DROP POLICY IF EXISTS "Players read own chip log" ON public.casino_chip_log;
CREATE POLICY "Players read own chip log" ON public.casino_chip_log
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- ── chip requests ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.casino_chip_requests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount     bigint NOT NULL CHECK (amount > 0 AND amount <= 10000000),
  note       text CHECK (note IS NULL OR length(note) <= 200),
  status     text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  granted    bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at timestamptz
);
CREATE INDEX IF NOT EXISTS casino_chip_requests_status_idx ON public.casino_chip_requests (status, created_at DESC);
-- One open request per player.
CREATE UNIQUE INDEX IF NOT EXISTS casino_chip_requests_one_pending
  ON public.casino_chip_requests (user_id) WHERE status = 'pending';
ALTER TABLE public.casino_chip_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.casino_chip_requests FROM anon, authenticated;
GRANT SELECT ON public.casino_chip_requests TO authenticated;
DROP POLICY IF EXISTS "Players read own chip requests" ON public.casino_chip_requests;
CREATE POLICY "Players read own chip requests" ON public.casino_chip_requests
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- ── tables ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.casino_tables (
  id         text PRIMARY KEY CHECK (length(id) <= 64),
  game       text NOT NULL CHECK (game IN ('blackjack', 'holdem', 'ridethebus')),
  name       text NOT NULL CHECK (length(name) <= 40),
  owner      uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  version    int  NOT NULL DEFAULT 0,
  state      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.casino_tables ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.casino_tables FROM anon, authenticated;
GRANT SELECT ON public.casino_tables TO authenticated;
DROP POLICY IF EXISTS "Players read shared and own tables" ON public.casino_tables;
CREATE POLICY "Players read shared and own tables" ON public.casino_tables
  FOR SELECT TO authenticated USING (owner IS NULL OR owner = (SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.casino_secrets (
  table_id text PRIMARY KEY REFERENCES public.casino_tables(id) ON DELETE CASCADE,
  secret   jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.casino_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.casino_secrets FROM anon, authenticated;
-- No policies: only the service role (which bypasses RLS) reads it.

CREATE TABLE IF NOT EXISTS public.casino_hands (
  table_id text NOT NULL REFERENCES public.casino_tables(id) ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hand_no  int  NOT NULL,
  cards    jsonb NOT NULL,
  PRIMARY KEY (table_id, user_id)
);
ALTER TABLE public.casino_hands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.casino_hands FROM anon, authenticated;
GRANT SELECT ON public.casino_hands TO authenticated;
DROP POLICY IF EXISTS "Players read own hole cards" ON public.casino_hands;
CREATE POLICY "Players read own hole cards" ON public.casino_hands
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

INSERT INTO public.casino_tables (id, game, name) VALUES
  ('bj-1', 'blackjack', 'Blackjack · North'),
  ('bj-2', 'blackjack', 'Blackjack · South'),
  ('holdem-1', 'holdem', 'Hold''em · 50/100'),
  ('holdem-2', 'holdem', 'Hold''em · 250/500')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.casino_secrets (table_id)
SELECT id FROM public.casino_tables ON CONFLICT DO NOTHING;

-- ── functions ───────────────────────────────────────────────────────────

-- The caller's wallet, created on first call. Fund members start at 0.
CREATE OR REPLACE FUNCTION public.casino_wallet()
RETURNS public.casino_wallets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE uid uuid := auth.uid(); w public.casino_wallets; start bigint;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000'; END IF;
  SELECT * INTO w FROM public.casino_wallets WHERE user_id = uid;
  IF FOUND THEN RETURN w; END IF;
  start := CASE WHEN EXISTS (SELECT 1 FROM public.fund_members WHERE user_id = uid) THEN 0 ELSE 50000 END;
  INSERT INTO public.casino_wallets (user_id, chips) VALUES (uid, start)
  ON CONFLICT (user_id) DO NOTHING;
  IF start > 0 THEN
    INSERT INTO public.casino_chip_log (user_id, delta, balance, reason) VALUES (uid, start, start, 'starting chips');
  END IF;
  SELECT * INTO w FROM public.casino_wallets WHERE user_id = uid;
  RETURN w;
END $$;
REVOKE EXECUTE ON FUNCTION public.casino_wallet() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.casino_wallet() TO authenticated;

-- File a chip request (one pending at a time).
CREATE OR REPLACE FUNCTION public.casino_request_chips(p_amount bigint, p_note text)
RETURNS public.casino_chip_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE uid uuid := auth.uid(); r public.casino_chip_requests;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000'; END IF;
  IF EXISTS (SELECT 1 FROM public.casino_chip_requests WHERE user_id = uid AND status = 'pending') THEN
    RAISE EXCEPTION 'You already have a request waiting' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.casino_chip_requests (user_id, amount, note)
  VALUES (uid, p_amount, nullif(btrim(p_note), ''))
  RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE EXECUTE ON FUNCTION public.casino_request_chips(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.casino_request_chips(bigint, text) TO authenticated;

-- Moves chips for one user inside the caller's transaction. `need` is the
-- balance the user must have before the move (a stake), so a net-positive
-- spin still requires the chips that were staked. Internal only.
CREATE OR REPLACE FUNCTION public.casino_move_chips(p_user uuid, p_delta bigint, p_need bigint, p_reason text, p_table text)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE bal bigint;
BEGIN
  INSERT INTO public.casino_wallets (user_id, chips) VALUES (p_user, 0) ON CONFLICT DO NOTHING;
  UPDATE public.casino_wallets
     SET chips = chips + p_delta, updated_at = now()
   WHERE user_id = p_user AND chips >= greatest(p_need, -p_delta, 0)
  RETURNING chips INTO bal;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not enough chips' USING ERRCODE = 'P0001', HINT = 'casino_chips'; END IF;
  IF p_delta <> 0 THEN
    INSERT INTO public.casino_chip_log (user_id, delta, balance, reason, table_id)
    VALUES (p_user, p_delta, bal, left(p_reason, 80), p_table);
  END IF;
  RETURN bal;
END $$;

-- Writes one table move atomically.
--   p_table    table id, or NULL for a chips-only move (roulette).
--   p_version  version the move was computed from; mismatch → 40001.
--   p_hands    NULL = leave hole cards alone; otherwise the full set
--              {user_id: {hand_no, cards}} for the table (replaces all).
--   p_chips    [{user, delta, need, reason}]
-- Returns the new version (or 0 for a chips-only move).
CREATE OR REPLACE FUNCTION public.casino_commit(
  p_table text, p_version int, p_state jsonb, p_secret jsonb, p_hands jsonb, p_chips jsonb
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v int := 0; c jsonb; k text; h jsonb;
BEGIN
  IF p_table IS NOT NULL THEN
    UPDATE public.casino_tables
       SET state = p_state, version = version + 1, updated_at = now()
     WHERE id = p_table AND version = p_version
    RETURNING version INTO v;
    IF NOT FOUND THEN RAISE EXCEPTION 'table changed, retry' USING ERRCODE = '40001'; END IF;
    INSERT INTO public.casino_secrets (table_id, secret) VALUES (p_table, coalesce(p_secret, '{}'::jsonb))
    ON CONFLICT (table_id) DO UPDATE SET secret = EXCLUDED.secret;
    IF p_hands IS NOT NULL THEN
      DELETE FROM public.casino_hands WHERE table_id = p_table;
      FOR k, h IN SELECT * FROM jsonb_each(p_hands) LOOP
        INSERT INTO public.casino_hands (table_id, user_id, hand_no, cards)
        VALUES (p_table, k::uuid, (h->>'hand_no')::int, h->'cards');
      END LOOP;
    END IF;
  END IF;
  FOR c IN SELECT * FROM jsonb_array_elements(coalesce(p_chips, '[]'::jsonb)) LOOP
    PERFORM public.casino_move_chips((c->>'user')::uuid, (c->>'delta')::bigint,
      coalesce((c->>'need')::bigint, 0), coalesce(c->>'reason', 'play'), p_table);
  END LOOP;
  RETURN v;
END $$;

-- Creates (or returns) a player's solo table, e.g. Ride the Bus.
CREATE OR REPLACE FUNCTION public.casino_solo_table(p_user uuid, p_game text)
RETURNS public.casino_tables
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE t public.casino_tables; tid text := p_game || ':' || p_user::text;
BEGIN
  INSERT INTO public.casino_tables (id, game, name, owner) VALUES (tid, p_game, 'Solo', p_user)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.casino_secrets (table_id) VALUES (tid) ON CONFLICT DO NOTHING;
  SELECT * INTO t FROM public.casino_tables WHERE id = tid;
  RETURN t;
END $$;

-- Fund members: set chips to their own capital-account share. Allowed once
-- per ledger update — p_through (the newest fund entry date) must be later
-- than the last pull's. The API computes the share from the ledger.
CREATE OR REPLACE FUNCTION public.casino_fund_pull(p_user uuid, p_chips bigint, p_through date)
RETURNS public.casino_wallets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE w public.casino_wallets; before bigint;
BEGIN
  IF p_chips < 0 THEN RAISE EXCEPTION 'share is negative' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.casino_wallets (user_id, chips) VALUES (p_user, 0) ON CONFLICT DO NOTHING;
  SELECT * INTO w FROM public.casino_wallets WHERE user_id = p_user FOR UPDATE;
  IF w.fund_pulled_through IS NOT NULL AND w.fund_pulled_through >= p_through THEN
    RAISE EXCEPTION 'Already pulled for this month' USING ERRCODE = 'P0001', HINT = 'casino_pulled';
  END IF;
  before := w.chips;
  UPDATE public.casino_wallets
     SET chips = p_chips, fund_pulled_through = p_through, updated_at = now()
   WHERE user_id = p_user
  RETURNING * INTO w;
  INSERT INTO public.casino_chip_log (user_id, delta, balance, reason)
  VALUES (p_user, p_chips - before, p_chips, 'fund pull (balance reset)');
  RETURN w;
END $$;

-- Super admin decision on a chip request (the API checks the role).
CREATE OR REPLACE FUNCTION public.casino_decide_request(p_id uuid, p_approve boolean, p_amount bigint, p_admin uuid)
RETURNS public.casino_chip_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.casino_chip_requests;
BEGIN
  SELECT * INTO r FROM public.casino_chip_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found' USING ERRCODE = 'P0002'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'request already decided' USING ERRCODE = 'P0001'; END IF;
  IF p_approve THEN
    IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 10000000 THEN
      RAISE EXCEPTION 'amount must be 1 to 10,000,000' USING ERRCODE = '22023';
    END IF;
    PERFORM public.casino_move_chips(r.user_id, p_amount, 0, 'chips from the house', NULL);
  END IF;
  UPDATE public.casino_chip_requests
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'denied' END,
         granted = CASE WHEN p_approve THEN p_amount END,
         decided_by = p_admin, decided_at = now()
   WHERE id = p_id
  RETURNING * INTO r;
  RETURN r;
END $$;

REVOKE EXECUTE ON FUNCTION public.casino_move_chips(uuid, bigint, bigint, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.casino_commit(text, int, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.casino_solo_table(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.casino_fund_pull(uuid, bigint, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.casino_decide_request(uuid, boolean, bigint, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.casino_commit(text, int, jsonb, jsonb, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.casino_solo_table(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.casino_fund_pull(uuid, bigint, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.casino_decide_request(uuid, boolean, bigint, uuid) TO service_role;

-- Live table state + own hole cards (RLS still applies to Realtime).
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['casino_tables', 'casino_hands', 'casino_wallets', 'casino_chip_requests'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
