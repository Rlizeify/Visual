# Adding a New Connector

This guide shows how to add a new data connector (e.g., Strava, Last.fm, GitHub) to the scoring system. The process requires **one file** and **one import line** — no changes to the scoring engine, admin panel, recompute pipeline, or migrations.

## Quick Start

1. Create `web/api/scoring/connectors/strava.ts`
2. Add import to `web/api/scoring/connectors/index.ts`
3. Deploy. Done.

## File Template

Here's a complete Strava connector in ~40 lines:

```typescript
// web/api/scoring/connectors/strava.ts
import type { Connector, ConnectorField, TimeScale, FetchResult } from './types.js'
import { makeFieldId, getEffortMultiplier } from './types.js'

const CONNECTOR_ID = 'strava'

const fields: ConnectorField[] = [
  {
    id: makeFieldId(CONNECTOR_ID, 'distance_km'),
    displayName: 'Distance',
    description: 'Total distance covered in activities',
    unit: 'km',
    dataType: 'count',
    defaultWeight: 40,
    defaultEffortMultiplier: getEffortMultiplier('active'),
    sparsityClass: 'active',
    expectedRange: [0, 200],
    inactive: false, // set true if not yet implemented
  },
  {
    id: makeFieldId(CONNECTOR_ID, 'activities_count'),
    displayName: 'Activities',
    description: 'Number of logged activities',
    unit: 'count',
    dataType: 'count',
    defaultWeight: 50,
    defaultEffortMultiplier: getEffortMultiplier('active'),
    sparsityClass: 'active',
    expectedRange: [0, 30],
    inactive: false,
  },
]

async function fetch(userId: string, timeScale: TimeScale): Promise<FetchResult> {
  // Your implementation here - call Strava API, query database, etc.
  // Return { fieldId: rawValue } for each field
  return {
    [makeFieldId(CONNECTOR_ID, 'distance_km')]: 42.5,
    [makeFieldId(CONNECTOR_ID, 'activities_count')]: 7,
  }
}

const connector: Connector = {
  id: CONNECTOR_ID,
  displayName: 'Strava',
  isActive: true,
  fields,
  fetch,
}

export default connector
```

## Register the Connector

Add two lines to `web/api/scoring/connectors/index.ts`:

```typescript
// At the top with other imports
import strava from './strava.js'

// In the CONNECTORS array
const CONNECTORS: Connector[] = [
  spotify,
  discord,
  mynetdiary,
  applehealth,
  strava, // Add here
]
```

## Field Descriptor Reference

Each field requires these properties:

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique ID, use `makeFieldId(connectorId, 'field_name')` |
| `displayName` | string | Human-readable name for admin panel |
| `description` | string | What this field measures |
| `unit` | string | Display unit ('minutes', 'count', '%', 'km', etc.) |
| `dataType` | `'count' \| 'duration' \| 'ratio' \| 'category'` | Data classification |
| `defaultWeight` | number | Default scoring weight (0-100) |
| `defaultEffortMultiplier` | number | Use `getEffortMultiplier(sparsityClass)` |
| `sparsityClass` | `'passive' \| 'semi-active' \| 'active'` | Effort classification |
| `expectedRange` | `[min, max]` | Expected value range for normalization |
| `inactive` | boolean | Set `true` for stubbed/unimplemented fields |

## Effort Multiplier Heuristic

The `sparsityClass` determines the default effort multiplier:

| Class | Multiplier | Examples |
|-------|------------|----------|
| `passive` | 0.3 | Listening to music, passive tracking, scrolling |
| `semi-active` | 0.7 | Opening app, browsing, basic interactions |
| `active` | 1.5 | Logging food, completing workouts, writing messages |

Admin can override per-field via the scoring panel.

## Fetch Function

The `fetch(userId, timeScale)` function:
- Receives the user ID and time scale (`'day'`, `'week'`, or `'month'`)
- Returns `{ fieldId: rawValue }` for each field
- Handles its own API calls, caching, and rate limiting
- Returns `null` for fields that couldn't be fetched
- Errors should be caught and logged, not thrown

Example with error handling:

```typescript
async function fetch(userId: string, timeScale: TimeScale): Promise<FetchResult> {
  const result: FetchResult = {}

  // Initialize all fields to null
  for (const field of fields) {
    result[field.id] = null
  }

  try {
    const data = await stravaApi.getActivities(userId, timeScale)
    result[makeFieldId(CONNECTOR_ID, 'distance_km')] = data.totalDistance
    result[makeFieldId(CONNECTOR_ID, 'activities_count')] = data.count
  } catch (error) {
    console.error('[strava] Fetch failed:', error)
    // Return partial results with nulls
  }

  return result
}
```

## What Happens Automatically

Once you add a connector:

1. **Admin Panel**: New fields appear with correct labels, units, and default sliders
2. **Field Weights Table**: Seeding function inserts missing `field_id` rows on deploy
3. **Scoring Engine**: Consumes fields via registry — no import needed
4. **Recompute Pipeline**: Uses `fetchAll()` which includes all active connectors

## Inactive Connectors

Set `isActive: false` on the connector to:
- Exclude from `fetchAll()` and scoring
- Still appear in admin panel (greyed out) so admins see what's coming
- Individual fields can also be marked `inactive: true`

## Testing

```typescript
import { getConnectorById, fetchAll } from './connectors/index.js'

// Test your connector
const strava = getConnectorById('strava')
const result = await strava.fetch('user-123', 'week')
console.log(result)

// Test via registry
const all = await fetchAll('user-123', 'week')
console.log(all)
```
