/**
 * Admin Scoring API
 *
 * GET /api/admin/scoring - List all field weights with metadata
 * PATCH /api/admin/scoring - Update field weight/effort multiplier
 * POST /api/admin/scoring?action=reset - Reset all to defaults
 * POST /api/admin/scoring?action=sync - Sync registry to database
 * POST /api/admin/scoring?action=preview - Preview scores for a user
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin, logAudit, methodNotAllowed } from '../_admin.js'
import { getFields, getConnectors, getFieldMetadataForAdmin, fetchAll, type TimeScale } from '../../src/scoring/connectors/index.js'
import { calculateScores, type FieldWeight, type PositionHistoryEntry } from '../../src/scoring/engine.js'

interface FieldWeightRow {
  id: string
  field_id: string
  weight: number
  effort_multiplier: number | null
  updated_at: string
  updated_by: string | null
}

const DERIVATIVE_FIELDS = ['position', 'velocity', 'acceleration', 'jerk', 'snap'] as const
type DerivativeField = typeof DERIVATIVE_FIELDS[number]

// GET/PATCH ?type=derivatives - life score derivatives management
async function handleDerivatives(
  req: VercelRequest,
  res: VercelResponse,
  ctx: Awaited<ReturnType<typeof requireAdmin>>
) {
  if (!ctx) return

  const user_id = String(req.query.user_id ?? '')
  const metric = String(req.query.metric ?? '')

  // Single derivative update
  if (user_id && metric && req.method === 'PATCH') {
    const body = (req.body ?? {}) as Partial<Record<DerivativeField, number>>
    const patch: Record<string, number> = {}
    for (const f of DERIVATIVE_FIELDS) {
      const v = body[f]
      if (typeof v === 'number' && Number.isFinite(v)) patch[f] = v
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'no derivative fields supplied' })
    }

    const { data: before, error: beforeErr } = await ctx.supabase
      .from('life_score_derivatives')
      .select('user_id, metric, position, velocity, acceleration, jerk, snap')
      .eq('user_id', user_id)
      .eq('metric', metric)
      .maybeSingle()
    if (beforeErr) return res.status(500).json({ error: beforeErr.message })
    if (!before) return res.status(404).json({ error: 'derivative row not found' })

    const { data: after, error: updateErr } = await ctx.supabase
      .from('life_score_derivatives')
      .update({ ...patch, computed_at: new Date().toISOString() })
      .eq('user_id', user_id)
      .eq('metric', metric)
      .select('user_id, metric, position, velocity, acceleration, jerk, snap, computed_at')
      .single()
    if (updateErr) return res.status(500).json({ error: updateErr.message })

    await logAudit(ctx, {
      action: 'update_life_score_derivative',
      target_type: 'life_score_derivative',
      target_id: `${user_id}:${metric}`,
      before,
      after,
    })

    return res.status(200).json({ derivative: after })
  }

  // List all derivatives
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET', 'PATCH'])

  const { data, error } = await ctx.supabase
    .from('life_score_derivatives')
    .select('id, user_id, metric, position, velocity, acceleration, jerk, snap, computed_at, profiles(username, display_name)')
    .order('computed_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })

  const rows = (data ?? []).map(r => ({
    id: r.id,
    user_id: r.user_id,
    username: (r.profiles as { username?: string | null } | null)?.username ?? null,
    display_name: (r.profiles as { display_name?: string | null } | null)?.display_name ?? null,
    metric: r.metric,
    position: r.position,
    velocity: r.velocity,
    acceleration: r.acceleration,
    jerk: r.jerk,
    snap: r.snap,
    computed_at: r.computed_at,
  }))

  return res.status(200).json({ derivatives: rows })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = await requireAdmin(req, res)
  if (!ctx) return

  const action = req.query.action as string | undefined
  const type = req.query.type as string | undefined

  // Route to derivatives handler
  if (type === 'derivatives') {
    return handleDerivatives(req, res, ctx)
  }

  // POST actions
  if (req.method === 'POST') {
    if (action === 'reset') {
      return handleReset(req, res, ctx)
    }
    if (action === 'sync') {
      return handleSync(req, res, ctx)
    }
    if (action === 'preview') {
      return handlePreview(req, res, ctx)
    }
    return res.status(400).json({ error: 'Unknown action' })
  }

  // PATCH - update a field
  if (req.method === 'PATCH') {
    return handleUpdate(req, res, ctx)
  }

  // GET - list all fields
  if (req.method === 'GET') {
    return handleList(req, res, ctx)
  }

  return methodNotAllowed(res, ['GET', 'PATCH', 'POST'])
}

async function handleList(
  _req: VercelRequest,
  res: VercelResponse,
  ctx: Awaited<ReturnType<typeof requireAdmin>>
) {
  if (!ctx) return

  // Get field metadata from registry
  const fieldMetadata = getFieldMetadataForAdmin()

  // Get weights from database
  const { data: weightRows, error } = await ctx.supabase
    .from('scoring_field_weights')
    .select('id, field_id, weight, effort_multiplier, updated_at, updated_by')

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  // Build weights map
  const weightsMap = new Map<string, FieldWeightRow>()
  for (const row of weightRows || []) {
    weightsMap.set(row.field_id, row)
  }

  // Merge metadata with weights
  const fields = fieldMetadata.map(meta => {
    const weightRow = weightsMap.get(meta.field.id)
    return {
      fieldId: meta.field.id,
      displayName: meta.field.displayName,
      description: meta.field.description,
      unit: meta.field.unit,
      dataType: meta.field.dataType,
      sparsityClass: meta.field.sparsityClass,
      expectedRange: meta.field.expectedRange,
      inactive: meta.field.inactive,
      connectorId: meta.connectorId,
      connectorName: meta.connectorName,
      connectorActive: meta.connectorActive,
      defaultWeight: meta.field.defaultWeight,
      defaultEffortMultiplier: meta.field.defaultEffortMultiplier,
      // Current values from DB (or defaults if not yet synced)
      weight: weightRow?.weight ?? meta.field.defaultWeight,
      effortMultiplier: weightRow?.effort_multiplier ?? null,
      dbRowId: weightRow?.id ?? null,
      updatedAt: weightRow?.updated_at ?? null,
    }
  })

  // Get connectors list
  const connectors = getConnectors().map(c => ({
    id: c.id,
    displayName: c.displayName,
    isActive: c.isActive,
    fieldCount: c.fields.length,
  }))

  return res.status(200).json({ fields, connectors })
}

async function handleUpdate(
  req: VercelRequest,
  res: VercelResponse,
  ctx: Awaited<ReturnType<typeof requireAdmin>>
) {
  if (!ctx) return

  const { fieldId, weight, effortMultiplier } = req.body as {
    fieldId?: string
    weight?: number
    effortMultiplier?: number | null
  }

  if (!fieldId) {
    return res.status(400).json({ error: 'fieldId required' })
  }

  // Validate weight
  if (weight !== undefined && (typeof weight !== 'number' || weight < 0 || weight > 3)) {
    return res.status(400).json({ error: 'weight must be between 0 and 3' })
  }

  // Get current row
  const { data: before } = await ctx.supabase
    .from('scoring_field_weights')
    .select('*')
    .eq('field_id', fieldId)
    .maybeSingle()

  // Build update
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: ctx.user.id,
  }

  if (weight !== undefined) {
    updateData.weight = weight
  }

  if (effortMultiplier !== undefined) {
    updateData.effort_multiplier = effortMultiplier
  }

  // Upsert
  const { data: after, error } = await ctx.supabase
    .from('scoring_field_weights')
    .upsert({
      field_id: fieldId,
      ...updateData,
    }, { onConflict: 'field_id' })
    .select()
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  await logAudit(ctx, {
    action: 'update_scoring_weight',
    target_type: 'scoring_field_weight',
    target_id: fieldId,
    before,
    after,
  })

  return res.status(200).json({ ok: true, field: after })
}

async function handleReset(
  _req: VercelRequest,
  res: VercelResponse,
  ctx: Awaited<ReturnType<typeof requireAdmin>>
) {
  if (!ctx) return

  // Get all fields from registry
  const allFields = getFields()

  // Update each field to its default values
  const updates = allFields.map(field => ({
    field_id: field.id,
    weight: field.defaultWeight,
    effort_multiplier: null,
    updated_at: new Date().toISOString(),
    updated_by: ctx.user.id,
  }))

  const { error } = await ctx.supabase
    .from('scoring_field_weights')
    .upsert(updates, { onConflict: 'field_id' })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  await logAudit(ctx, {
    action: 'reset_scoring_weights',
    target_type: 'scoring_field_weights',
    target_id: 'all',
    before: null,
    after: { count: updates.length },
  })

  return res.status(200).json({ ok: true, reset: updates.length })
}

async function handleSync(
  _req: VercelRequest,
  res: VercelResponse,
  ctx: Awaited<ReturnType<typeof requireAdmin>>
) {
  if (!ctx) return

  // Get all fields from registry
  const allFields = getFields()

  // Get existing field_ids
  const { data: existingRows } = await ctx.supabase
    .from('scoring_field_weights')
    .select('field_id')

  const existingIds = new Set((existingRows || []).map(r => r.field_id))

  // Find new fields
  const newFields = allFields.filter(f => !existingIds.has(f.id))

  if (newFields.length === 0) {
    return res.status(200).json({ ok: true, synced: 0, message: 'All fields already synced' })
  }

  // Insert new fields
  const inserts = newFields.map(field => ({
    field_id: field.id,
    weight: field.defaultWeight,
    effort_multiplier: null,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await ctx.supabase
    .from('scoring_field_weights')
    .insert(inserts)

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  await logAudit(ctx, {
    action: 'sync_scoring_fields',
    target_type: 'scoring_field_weights',
    target_id: 'registry',
    before: { existing: existingIds.size },
    after: { synced: newFields.length, total: allFields.length },
  })

  return res.status(200).json({
    ok: true,
    synced: newFields.length,
    newFields: newFields.map(f => f.id),
  })
}

async function handlePreview(
  req: VercelRequest,
  res: VercelResponse,
  ctx: Awaited<ReturnType<typeof requireAdmin>>
) {
  if (!ctx) return

  const { userId, timeScale = 'week', customWeights } = req.body as {
    userId?: string
    timeScale?: TimeScale
    customWeights?: Record<string, { weight: number; effortMultiplier: number | null }>
  }

  if (!userId) {
    return res.status(400).json({ error: 'userId required' })
  }

  // Fetch field values from connectors
  const fieldValues = await fetchAll(userId, timeScale)

  // Get weights: either custom (for preview) or from DB
  let weights: Record<string, FieldWeight>

  if (customWeights) {
    weights = customWeights
  } else {
    const { data: weightRows } = await ctx.supabase
      .from('scoring_field_weights')
      .select('field_id, weight, effort_multiplier')

    weights = {}
    for (const row of weightRows || []) {
      weights[row.field_id] = {
        weight: row.weight,
        effortMultiplier: row.effort_multiplier,
      }
    }
  }

  // Fetch history
  const { data: historyRows } = await ctx.supabase
    .from('user_position_history')
    .select('position, computed_at')
    .eq('user_id', userId)
    .eq('time_scale', timeScale)
    .order('computed_at', { ascending: false })
    .limit(30)

  const history: PositionHistoryEntry[] = (historyRows || []).map(r => ({
    position: Number(r.position),
    computed_at: r.computed_at,
  }))

  // Get field metadata
  const fieldMetadata = getFields().filter(f => !f.inactive)

  // Calculate scores
  const scores = calculateScores({
    fieldValues,
    weights,
    fieldMetadata,
    history,
    timeScale,
  })

  return res.status(200).json({
    ok: true,
    userId,
    timeScale,
    scores,
    fieldValues,
    isCustomWeights: !!customWeights,
  })
}
