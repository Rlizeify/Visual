# Preset Auto-Naming Audit (2026-05-30)

## Problem

After the 5x preset library expansion (commit 438c630), the gear menu
showed a mix of curated single-word MHEU names (Prometheus, Stareater,
Quasar, ...) alongside raw imports like `suksma - feign shoulder concern
when i should be executed` and `TonyMilkdrop - Magellan's Nebula`.

Curated names came from `seed_presets.sql` / `visualizer_presets` (100
entries, matching the main bundle the curator named originally). The
new ~400 presets from extra / extra2 / MD1 / nonMinimal had no
overrides.

The prior "main pack last so curated names win on collision" approach
only resolves identity-of-key collisions when two packs ship the same
preset. It does not generate names for the new presets.

## Fix shape (chosen path B from brief)

1. New `web/src/features/visualizer/presetNamePool.ts` — 443 unique
   single-word MHEU-themed names. Categories: cosmic, geological,
   physics, atmospheric, abstract-energetic, mythic, color/texture,
   mechanical, biological, cartographic, sharp/edge, light/shadow,
   time/motion, architectural, naturescape. No politically loaded or
   trademark-conflicting terms. Built-in sanity guard logs any
   duplicate slot at module load.
2. New `web/src/features/visualizer/autoNames.ts` — `buildAutoNameMap`
   takes the merged preset keys + the curated map and produces a
   stable assignment. Hash = FNV-1a 32-bit; collision resolution =
   linear probing; sort order = lexical so result is invariant to
   pack import order.
3. Updated `web/src/features/visualizer/usePresetNames.ts` —
   `getDisplayName` resolves in order:
   curated DB override → auto-pool name → original Butterchurn name.
   Auto-map memoized at module scope; recomputed only when the
   curated identity changes (once per session after the
   `/api/admin/presets` fetch resolves).

## Why pool > library size

Loaded library ≈ 500 presets. Curated ≈ 100. Uncurated ≈ 400.
Pool = 443. Pool ∩ curated = 4 (`Singularity, Magnetar, Cascade,
Inferno`). Effective pool after exclusion = 439, comfortably > 400
uncurated keys. Linear probing handles all hash collisions; pool
exhaustion path is unreachable in practice but falls back to the
original Butterchurn name (graceful).

## Naming rules used (for future pool extensions)

- Single word, no hyphens, no underscores
- Evocative > descriptive — pull from imagery, not from "what the
  visualizer does"
- Mix of length and texture (Apex through Heliopause through
  Bremsstrahlung)
- No politically loaded terms, no trademark conflicts, no proper-noun
  brand names
- Avoid duplicating any name already in `supabase/seed_presets.sql`
  (curated names always win, so duplicates just shrink the effective
  pool)

## Verification

- `tsc --noEmit` clean.
- `npm run build` clean (239 modules, 4.33s, no new warnings).
- Pool dedup check: 443 entries, 443 unique, 0 duplicates.
- Curated overlap: 4 names (acceptable; effective pool 439).
- Runtime: open gear menu → all preset names are single-word MHEU
  style; curated names preserved; no raw "TonyMilkdrop - Magellan's
  Nebula" etc.

## Files

- `web/src/features/visualizer/presetNamePool.ts` — NEW
- `web/src/features/visualizer/autoNames.ts` — NEW
- `web/src/features/visualizer/usePresetNames.ts` — auto-map merge
