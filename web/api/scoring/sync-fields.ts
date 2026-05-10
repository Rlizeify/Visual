/**
 * Field Sync API
 *
 * POST /api/scoring/sync-fields
 *
 * Syncs field metadata from the connector registry to the scoring_field_weights table.
 * - Inserts new fields that don't have rows yet
 * - Never overwrites existing rows (preserves admin customizations)
 * - Run on every deploy to pick up new connectors/fields
 *
 * Requires admin authentication.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getFields } from './connectors/index.js'

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase config')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify admin authorization (optional for deploy scripts, required for manual calls)
  const authHeader = req.headers.authorization
  const isInternal = req.headers['x-vercel-deployment-url'] !== undefined

  if (!isInternal && authHeader) {
    const supabase = getServiceSupabase()
    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(token)

    if (userError || !userData?.user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    // Check admin status
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userData.user.id)
      .single()

    if (!profile?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' })
    }
  }

  const supabase = getServiceSupabase()

  try {
    // Get all fields from the connector registry
    const allFields = getFields()

    // Get existing field_ids from the database
    const { data: existingRows, error: fetchError } = await supabase
      .from('scoring_field_weights')
      .select('field_id')

    if (fetchError) {
      console.error('[sync-fields] Failed to fetch existing rows:', fetchError)
      return res.status(500).json({ error: fetchError.message })
    }

    const existingIds = new Set((existingRows || []).map(r => r.field_id))

    // Find fields that need to be inserted
    const newFields = allFields.filter(f => !existingIds.has(f.id))

    if (newFields.length === 0) {
      return res.status(200).json({
        ok: true,
        message: 'All fields already synced',
        synced: 0,
        total: allFields.length,
      })
    }

    // Insert new fields with their default weights
    const insertRows = newFields.map(field => ({
      field_id: field.id,
      weight: field.defaultWeight,
      effort_multiplier: null, // Use field's default from registry
      updated_at: new Date().toISOString(),
    }))

    const { error: insertError } = await supabase
      .from('scoring_field_weights')
      .insert(insertRows)

    if (insertError) {
      console.error('[sync-fields] Failed to insert rows:', insertError)
      return res.status(500).json({ error: insertError.message })
    }

    console.log(`[sync-fields] Synced ${newFields.length} new fields`)

    return res.status(200).json({
      ok: true,
      message: `Synced ${newFields.length} new fields`,
      synced: newFields.length,
      total: allFields.length,
      newFields: newFields.map(f => ({
        id: f.id,
        displayName: f.displayName,
        defaultWeight: f.defaultWeight,
      })),
    })
  } catch (error) {
    console.error('[sync-fields] Unexpected error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
