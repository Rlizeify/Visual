// Per-surface and full-bundle export for Obsession.
//
// We emit JSON for the structured rows and CSV for the meditation
// bodies (so they read cleanly in any spreadsheet). The bundle
// version concatenates all five surfaces into a single JSON
// envelope — no third-party zip dep required.

import { supabase } from '../../../lib/supabase'
import { todayLocalISODate } from './localDate'

type AnyRow = Record<string, unknown>

async function dump(table: string, userId: string): Promise<AnyRow[]> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('user_id', userId)
  if (error) {
    console.warn(`[obsession] export dump failed for ${table}:`, error.message)
    return []
  }
  return (data ?? []) as AnyRow[]
}

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function toCsv(rows: AnyRow[]): string {
  if (rows.length === 0) return ''
  const headers = Array.from(rows.reduce<Set<string>>((set, r) => {
    Object.keys(r).forEach(k => set.add(k))
    return set
  }, new Set()))
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [headers.join(',')]
  for (const r of rows) lines.push(headers.map(h => escape(r[h])).join(','))
  return lines.join('\n')
}

export type ObsessionSurface = 'meditations' | 'training' | 'lifts' | 'preferences'

const SURFACE_TABLES: Record<ObsessionSurface, string[]> = {
  meditations: ['obsession_meditations'],
  training: ['obsession_training_goals', 'obsession_strava_activities', 'obsession_mynetdiary_entries'],
  lifts: ['obsession_lifts_sessions', 'obsession_lifts_exercises', 'obsession_lifts_sets'],
  preferences: ['obsession_preferences'],
}

export async function exportSurface(userId: string, surface: ObsessionSurface, format: 'json' | 'csv'): Promise<void> {
  const tables = SURFACE_TABLES[surface]
  const dumps: Record<string, AnyRow[]> = {}
  for (const t of tables) dumps[t] = await dump(t, userId)
  const stamp = todayLocalISODate()

  if (format === 'csv') {
    // CSV mode emits one file per table (browser will download each).
    for (const t of tables) {
      triggerDownload(`obsession-${stamp}-${t}.csv`, toCsv(dumps[t]), 'text/csv')
    }
    return
  }
  const payload = {
    exported_at: new Date().toISOString(),
    user_id: userId,
    surface,
    tables: dumps,
  }
  triggerDownload(`obsession-${stamp}-${surface}.json`, JSON.stringify(payload, null, 2), 'application/json')
}

export async function exportBundle(userId: string): Promise<void> {
  const stamp = todayLocalISODate()
  const allTables = Array.from(new Set(Object.values(SURFACE_TABLES).flat()))
  const dumps: Record<string, AnyRow[]> = {}
  for (const t of allTables) dumps[t] = await dump(t, userId)
  const payload = {
    exported_at: new Date().toISOString(),
    user_id: userId,
    surface: 'bundle',
    tables: dumps,
  }
  triggerDownload(`obsession-${stamp}-bundle.json`, JSON.stringify(payload, null, 2), 'application/json')
}
