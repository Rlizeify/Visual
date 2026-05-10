// Connector Contract Types
// The scoring engine NEVER imports specific connectors - only these types and the registry.

/**
 * Time scale for data fetching.
 * - 'day': Current day's data
 * - 'week': Rolling 7-day window
 * - 'month': Rolling 30-day window
 */
export type TimeScale = 'day' | 'week' | 'month'

/**
 * Data type classification for fields.
 * - 'count': Discrete countable values (e.g., tracks played, messages sent)
 * - 'duration': Time-based measurements in minutes (e.g., listening time, workout duration)
 * - 'ratio': Percentage or proportion values 0-100 (e.g., consistency, concentration)
 * - 'category': Categorical/enum values (not used for scoring, but for display)
 */
export type DataType = 'count' | 'duration' | 'ratio' | 'category'

/**
 * Sparsity class determines the default effort multiplier.
 *
 * Effort multiplier heuristic (sparsityClass-based):
 * - passive: 0.3 — Background activity requiring no deliberate action
 *   Examples: listening to music, scrolling feeds, passive tracking
 * - semi-active: 0.7 — Deliberate but low-effort actions
 *   Examples: logging into app, opening the app, browsing, basic interactions
 * - active: 1.5 — Real effort requiring deliberate input
 *   Examples: logging food, completing workouts, writing messages, creating content
 *
 * Admin override per field always wins over these defaults.
 */
export type SparsityClass = 'passive' | 'semi-active' | 'active'

export const EFFORT_MULTIPLIERS: Record<SparsityClass, number> = {
  passive: 0.3,
  'semi-active': 0.7,
  active: 1.5,
}

/**
 * Field descriptor - defines a single scorable metric from a connector.
 * This is the source of truth for the admin panel and scoring engine.
 */
export interface ConnectorField {
  /** Unique field identifier (e.g., 'spotify_listening_minutes') */
  id: string
  /** Human-readable name for admin panel */
  displayName: string
  /** Longer description explaining what this field measures */
  description: string
  /** Unit of measurement for display (e.g., 'minutes', 'count', '%') */
  unit: string
  /** Data type classification */
  dataType: DataType
  /** Default weight for scoring (0-3, admin can override) */
  defaultWeight: number
  /** Default effort multiplier (admin can override) */
  defaultEffortMultiplier: number
  /** Sparsity classification for effort heuristic */
  sparsityClass: SparsityClass
  /** Expected value range [min, max] for normalization */
  expectedRange: [number, number]
  /** If true, field is defined but connector not yet implemented */
  inactive: boolean
}

/**
 * Result of a connector fetch operation.
 * Maps field IDs to their raw values.
 */
export type FetchResult = Record<string, number | null>

/**
 * Connector module interface.
 * Each connector file must export an object matching this shape.
 */
export interface Connector {
  /** Unique connector identifier (e.g., 'spotify', 'discord') */
  id: string
  /** Human-readable name for admin panel */
  displayName: string
  /** Whether the connector is currently active/implemented */
  isActive: boolean
  /** Array of field descriptors provided by this connector */
  fields: ConnectorField[]
  /**
   * Fetch data for a user at a given time scale.
   * Returns a record mapping field IDs to raw values.
   * The connector handles its own API calls, caching, and rate limiting.
   * Returns null values for fields that couldn't be fetched.
   */
  fetch: (userId: string, timeScale: TimeScale) => Promise<FetchResult>
}

/**
 * Helper to create a field ID with connector prefix.
 * Ensures consistent naming: connectorId_fieldName
 */
export function makeFieldId(connectorId: string, fieldName: string): string {
  return `${connectorId}_${fieldName}`
}

/**
 * Helper to derive effort multiplier from sparsity class.
 */
export function getEffortMultiplier(sparsityClass: SparsityClass): number {
  return EFFORT_MULTIPLIERS[sparsityClass]
}
