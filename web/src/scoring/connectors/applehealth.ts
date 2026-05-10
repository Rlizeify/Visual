// Apple Health Connector (STUB)
// Fields defined but fetch returns zeros. Real implementation coming later.
// Note: Apple Health data requires iOS app or manual export - no direct API.

import type { Connector, ConnectorField, TimeScale, FetchResult } from './types.js'
import { makeFieldId, getEffortMultiplier } from './types.js'

const CONNECTOR_ID = 'applehealth'

const fields: ConnectorField[] = [
  {
    id: makeFieldId(CONNECTOR_ID, 'steps'),
    displayName: 'Steps',
    description: 'Total step count from all sources',
    unit: 'count',
    dataType: 'count',
    defaultWeight: 35,
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
    defaultWeight: 45,
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
    defaultWeight: 50,
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
    defaultWeight: 30,
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
