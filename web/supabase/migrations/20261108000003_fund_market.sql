-- Fund page market + macro cache.
--
-- STATUS: APPLIED 2026-11-08 (owner, SQL Editor; verified: RLS, read policy, no client writes).
--
-- One row of public market data for /fund: S&P 500 monthly closes (the
-- benchmark), the 3-month T-bill and fed funds rates (risk-free rate for
-- Sharpe/Sortino) and CPI year over year (inflation default for recurring
-- what-if flows). Written only by the server (service role) from the
-- weekday market-snapshot cron and on demand by GET /api/fund-market;
-- read by accounts holding the 'fund' grant. Holds no fund numbers.

BEGIN;

CREATE TABLE IF NOT EXISTS public.fund_market (
  id             smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  benchmark      jsonb,                -- {"YYYY-MM": month-end close}
  benchmark_kind text CHECK (benchmark_kind IN ('total-return', 'price')),
  tbill_3m       numeric,              -- decimal, 0.042 = 4.2%
  fed_funds      numeric,              -- decimal
  rates_date     date,
  cpi_yoy        numeric,              -- decimal
  cpi_date       date,
  source         text NOT NULL DEFAULT '',
  fetched_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fund_market ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fund_market FROM anon, authenticated;
GRANT SELECT ON public.fund_market TO authenticated;

DROP POLICY IF EXISTS "Fund users read market" ON public.fund_market;
CREATE POLICY "Fund users read market" ON public.fund_market
  FOR SELECT TO authenticated USING ((SELECT public.has_feature('fund')));

COMMIT;

NOTIFY pgrst, 'reload schema';
