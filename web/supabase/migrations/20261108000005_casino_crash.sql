-- Casino: allow the Liftoff (crash) solo game.
--
-- STATUS: NOT APPLIED
--
-- Liftoff rounds live in a solo casino_tables row (owner = the player, id
-- 'crash:<user id>'), created by casino_solo_table(); the bust point sits in
-- casino_secrets like every deck. Only the game list changes.

BEGIN;

ALTER TABLE public.casino_tables DROP CONSTRAINT IF EXISTS casino_tables_game_check;
ALTER TABLE public.casino_tables ADD CONSTRAINT casino_tables_game_check
  CHECK (game IN ('blackjack', 'holdem', 'ridethebus', 'crash'));

COMMIT;
