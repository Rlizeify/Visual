// Apple Health Connector (STUB)
// Fields defined but fetch returns zeros. Real implementation coming later.
// Note: Apple Health data requires iOS app or manual export - no direct API.

import type { Connector, ConnectorField, TimeScale, FetchResult } from './types.js'
import { makeFieldId, getEffortMultiplier } from './types.js'

const CONNECTOR_ID = 'applehealth'

// Field definitions - weights are 0-3 scale (admin can override)
const fields: ConnectorField[] = [
  {
    id: makeFieldId(CONNECTOR_ID, 'steps'),
    displayName: 'Steps',
    description: 'Total step count from all sources',
    unit: 'count',
    dataType: 'count',
    defaultWeight: 1.0,
    defaultEffortMultiplier: getEffortMultiplier('semi-active'),
    sparsityClass: 'semi-active',
    expectedRange: [0, 30000],
    inactive: true,
  },
  {
    id: makeFieldId(CONNECTOR_ID, 'active_minutes'),
    displayName: 'Active Minutes',
    description: 'Minutes of moderate to vigorous activity',
    unit: 'minutes',
    dataType: 'duration',
    defaultWeight: 1.4,
    defaultEffortMultiplier: getEffortMultiplier('active'),
    sparsityClass: 'active',
    expectedRange: [0, 180],
    inactive: true,
  },
  {
    id: makeFieldId(CONNECTOR_ID, 'workouts_logged'),
    displayName: 'Workouts Logged',
    description: 'Number of logged workout sessions',
    unit: 'count',
    dataType: 'count',
    defaultWeight: 1.5,
    defaultEffortMultiplier: getEffortMultiplier('active'),
    sparsityClass: 'active',
    expectedRange: [0, 14],
    inactive: true,
  },
  {
    id: makeFieldId(CONNECTOR_ID, 'sleep_hours'),
    displayName: 'Sleep Hours',
    description: 'Average hours of sleep per night',
    unit: 'hours',
    dataType: 'duration',
    defaultWeight: 0.9,
    defaultEffortMultiplier: getEffortMultiplier('passive'),
    sparsityClass: 'passive',
    expectedRange: [0, 12],
    inactive: true,
  },
]

// Stub fetch - returns zeros for all fields
async function fetch(_userId: string, _timeScale: TimeScale): Promise<FetchResult> {
  const result: FetchResult = {}
  for (const field of fields) {
    result[field.id] = 0
  }
  return result
}

const connector: Connector = {
  id: CONNECTOR_ID,
  displayName: 'Apple Health',
  isActive: false,
  fields,
  fetch,
}

export default connector
