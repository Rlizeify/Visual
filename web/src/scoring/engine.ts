/**
 * Scoring Engine
 *
 * Pure functions for calculating Life Score position and derivatives.
 * No Supabase calls — the engine only does math.
 *
 * POSITION SCALE:
 * - Range: 0 to 200 (absolute floor at 0)
 * - Soft cap at 100: Reaching 100 is realistic for active users
 * - Hard cap at 200: Each point past 100 costs ~1.5x the activity of the previous
 * - Reaching 200 requires ~1000x the activity of reaching 100
 *
 * DERIVATIVES:
 * - Velocity, acceleration, jerk, snap are derivatives of position over time
 * - Displayed as Z-scores against the user's own rolling baseline
 * - Returns null when stdev=0 or insufficient history
 *
 * IMPORTANT — these are NOT raw differentials:
 *
 * The four derivatives are NOT the literal v/a/j/s numbers from continuous
 * calculus. They are z-scores of the nth discrete differences of the
 * position time series, normalized against the user's own historical
 * distribution of that same derivative order.
 *
 *   positions  = [current, history[0], history[1], ...]      (newest first)
 *   velocities = positions[i] - positions[i+1]               (1st differences)
 *   accels     = velocities[i] - velocities[i+1]             (2nd differences)
 *   jerks      = accels[i] - accels[i+1]                     (3rd differences)
 *   snaps      = jerks[i] - jerks[i+1]                       (4th differences)
 *
 *   velocity   = zScore(velocities[0],   velocities.slice(1))
 *   accel      = zScore(accels[0],       accels.slice(1))
 *   jerk       = zScore(jerks[0],        jerks.slice(1))
 *   snap       = zScore(snaps[0],        snaps.slice(1))
 *
 * Consequence: every order is renormalized to ~unit variance against its
 * own history, so the four values live in roughly [-3, +3] regardless of
 * order. They do NOT decay toward zero at higher orders the way smooth
 * continuous-time derivatives do. Seeing four similar small negative
 * z-scores (e.g. -0.28, -0.33, -0.38, -0.31) means the user's position
 * has trended mildly downward and that same mild trend shows up at every
 * derivative order, each one normalized independently. This is by design,
 * not a bug.
 */

import type { ConnectorField } from './connectors/types.js'

// ============================================================================
// TYPES
// ============================================================================

export interface FieldWeight {
  weight: number
  effortMultiplier: number | null
}

export interface PositionHistoryEntry {
  position: number
  computed_at: string  // ISO timestamp
}

export interface ScoringInput {
  /** Raw field values from connectors: { fieldId: value } */
  fieldValues: Record<string, number | null>
  /** Weights from scoring_field_weights table: { fieldId: { weight, effortMultiplier } } */
  weights: Record<string, FieldWeight>
  /** Field metadata from connector registry */
  fieldMetadata: ConnectorField[]
  /** Historical position values for z-score calculation, sorted newest first */
  history: PositionHistoryEntry[]
  /** Time scale for determining minimum history requirements */
  timeScale: 'day' | 'week' | 'month' | 'all'
}

export interface ScoringOutput {
  /** Position score 0-200 with soft cap */
  position: number
  /** Velocity z-score (rate of position change), null if insufficient data */
  velocity: number | null
  /** Acceleration z-score (rate of velocity change), null if insufficient data */
  acceleration: number | null
  /** Jerk z-score (rate of acceleration change), null if insufficient data */
  jerk: number | null
  /** Snap z-score (rate of jerk change), null if insufficient data */
  snap: number | null
  /** Raw score before soft cap (useful for debugging) */
  rawScore: number
  /** Whether user is in prestige zone (position > 100) */
  isPrestige: boolean
  /** Prestige tier: 0 (< 100), 1 (100-149), 2 (150-179), 3 (180+) */
  prestigeTier: number
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Soft cap inflection point.
 * Below this, position ≈ rawScore (linear).
 * Above this, exponential drag kicks in.
 */
const SOFT_CAP = 100

/**
 * Hard cap — maximum position value.
 * Asymptotically approaches but never reaches this.
 */
const HARD_CAP = 200

/**
 * Exponential decay constant for the soft-cap curve.
 *
 * Derivation:
 * - We want rawScore = 100,000 to yield position ≈ 199 (near hard cap)
 * - Formula: position = 100 + 100 * (1 - exp(-k * (rawScore - 100)))
 * - Solving for k when position = 199 and rawScore = 100,000:
 *   - 99 = 100 * (1 - exp(-k * 99900))
 *   - exp(-k * 99900) = 0.01
 *   - k = -ln(0.01) / 99900 ≈ 0.000046
 *
 * Sample inputs/outputs:
 * - rawScore = 100   → position = 100.0
 * - rawScore = 200   → position ≈ 100.5
 * - rawScore = 500   → position ≈ 101.8
 * - rawScore = 1000  → position ≈ 104.1
 * - rawScore = 5000  → position ≈ 120.4
 * - rawScore = 10000 → position ≈ 136.6
 * - rawScore = 50000 → position ≈ 190.0
 * - rawScore = 100000 → position ≈ 199.0
 */
const SOFT_CAP_K = 0.000046

/**
 * Minimum history entries required for z-score calculation.
 * Fewer entries → stdev unreliable → return null.
 */
const MIN_HISTORY: Record<string, number> = {
  day: 7,    // Need at least a week of daily data
  week: 3,   // Need at least 3 weeks
  month: 3,  // Need at least 3 months
  all: 3,    // Need at least 3 data points
}

// ============================================================================
// CORE CALCULATIONS
// ============================================================================

/**
 * Clamp a value between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Calculate raw score from field values, weights, and metadata.
 *
 * Formula for each field:
 *   normalizedValue = clamp(rawValue / expectedRange[1], 0, 1)
 *   contribution = normalizedValue * effortMultiplier * weight
 *
 * Raw score = sum of all contributions.
 */
export function calculateRawScore(
  fieldValues: Record<string, number | null>,
  weights: Record<string, FieldWeight>,
  fieldMetadata: ConnectorField[]
): number {
  let rawScore = 0

  for (const field of fieldMetadata) {
    // Skip inactive fields
    if (field.inactive) continue

    const rawValue = fieldValues[field.id]

    // Skip null/undefined values
    if (rawValue === null || rawValue === undefined) continue

    const fieldWeight = weights[field.id]
    if (!fieldWeight) continue

    // Normalize value to 0-1 range based on expected range
    const [, maxExpected] = field.expectedRange
    const normalizedValue = clamp(rawValue / maxExpected, 0, 1)

    // Use admin override if set, otherwise use field's default effort multiplier
    const effortMultiplier = fieldWeight.effortMultiplier ?? field.defaultEffortMultiplier

    // Contribution = normalized * effort * weight
    const contribution = normalizedValue * effortMultiplier * fieldWeight.weight

    rawScore += contribution
  }

  return rawScore
}

/**
 * Apply soft-cap curve to convert raw score to position (0-200).
 *
 * Below SOFT_CAP (100): position = rawScore (linear)
 * Above SOFT_CAP: position = 100 + 100 * (1 - exp(-k * (rawScore - 100)))
 *
 * This creates:
 * - Linear growth up to 100 (feels rewarding, predictable)
 * - Exponential drag above 100 (each point costs ~1.5x more)
 * - Asymptotic approach to 200 (1000x activity = ~199 position)
 */
export function applySoftCap(rawScore: number): number {
  // Floor at 0
  if (rawScore <= 0) return 0

  // Linear below soft cap
  if (rawScore <= SOFT_CAP) return rawScore

  // Exponential drag above soft cap
  const excess = rawScore - SOFT_CAP
  const position = SOFT_CAP + (HARD_CAP - SOFT_CAP) * (1 - Math.exp(-SOFT_CAP_K * excess))

  // Clamp to hard cap (shouldn't hit this, but safety)
  return Math.min(position, HARD_CAP)
}

/**
 * Determine prestige tier based on position.
 * - 0: Below 100 (standard)
 * - 1: 100-149 (prestige entry)
 * - 2: 150-179 (elite)
 * - 3: 180+ (legendary)
 */
export function getPrestigeTier(position: number): number {
  if (position < 100) return 0
  if (position < 150) return 1
  if (position < 180) return 2
  return 3
}

// ============================================================================
// STATISTICAL FUNCTIONS
// ============================================================================

/**
 * Calculate mean of an array of numbers.
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/**
 * Calculate standard deviation of an array of numbers.
 */
function stdev(values: number[]): number {
  if (values.length < 2) return 0
  const avg = mean(values)
  const squaredDiffs = values.map(v => (v - avg) ** 2)
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1))
}

/**
 * Calculate z-score: (value - mean) / stdev.
 * Returns null if stdev is 0 (no variance).
 */
function zScore(value: number, values: number[]): number | null {
  const avg = mean(values)
  const sd = stdev(values)

  // Can't calculate z-score with zero variance
  if (sd === 0) return null

  return (value - avg) / sd
}

// ============================================================================
// DERIVATIVE CALCULATIONS
// ============================================================================

/**
 * Calculate derivatives (velocity, acceleration, jerk, snap) as z-scores.
 *
 * Method:
 * 1. From position history, compute velocity series (position deltas)
 * 2. From velocity series, compute acceleration series (velocity deltas)
 * 3. Continue for jerk and snap
 * 4. Z-score each current value against its historical series
 *
 * Returns null for any derivative that lacks sufficient history or has zero variance.
 */
export function calculateDerivatives(
  currentPosition: number,
  history: PositionHistoryEntry[],
  timeScale: string
): { velocity: number | null; acceleration: number | null; jerk: number | null; snap: number | null } {
  const minHistory = MIN_HISTORY[timeScale] ?? 3

  // Need at least minHistory entries to calculate meaningful z-scores
  if (history.length < minHistory) {
    return { velocity: null, acceleration: null, jerk: null, snap: null }
  }

  // Sort history by date (newest first)
  const sorted = [...history].sort(
    (a, b) => new Date(b.computed_at).getTime() - new Date(a.computed_at).getTime()
  )

  // Build position series: [current, history[0], history[1], ...]
  const positions = [currentPosition, ...sorted.map(h => h.position)]

  // Calculate velocity series (first differences)
  const velocities: number[] = []
  for (let i = 0; i < positions.length - 1; i++) {
    velocities.push(positions[i] - positions[i + 1])
  }

  // Calculate acceleration series (second differences)
  const accelerations: number[] = []
  for (let i = 0; i < velocities.length - 1; i++) {
    accelerations.push(velocities[i] - velocities[i + 1])
  }

  // Calculate jerk series (third differences)
  const jerks: number[] = []
  for (let i = 0; i < accelerations.length - 1; i++) {
    jerks.push(accelerations[i] - accelerations[i + 1])
  }

  // Calculate snap series (fourth differences)
  const snaps: number[] = []
  for (let i = 0; i < jerks.length - 1; i++) {
    snaps.push(jerks[i] - jerks[i + 1])
  }

  // Z-score the current value against historical values
  // velocity[0] is current velocity, velocity[1:] is history
  const velocity = velocities.length >= minHistory
    ? zScore(velocities[0], velocities.slice(1))
    : null

  const acceleration = accelerations.length >= minHistory
    ? zScore(accelerations[0], accelerations.slice(1))
    : null

  const jerk = jerks.length >= minHistory
    ? zScore(jerks[0], jerks.slice(1))
    : null

  const snap = snaps.length >= minHistory
    ? zScore(snaps[0], snaps.slice(1))
    : null

  return { velocity, acceleration, jerk, snap }
}

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

/**
 * Calculate full scoring output from inputs.
 *
 * This is the main entry point for the scoring engine.
 * It takes raw field values, weights, and history, and returns
 * position (0-200) and z-scored derivatives.
 */
export function calculateScores(input: ScoringInput): ScoringOutput {
  // Calculate raw score from field contributions
  const rawScore = calculateRawScore(
    input.fieldValues,
    input.weights,
    input.fieldMetadata
  )

  // Apply soft-cap curve to get position
  const position = applySoftCap(rawScore)

  // Calculate derivative z-scores
  const derivatives = calculateDerivatives(
    position,
    input.history,
    input.timeScale
  )

  // Determine prestige status
  const isPrestige = position >= SOFT_CAP
  const prestigeTier = getPrestigeTier(position)

  return {
    position: Math.round(position * 100) / 100, // Round to 2 decimals
    velocity: derivatives.velocity !== null
      ? Math.round(derivatives.velocity * 100) / 100
      : null,
    acceleration: derivatives.acceleration !== null
      ? Math.round(derivatives.acceleration * 100) / 100
      : null,
    jerk: derivatives.jerk !== null
      ? Math.round(derivatives.jerk * 100) / 100
      : null,
    snap: derivatives.snap !== null
      ? Math.round(derivatives.snap * 100) / 100
      : null,
    rawScore: Math.round(rawScore * 100) / 100,
    isPrestige,
    prestigeTier,
  }
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Format a derivative value for display.
 * Returns "—" for null, otherwise formats as z-score with sign.
 */
export function formatDerivative(value: number | null): string {
  if (value === null) return '—'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}`
}

/**
 * Get CSS class for prestige tier.
 * Used by UI components to apply visual effects.
 */
export function getPrestigeClass(tier: number): string {
  switch (tier) {
    case 1: return 'prestige-tier-1'
    case 2: return 'prestige-tier-2'
    case 3: return 'prestige-tier-3'
    default: return ''
  }
}

// Re-export constants for documentation/debugging
export const CONSTANTS = {
  SOFT_CAP,
  HARD_CAP,
  SOFT_CAP_K,
  MIN_HISTORY,
}
