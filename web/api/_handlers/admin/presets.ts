import type { VercelRequest, VercelResponse } from '@vercel/node'
// presets is the ONLY admin handler that uses the SMALL requireAdmin
// (returns {userId}) at web/api/admin/_admin.ts. The other five use the
// BIG requireAdmin at web/api/_admin.ts (returns {supabase, user,
// isSuperAdmin}). Preserved as-is — admin.userId below depends on it.
import { getAdminSupabase, requireAdmin } from '../../admin/_admin.js'

export async function handler(req: VercelRequest, res: VercelResponse) {
  // GET - list all presets (public, no auth required)
  if (req.method === 'GET') {
    let supabase
    try {
      supabase = getAdminSupabase()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Database configuration error'
      console.error('[admin/presets] ' + msg)
      return res.status(500).json({ error: msg })
    }

    const { data, error } = await supabase
      .from('visualizer_presets')
      .select('original_name, display_name, updated_at')
      .order('display_name', { ascending: true })

    if (error) {
      console.error('[admin/presets] GET error:', error.message)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ presets: data || [] })
  }

  // POST/PUT - upsert preset (admin only)
  if (req.method === 'POST' || req.method === 'PUT') {
    const admin = await requireAdmin(req, res)
    if (!admin) return

    const { original_name, display_name } = req.body
    if (!original_name || typeof original_name !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid original_name' })
    }
    if (!display_name || typeof display_name !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid display_name' })
    }

    let supabase
    try {
      supabase = getAdminSupabase()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Database configuration error'
      console.error('[admin/presets] ' + msg)
      return res.status(500).json({ error: msg })
    }

    const { error } = await supabase
      .from('visualizer_presets')
      .upsert(
        {
          original_name,
          display_name,
          updated_at: new Date().toISOString(),
          updated_by: admin.userId,
        },
        { onConflict: 'original_name' }
      )

    if (error) {
      console.error('[admin/presets] POST error:', error.message)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ ok: true })
  }

  // DELETE - remove preset override (admin only)
  if (req.method === 'DELETE') {
    const admin = await requireAdmin(req, res)
    if (!admin) return

    const { original_name } = req.body
    if (!original_name || typeof original_name !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid original_name' })
    }

    let supabase
    try {
      supabase = getAdminSupabase()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Database configuration error'
      console.error('[admin/presets] ' + msg)
      return res.status(500).json({ error: msg })
    }

    const { error } = await supabase
      .from('visualizer_presets')
      .delete()
      .eq('original_name', original_name)

    if (error) {
      console.error('[admin/presets] DELETE error:', error.message)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
