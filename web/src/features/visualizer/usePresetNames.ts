import { useEffect, useMemo, useState } from 'react'
import { getVisualizerEngine } from './VisualizerEngine'
import { buildAutoNameMap } from './autoNames'

interface PresetOverride {
  original_name: string
  display_name: string
}

let cachedOverrides: PresetOverride[] | null = null

// Module-scope cache for the auto-name map. Rebuilt only when the curated
// override set changes (which only happens once per session after the
// `/api/admin/presets` fetch resolves).
let cachedAutoMap: Map<string, string> | null = null
let cachedAutoMapKey = ''  // serialized curated identity for cache invalidation

export function usePresetNames() {
  const [overrides, setOverrides] = useState<PresetOverride[]>(cachedOverrides || [])
  const [loading, setLoading] = useState(cachedOverrides === null)

  useEffect(() => {
    if (cachedOverrides !== null) return

    const fetchOverrides = async () => {
      try {
        const res = await fetch('/api/admin/presets')
        if (res.ok) {
          const data = await res.json()
          cachedOverrides = data.presets || []
          setOverrides(cachedOverrides || [])
        }
      } catch {
        // Ignore fetch errors — fall back to auto-pool names (which work
        // without the DB) so the gear menu stays MHEU-themed even when
        // offline / admin endpoint is down.
      } finally {
        setLoading(false)
      }
    }

    fetchOverrides()
  }, [])

  // Build the auto-name map once curated overrides settle. Re-runs only
  // when the curated set itself changes identity.
  const autoMap = useMemo(() => {
    const curated = new Map<string, string>()
    for (const o of overrides) curated.set(o.original_name, o.display_name)

    // Cheap cache key — combine length + first/last entries. Curated set
    // is loaded once per session, so a precise key isn't required.
    const cacheKey = `${overrides.length}|${overrides[0]?.original_name ?? ''}|${overrides[overrides.length - 1]?.original_name ?? ''}`
    if (cachedAutoMap && cachedAutoMapKey === cacheKey) return cachedAutoMap

    const engine = getVisualizerEngine()
    const keys = engine.getPresetKeys()
    cachedAutoMap = buildAutoNameMap(keys, { curated })
    cachedAutoMapKey = cacheKey
    return cachedAutoMap
  }, [overrides])

  const getDisplayName = (originalName: string): string => {
    const override = overrides.find(p => p.original_name === originalName)
    if (override?.display_name) return override.display_name
    const auto = autoMap.get(originalName)
    if (auto) return auto
    return originalName
  }

  return { overrides, loading, getDisplayName }
}
