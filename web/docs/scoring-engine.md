# Scoring Engine

The scoring engine calculates a user's Life Score position (0-200) and derivative metrics based on activity data from connected services.

## Position Formula

Position is calculated in two phases:

### Phase 1: Raw Score

For each active field from connected services:

```
contribution = (rawValue / expectedRange[1]) * effortMultiplier * weight
```

Where:
- `rawValue` = actual value from the connector (e.g., 240 listening minutes)
- `expectedRange[1]` = maximum expected value (e.g., 480 for 8 hours/day)
- `effortMultiplier` = sparsity-based multiplier (admin can override)
- `weight` = field weight (admin can override, default from field descriptor)

Raw score = sum of all field contributions.

### Phase 2: Soft-Cap Curve

```
if rawScore <= 100:
    position = rawScore  (linear)

if rawScore > 100:
    position = 100 + 100 * (1 - exp(-k * (rawScore - 100)))
```

Where `k = 0.000046`.

**Key properties:**
- Position 0-100: Linear growth (1 point of activity = 1 point of position)
- Position 100+: Exponential drag (each additional point costs ~1.5x more activity)
- Position 200: Asymptotic limit (requires ~1000x normal activity)

**Sample values:**

| Raw Score | Position |
|-----------|----------|
| 0         | 0        |
| 50        | 50       |
| 100       | 100.0    |
| 200       | 100.5    |
| 500       | 101.8    |
| 1,000     | 104.1    |
| 5,000     | 120.4    |
| 10,000    | 136.6    |
| 50,000    | 190.0    |
| 100,000   | 199.0    |

## Effort Multipliers

Each field has a `sparsityClass` that determines its default effort multiplier:

| Class | Multiplier | Description |
|-------|------------|-------------|
| `passive` | 0.3 | Background activity (listening, scrolling) |
| `semi-active` | 0.7 | Deliberate but low-effort (opening app, browsing) |
| `active` | 1.5 | Real effort (logging food, workouts, creating content) |

Admins can override per-field via the Scoring panel.

## Derivatives (Z-Scores)

Velocity, acceleration, jerk, and snap are derivatives of position over time, displayed as z-scores against the user's own historical baseline.

### Calculation

1. **Velocity** = current position - previous position
2. **Acceleration** = current velocity - previous velocity
3. **Jerk** = current acceleration - previous acceleration
4. **Snap** = current jerk - previous jerk

Each derivative is then z-scored:

```
z = (currentValue - mean(historicalValues)) / stdev(historicalValues)
```

### When Derivatives Return Null

- **Insufficient history**: Day scale requires 7+ entries, week requires 3+
- **Zero variance**: If all historical values are identical (stdev = 0)
- **No data**: If no position history exists

UI displays "—" for null values.

## Prestige Tiers

Users who reach position 100+ enter prestige zones with visual effects:

| Tier | Position Range | Visual Effect |
|------|---------------|---------------|
| 0    | 0-99          | Standard styling |
| 1    | 100-149       | Subtle teal glow |
| 2    | 150-179       | Stronger teal/cyan glow |
| 3    | 180+          | Strongest glow with pulse |

## Connector Registry

The scoring engine never imports specific connectors. It consumes:
- Field metadata from `getActiveFields()`
- Field values from `fetchAll(userId, timeScale)`
- Weights from `scoring_field_weights` table

Adding a new connector automatically adds its fields to the scoring system.

## Time Scales

- **day**: Rolling 1-day window
- **week**: Rolling 7-day window (default)
- **month**: Rolling 30-day window

Different time scales may return different position values depending on connector behavior.

## Worked Example

**User**: Alice, heavy Spotify listener

**Field Values** (week time scale):
- `spotify_listening_minutes`: 350 (expected max: 480)
- `spotify_unique_artists`: 75 (expected max: 100)
- `spotify_consistency`: 85% (expected max: 100)

**Weights** (from scoring_field_weights table):
- `spotify_listening_minutes`: weight=50, effortMultiplier=null (uses default 0.3)
- `spotify_unique_artists`: weight=30, effortMultiplier=null (uses default 0.3)
- `spotify_consistency`: weight=25, effortMultiplier=null (uses default 0.3)

**Calculation:**

```
listening_contrib  = (350/480) * 0.3 * 50 = 0.729 * 0.3 * 50 = 10.94
artists_contrib    = (75/100) * 0.3 * 30  = 0.75 * 0.3 * 30  = 6.75
consistency_contrib = (85/100) * 0.3 * 25 = 0.85 * 0.3 * 25  = 6.38

rawScore = 10.94 + 6.75 + 6.38 = 24.07
```

Since rawScore (24.07) < 100, position = rawScore = **24.07**

**Derivatives** (assuming 3+ weeks of history):
- If Alice's historical velocities average 2.0 with stdev 1.5, and current velocity is 5.0:
- velocity z-score = (5.0 - 2.0) / 1.5 = **+2.00**

## V2 Path: Custom Math Expressions

**Not yet implemented.** Future version will allow admins to define custom formulas:

```typescript
// Example: Bonus for high consistency
position = basePosition * (1 + (consistency > 90 ? 0.1 : 0))
```

Rough scope:
- Expression parser with sandboxed evaluation
- Field reference syntax: `$spotify_listening_minutes`
- Basic math operators and conditionals
- Preview mode before saving
- Validation against test data

## API Reference

### Engine Functions

```typescript
// Main entry point
calculateScores(input: ScoringInput): ScoringOutput

// Individual phases
calculateRawScore(fieldValues, weights, fieldMetadata): number
applySoftCap(rawScore: number): number
calculateDerivatives(position, history, timeScale): Derivatives
getPrestigeTier(position: number): number
```

### Input Types

```typescript
interface ScoringInput {
  fieldValues: Record<string, number | null>
  weights: Record<string, { weight: number; effortMultiplier: number | null }>
  fieldMetadata: ConnectorField[]
  history: PositionHistoryEntry[]
  timeScale: 'day' | 'week' | 'month' | 'all'
}
```

### Output Types

```typescript
interface ScoringOutput {
  position: number        // 0-200
  velocity: number | null // z-score
  acceleration: number | null
  jerk: number | null
  snap: number | null
  rawScore: number        // Pre-soft-cap
  isPrestige: boolean     // position >= 100
  prestigeTier: number    // 0-3
}
```

## Database Tables

- `scoring_field_weights`: Admin-configured weights per field
- `user_position_history`: Historical positions for z-score calculation
- `recompute_locks`: Rate limiting (10 min per user)

## Tests

Run with: `npm test` (vitest)

Test file: `web/api/scoring/engine.test.ts`
