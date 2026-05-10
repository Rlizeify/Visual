// Discord Connector (STUB)
// Fields defined but fetch returns zeros. Real implementation coming later.

import type { Connector, ConnectorField, TimeScale, FetchResult } from './types.js'
import { makeFieldId, getEffortMultiplier } from './types.js'

const CONNECTOR_ID = 'discord'

// Field definitions - weights are 0-3 scale (admin can override)
const fields: ConnectorField[] = [
  {
    id: makeFieldId(CONNECTOR_ID, 'messages_sent'),
    displayName: 'Messages Sent',
    description: 'Total messages sent across all servers',
    unit: 'count',
    dataType: 'count',
    defaultWeight: 1.0,
    defaultEffortMultiplier: getEffortMultiplier('active'),
    sparsityClass: 'active',
    expectedRange: [0, 500],
    inactive: true,
  },
  {
    id: makeFieldId(CONNECTOR_ID, 'voice_minutes'),
    displayName: 'Voice Minutes',
    description: 'Minutes spent in voice channels',
    unit: 'minutes',
    dataType: 'duration',
    defaultWeight: 1.2,
    defaultEffortMultiplier: getEffortMultiplier('semi-active'),
    sparsityClass: 'semi-active',
    expectedRange: [0, 480],
    inactive: true,
  },
  {
    id: makeFieldId(CONNECTOR_ID, 'server_count'),
    displayName: 'Active Servers',
    description: 'Number of servers with activity in the period',
    unit: 'count',
    dataType: 'count',
    defaultWeight: 0.5,
    defaultEffortMultiplier: getEffortMultiplier('passive'),
    sparsityClass: 'passive',
    expectedRange: [0, 20],
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
  displayName: 'Discord',
  isActive: false,
  fields,
  fetch,
}

export default connector
