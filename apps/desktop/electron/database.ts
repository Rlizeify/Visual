/* database.ts — SQLite project persistence for Visual */

import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db
  const dbPath = join(app.getPath('userData'), 'visual.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS project_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      state_key TEXT NOT NULL,
      state_json TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, state_key)
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS media_library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      media_type TEXT NOT NULL CHECK(media_type IN ('audio', 'video')),
      file_size INTEGER,
      duration REAL,
      added_at TEXT DEFAULT (datetime('now')),
      last_used TEXT DEFAULT (datetime('now')),
      metadata_json TEXT
    );
  `)
  console.log('[VISUAL] SQLite initialized at', dbPath)
  return db
}

export interface ProjectRow {
  id: number
  name: string
  created_at: string
  updated_at: string
}

export function saveProject(name: string, state: Record<string, unknown>): ProjectRow {
  const d = getDb()

  // Check if project with this name exists
  const existing = d.prepare('SELECT id FROM projects WHERE name = ?').get(name) as { id: number } | undefined

  let projectId: number
  if (existing) {
    projectId = existing.id
    d.prepare('UPDATE projects SET updated_at = datetime(\'now\') WHERE id = ?').run(projectId)
  } else {
    const info = d.prepare('INSERT INTO projects (name) VALUES (?)').run(name)
    projectId = info.lastInsertRowid as number
  }

  const upsert = d.prepare(
    'INSERT OR REPLACE INTO project_state (project_id, state_key, state_json) VALUES (?, ?, ?)'
  )
  const tx = d.transaction(() => {
    for (const [key, val] of Object.entries(state)) {
      upsert.run(projectId, key, JSON.stringify(val))
    }
  })
  tx()

  return d.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as ProjectRow
}

export function loadProject(id: number): { project: ProjectRow; state: Record<string, unknown> } | null {
  const d = getDb()
  const project = d.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined
  if (!project) return null

  const rows = d.prepare('SELECT state_key, state_json FROM project_state WHERE project_id = ?').all(id) as { state_key: string; state_json: string }[]
  const state: Record<string, unknown> = {}
  for (const row of rows) {
    try { state[row.state_key] = JSON.parse(row.state_json) } catch { state[row.state_key] = null }
  }
  return { project, state }
}

export function listProjects(): ProjectRow[] {
  return getDb().prepare('SELECT id, name, created_at, updated_at FROM projects ORDER BY updated_at DESC').all() as ProjectRow[]
}

export function deleteProject(id: number): boolean {
  const info = getDb().prepare('DELETE FROM projects WHERE id = ?').run(id)
  return info.changes > 0
}

// ─── Media Library ──────────────────────────────────────────────────────────

export interface MediaRow {
  id: number
  file_path: string
  file_name: string
  media_type: 'audio' | 'video'
  file_size: number | null
  duration: number | null
  added_at: string
  last_used: string
  metadata_json: string | null
}

export function mediaImport(filePath: string, fileName: string, mediaType: 'audio' | 'video', fileSize?: number): MediaRow {
  const d = getDb()
  const existing = d.prepare('SELECT * FROM media_library WHERE file_path = ?').get(filePath) as MediaRow | undefined
  if (existing) {
    d.prepare('UPDATE media_library SET last_used = datetime(\'now\') WHERE id = ?').run(existing.id)
    return { ...existing, last_used: new Date().toISOString() }
  }
  const info = d.prepare(
    'INSERT INTO media_library (file_path, file_name, media_type, file_size) VALUES (?, ?, ?, ?)'
  ).run(filePath, fileName, mediaType, fileSize ?? null)
  return d.prepare('SELECT * FROM media_library WHERE id = ?').get(info.lastInsertRowid) as MediaRow
}

export function mediaList(mediaType?: 'audio' | 'video'): MediaRow[] {
  const d = getDb()
  if (mediaType) {
    return d.prepare('SELECT * FROM media_library WHERE media_type = ? ORDER BY last_used DESC').all(mediaType) as MediaRow[]
  }
  return d.prepare('SELECT * FROM media_library ORDER BY last_used DESC').all() as MediaRow[]
}

export function mediaRemove(id: number): boolean {
  const info = getDb().prepare('DELETE FROM media_library WHERE id = ?').run(id)
  return info.changes > 0
}

export function mediaUpdateMetadata(id: number, metadata: object): boolean {
  const info = getDb().prepare('UPDATE media_library SET metadata_json = ? WHERE id = ?').run(JSON.stringify(metadata), id)
  return info.changes > 0
}

export function mediaUpdateLastUsed(id: number): boolean {
  const info = getDb().prepare('UPDATE media_library SET last_used = datetime(\'now\') WHERE id = ?').run(id)
  return info.changes > 0
}

// ─── Settings ────────────────────────────────────────────────────────────────

export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
}

export function deleteSetting(key: string): boolean {
  const info = getDb().prepare('DELETE FROM settings WHERE key = ?').run(key)
  return info.changes > 0
}
