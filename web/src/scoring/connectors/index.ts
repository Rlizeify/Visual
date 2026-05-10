// Connector Registry
// Auto-imports all connector modules and exposes a unified API.
//
// TO ADD A NEW CONNECTOR:
// 1. Create your connector file in this folder (e.g., strava.ts)
// 2. Import it below and add to the CONNECTORS array
// That's it. No other files need changes.

import type { Connector, ConnectorField, TimeScale, FetchResult } from './types.js'

// Import all connectors - add new connectors here
import spotify from './spotify.js'
import discord from './discord.js'
import mynetdiary from './mynetdiary.js'
import applehealth from './applehealth.js'

// Register all connectors - add new connectors here
const CONNECTORS: Connector[] = [
  spotify,
  discord,
  mynetdiary,
  applehealth,
]

/**
 * Get all registered connectors.
 * Inactive connectors are included (for admin panel display).
 */
export function getConnectors(): Connector[] {
  return CONNECTORS
}

/**
 * Get only active connectors.
 */
export function getActiveConnectors(): Connector[] {
  return CONNECTORS.filter(c => c.isActive)
}

/**
 * Get all fields from all connectors (active and inactive).
 * Used by admin panel to display all possible fields.
 */
export function getFields(): ConnectorField[] {
  return CONNECTORS.flatMap(c => c.fields)
}

/**
 * Get only fields from active connectors.
 */
export function getActiveFields(): ConnectorField[] {
  return CONNECTORS.filter(c => c.isActive).flatMap(c => c.fields)
}

/**
 * Get a specific field by ID.
 */
export function getFieldById(fieldId: string): ConnectorField | undefined {
  for (const connector of CONNECTORS) {
    const field = connector.fields.find(f => f.id === fieldId)
    if (field) return field
  }
  return undefined
}

/**
 * Get connector by ID.
 */
export function getConnectorById(connectorId: string): Connector | undefined {
  return CONNECTORS.find(c => c.id === connectorId)
}

/**
 * Get the connector that owns a field.
 */
export function getConnectorForField(fieldId: string): Connector | undefined {
  return CONNECTORS.find(c => c.fields.some(f => f.id === fieldId))
}

/**
 * Fetch data from all active connectors for a user.
 * Returns merged results from all connectors.
 * Errors in individual connectors don't fail the whole operation.
 */
export async function fetchAll(
  userId: string,
  timeScale: TimeScale
): Promise<FetchResult> {
  const results: FetchResult = {}

  const activeConnectors = getActiveConnectors()

  const fetchPromises = activeConnectors.map(async (connector) => {
    try {
      const data = await connector.fetch(userId, timeScale)
      return { connectorId: connector.id, data, error: null }
    } catch (error) {
      console.error(`[connectors] ${connector.id} fetch failed:`, error)
      // Return nulls for all fields on error
      const nullData: FetchResult = {}
      for (const field of connector.fields) {
        nullData[field.id] = null
      }
      return { connectorId: connector.id, data: nullData, error }
    }
  })

  const responses = await Promise.all(fetchPromises)

  for (const response of responses) {
    Object.assign(results, response.data)
  }

  return results
}

/**
 * Get field metadata map for admin panel.
 * Includes connector info and all field details.
 */
export function getFieldMetadataForAdmin(): Array<{
  connectorId: string
  connectorName: string
  connectorActive: boolean
  field: ConnectorField
}> {
  const metadata: Array<{
    connectorId: string
    connectorName: string
    connectorActive: boolean
    field: ConnectorField
  }> = []

  for (const connector of CONNECTORS) {
    for (const field of connector.fields) {
      metadata.push({
        connectorId: connector.id,
        connectorName: connector.displayName,
        connectorActive: connector.isActive,
        field,
      })
    }
  }

  return metadata
}

// Re-export types for convenience
export type { Connector, ConnectorField, TimeScale, FetchResult, DataType, SparsityClass } from './types.js'
export { EFFORT_MULTIPLIERS, makeFieldId, getEffortMultiplier } from './types.js'
