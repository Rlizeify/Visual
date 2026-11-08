-- Fund ledger: the shared spreadsheet behind /fund.
--
-- STATUS: APPLIED 2026-11-08 (owner, SQL Editor; verified: 2 members,
-- RLS + 10 policies, both triggers, Realtime).
--
-- fund_members  the people with capital accounts (stone, cayden). Order and
--               labels for the UI. Changed by admins only (service role).
-- fund_entries  one row per deposit, withdrawal or monthly unrealized
--               gain/loss. Deposits/withdrawals split by `split`
--               ({member user_id: percent}, must total 100) or equally when
--               null. Gains are shared in proportion to each member's balance
--               just before the gain (src/features/fund/lib/ledger.ts).
-- fund_entry_history  every insert/update/delete with who and when,
--               written by trigger; clients can read it, never write it.
--
-- Access: anyone with the 'fund' grant reads and edits entries (owner
-- decision 2026-11-08: both members edit, with history).
--
-- Seed: the starting rows (2025-01-01 on) were loaded once from the owner's
-- private statement and are NOT kept here — this repository is public.
-- Financial data lives only in the database.

BEGIN;

-- ── members ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fund_members (
  user_id  uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  label    text NOT NULL CHECK (length(label) BETWEEN 1 AND 40),
  position int  NOT NULL DEFAULT 0,
  added_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fund_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fund_members FROM anon, authenticated;
GRANT SELECT ON public.fund_members TO authenticated;
DROP POLICY IF EXISTS "Fund users read members" ON public.fund_members;
CREATE POLICY "Fund users read members" ON public.fund_members
  FOR SELECT TO authenticated USING ((SELECT public.has_feature('fund')));

INSERT INTO public.fund_members (user_id, label, position)
SELECT id, initcap(username), CASE username WHEN 'stone' THEN 0 ELSE 1 END
FROM public.profiles WHERE username IN ('stone', 'cayden')
ON CONFLICT DO NOTHING;

-- ── entries ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fund_entries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL CHECK (entry_date >= '2025-01-01'),
  kind       text NOT NULL CHECK (kind IN ('deposit', 'withdrawal', 'gain')),
  amount     numeric(14, 2) NOT NULL CHECK (abs(amount) < 100000000000),
  note       text CHECK (note IS NULL OR length(note) <= 200),
  split      jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz,
  CHECK (kind = 'gain' OR amount > 0),
  CHECK (kind <> 'gain' OR split IS NULL)
);
CREATE INDEX IF NOT EXISTS fund_entries_date_idx ON public.fund_entries (entry_date);

-- Stamps the author (not client-settable) and validates `split`.
CREATE OR REPLACE FUNCTION public.fund_entries_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE k text; v jsonb; total numeric := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.created_at := now();
    NEW.updated_by := NULL;
    NEW.updated_at := NULL;
  ELSE
    NEW.id := OLD.id;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
  END IF;
  IF NEW.entry_date > current_date + 31 THEN
    RAISE EXCEPTION 'entry_date is too far in the future' USING ERRCODE = '22007';
  END IF;
  IF NEW.split IS NOT NULL THEN
    IF jsonb_typeof(NEW.split) <> 'object' THEN
      RAISE EXCEPTION 'split must be an object of member id to percent' USING ERRCODE = '22023';
    END IF;
    FOR k, v IN SELECT * FROM jsonb_each(NEW.split) LOOP
      IF NOT EXISTS (SELECT 1 FROM public.fund_members WHERE user_id::text = k) THEN
        RAISE EXCEPTION 'split names someone who is not a fund member' USING ERRCODE = '22023';
      END IF;
      IF jsonb_typeof(v) <> 'number' OR (v::text)::numeric < 0 OR (v::text)::numeric > 100 THEN
        RAISE EXCEPTION 'split percents must be numbers from 0 to 100' USING ERRCODE = '22023';
      END IF;
      total := total + (v::text)::numeric;
    END LOOP;
    IF abs(total - 100) > 0.01 THEN
      RAISE EXCEPTION 'split percents must total 100' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS fund_entries_before_write ON public.fund_entries;
CREATE TRIGGER fund_entries_before_write
  BEFORE INSERT OR UPDATE ON public.fund_entries
  FOR EACH ROW EXECUTE FUNCTION public.fund_entries_before_write();

ALTER TABLE public.fund_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fund_entries FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fund_entries TO authenticated;
DROP POLICY IF EXISTS "Fund users read entries" ON public.fund_entries;
DROP POLICY IF EXISTS "Fund users add entries" ON public.fund_entries;
DROP POLICY IF EXISTS "Fund users edit entries" ON public.fund_entries;
DROP POLICY IF EXISTS "Fund users delete entries" ON public.fund_entries;
CREATE POLICY "Fund users read entries" ON public.fund_entries
  FOR SELECT TO authenticated USING ((SELECT public.has_feature('fund')));
CREATE POLICY "Fund users add entries" ON public.fund_entries
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.has_feature('fund')));
CREATE POLICY "Fund users edit entries" ON public.fund_entries
  FOR UPDATE TO authenticated USING ((SELECT public.has_feature('fund')))
  WITH CHECK ((SELECT public.has_feature('fund')));
CREATE POLICY "Fund users delete entries" ON public.fund_entries
  FOR DELETE TO authenticated USING ((SELECT public.has_feature('fund')));

-- Seed rows intentionally omitted (see header).

-- ── history ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fund_entry_history (
  id       bigserial PRIMARY KEY,
  entry_id uuid NOT NULL,
  action   text NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  before   jsonb,
  after    jsonb,
  actor    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fund_entry_history_at_idx ON public.fund_entry_history (at DESC);
ALTER TABLE public.fund_entry_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fund_entry_history FROM anon, authenticated;
GRANT SELECT ON public.fund_entry_history TO authenticated;
DROP POLICY IF EXISTS "Fund users read history" ON public.fund_entry_history;
CREATE POLICY "Fund users read history" ON public.fund_entry_history
  FOR SELECT TO authenticated USING ((SELECT public.has_feature('fund')));

-- Definer so clients need no write grant on the history table.
CREATE OR REPLACE FUNCTION public.fund_entries_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.fund_entry_history (entry_id, action, before, after, actor)
  VALUES (
    coalesce(NEW.id, OLD.id),
    lower(TG_OP),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    auth.uid()
  );
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.fund_entries_log() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fund_entries_before_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS fund_entries_log ON public.fund_entries;
CREATE TRIGGER fund_entries_log
  AFTER INSERT OR UPDATE OR DELETE ON public.fund_entries
  FOR EACH ROW EXECUTE FUNCTION public.fund_entries_log();

-- ── feature gate (house rule: RESTRICTIVE on every feature table) ───────
DROP POLICY IF EXISTS "Feature gate" ON public.fund_members;
CREATE POLICY "Feature gate" ON public.fund_members AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.has_feature('fund'))) WITH CHECK ((SELECT public.has_feature('fund')));
DROP POLICY IF EXISTS "Feature gate" ON public.fund_entries;
CREATE POLICY "Feature gate" ON public.fund_entries AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.has_feature('fund'))) WITH CHECK ((SELECT public.has_feature('fund')));
DROP POLICY IF EXISTS "Feature gate" ON public.fund_entry_history;
CREATE POLICY "Feature gate" ON public.fund_entry_history AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.has_feature('fund'))) WITH CHECK ((SELECT public.has_feature('fund')));

-- Live updates between the two members (RLS still applies to Realtime).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                     WHERE pubname = 'supabase_realtime' AND tablename = 'fund_entries') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fund_entries;
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
