-- Scoring Engine Tables
-- Migration: 20260509000011_scoring_tables.sql
--
-- Creates tables for the new connector-based scoring engine:
-- 1. scoring_field_weights - Admin-configurable weights per field
-- 2. user_position_history - Historical position values for z-score derivatives

-- ============================================================================
-- SCORING_FIELD_WEIGHTS
-- ============================================================================
-- Stores weight and effort multiplier overrides per field.
-- Field IDs come from the connector registry (e.g., 'spotify_listening_minutes').
-- Rows are seeded from registry on deploy; existing rows never overwritten.

CREATE TABLE IF NOT EXISTS scoring_field_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id TEXT UNIQUE NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 1.0,
  effort_multiplier NUMERIC, -- NULL means use field's default from registry
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Index for field_id lookups
CREATE INDEX IF NOT EXISTS idx_scoring_field_weights_field_id
  ON scoring_field_weights(field_id);

-- RLS: Admin-only write, public read (for client-side scoring preview)
ALTER TABLE scoring_field_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read scoring weights"
  ON scoring_field_weights FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage scoring weights"
  ON scoring_field_weights FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- ============================================================================
-- USER_POSITION_HISTORY
-- ============================================================================
-- Stores historical position values per user per time scale.
-- Used for calculating z-score derivatives (velocity, acceleration, jerk, snap).
-- One row per (user_id, time_scale, computed_at) combination.

CREATE TABLE IF NOT EXISTS user_position_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  time_scale TEXT NOT NULL CHECK (time_scale IN ('day', 'week', 'month', 'all')),
  position NUMERIC NOT NULL,
  raw_score NUMERIC, -- Pre-soft-cap score for debugging
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Primary query pattern: get history for a user at a time scale, ordered by date
CREATE INDEX IF NOT EXISTS idx_user_position_history_lookup
  ON user_position_history(user_id, time_scale, computed_at DESC);

-- RLS: Users can only see their own history
ALTER TABLE user_position_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own position history"
  ON user_position_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage position history"
  ON user_position_history FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- RECOMPUTE_LOCKS
-- ============================================================================
-- Rate limiting for recomputation. Prevents spam from rapid page loads.
-- One row per user, updated on each recompute.

CREATE TABLE IF NOT EXISTS recompute_locks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: Service role only (managed by API)
ALTER TABLE recompute_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage recompute locks"
  ON recompute_locks FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- ADD PRESTIGE COLUMNS TO USER_SCORES
-- ============================================================================
-- Extend existing user_scores table with prestige tracking

ALTER TABLE user_scores
  ADD COLUMN IF NOT EXISTS prestige_tier INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_prestige BOOLEAN DEFAULT false;

-- ============================================================================
-- SEED DEFAULT TOOLTIP VALUES
-- ============================================================================
-- Insert sensible defaults for the five score types if they don't exist

INSERT INTO tooltip_defaults (score_type, text)
VALUES
  ('position', 'Your Life Score position on a 0-200 scale. Reaching 100 is a solid achievement. Past 100, each point requires significantly more activity.'),
  ('velocity', 'Rate of position change as a z-score. Positive = growing faster than your baseline. Negative = slowing down.'),
  ('acceleration', 'Rate of velocity change as a z-score. Shows whether your growth is speeding up or slowing down.'),
  ('jerk', 'Rate of acceleration change as a z-score. Indicates trend shifts in your growth trajectory.'),
  ('snap', 'Rate of jerk change as a z-score. Captures the most volatile movements in your score dynamics.')
ON CONFLICT (score_type) DO NOTHING;
