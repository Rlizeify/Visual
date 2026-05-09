import { useState, useEffect } from 'react'

interface PresetOverride {
  original_name: string
  display_name: string
}

let cachedOverrides: PresetOverride[] | null = null

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
        // Ignore fetch errors - will show original names
      } finally {
        setLoading(false)
      }
    }

    fetchOverrides()
  }, [])

  const getDisplayName = (originalName: string): string => {
    const override = overrides.find(p => p.original_name === originalName)
    return override?.display_name || originalName
  }

  return { overrides, loading, getDisplayName }
}
