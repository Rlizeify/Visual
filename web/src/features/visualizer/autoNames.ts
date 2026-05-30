// Deterministic auto-naming for Butterchurn presets that lack a curated
// override in `visualizer_presets`. Pool comes from `presetNamePool.ts`;
// curated overrides (passed in via `curated`) are subtracted from the
// effective pool so the same name never appears twice in the gear menu.
//
// Assignment algorithm:
//   1. Sort preset keys (stable order independent of import sequence).
//   2. For each key, hash → pool index. If slot taken, linear probe.
//   3. If pool is exhausted, fall back to the next preset's original
//      Butterchurn name (effectively no override — should never happen
//      while the pool stays larger than the library).
//
// Hash: FNV-1a 32-bit on the UTF-16 code units. Deterministic and stable
// across runs / builds.

import { NAME_POOL } from './presetNamePool'

const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

function fnv1a(str: string): number {
  let h = FNV_OFFSET >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, FNV_PRIME) >>> 0
  }
  return h >>> 0
}

export interface AutoNameOptions {
  // Original preset name → curated display name. Curated names are
  // removed from the effective pool so they remain unique to their
  // curated owner.
  curated: Map<string, string>
}

/**
 * Build a Map from original Butterchurn preset name → assigned MHEU
 * pool name. Curated entries are NOT included in the result — callers
 * should consult `curated` first and fall back to this map.
 */
export function buildAutoNameMap(
  keys: readonly string[],
  options: AutoNameOptions,
): Map<string, string> {
  const { curated } = options

  // Effective pool: NAME_POOL minus any name already used as a curated
  // display_name (case-sensitive — curated entries are typed exactly).
  const curatedValues = new Set(curated.values())
  const pool = NAME_POOL.filter(n => !curatedValues.has(n))

  // Sort keys for deterministic probing — assignment must not depend on
  // the order in which preset packs were spread into `mergePresets()`.
  const sortedKeys = [...keys].filter(k => !curated.has(k)).sort()

  const slotTaken = new Array<boolean>(pool.length).fill(false)
  const result = new Map<string, string>()

  for (const key of sortedKeys) {
    if (pool.length === 0) break
    let idx = fnv1a(key) % pool.length
    let probe = 0
    while (slotTaken[idx] && probe < pool.length) {
      idx = (idx + 1) % pool.length
      probe++
    }
    if (probe >= pool.length) {
      // Pool exhausted — every slot taken. Leave the preset unmapped;
      // caller will fall back to the original Butterchurn name. This
      // path is reached only if pool size < uncurated key count.
      break
    }
    slotTaken[idx] = true
    result.set(key, pool[idx])
  }

  return result
}
