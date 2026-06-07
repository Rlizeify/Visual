-- Lock down public.keepalive — anon UPDATE was the only thing the
-- client needed, and the client no longer pings (U14 audit:
-- pingKeepalive lived in the browser using the anon key, exposing
-- the heartbeat row to any anonymous visitor). The daily recompute
-- cron now drives the ping using the service-role key, which bypasses
-- RLS regardless of which policies remain.
--
-- Drops the permissive UPDATE policy. SELECT remains permissive per
-- explicit G5 spec scope ("remove anon UPDATE permission"); the row
-- is a single global counter, no PII, so a stray reader is low-impact.
-- Tighten further only if visitor-counter inference becomes a concern.
--
-- Idempotent: DROP POLICY IF EXISTS lets the migration re-apply safely.

DROP POLICY IF EXISTS "keepalive update all" ON public.keepalive;
