// MyNetDiary Connector (STUB)
// Fields defined but fetch returns zeros. Real implementation coming later.

import type { Connector, ConnectorField, TimeScale, FetchResult } from './types.js'
import { makeFieldId, getEffortMultiplier } from './types.js'

const CONNECTOR_ID = 'mynetdiary'

const fields: ConnectorField[] = [
  {
    id: makeFieldId(CONNECTOR_ID, 'calories_logged'),
    displayName: 'Calories Logged',
    description: 'Total calories logged for meals and snacks',
    unit: 'count',
    dataType: 'count',
    defaultWeight: 40,
    defaultEffortMultiplier: getEffortMultiplier('active'),
    sparsityClass: 'active',
    expectedRange: [0, 5000],
    inactive: true,
  },
  {
    id: makeFieldId(CONNECTOR_ID, 'days_logged'),
    displayName: 'Days Logged',
    description: 'Number of days with at least one food entry',
    unit: 'count',
    dataType: 'count',
    defaultWeight: 50,
    defaultEffortMultiplier: getEffortMultiplier('active'),
    sparsityClass: 'active',
    expectedRange: [0, 30],
    inactive: true,
  },
  {
    id: makeFieldId(CONNECTOR_ID, 'macro_consistency'),
    displayName: 'Macro Consistency',
    description: 'Percentage of days meeting macro targets',
    unit: '%',
    dataType: 'ratio',
    defaultWeight: 35,
    defaultEffortMultiplier: getEffortMultiplier('active'),
    sparsityClass: 'active',
    expectedRange: [0, 100],
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
  displayName: 'MyNetDiary',
  isActive: false,
  fields,
  fetch,
}

export default connector
