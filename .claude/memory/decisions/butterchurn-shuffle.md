# Decision: Butterchurn library expansion + audio-gated auto-shuffle

**Date**: 2026-05-30

## Context

Two coupled changes to `web/src/features/visualizer/VisualizerEngine.ts`:

1. The preset library was 100 entries, all from the main
   `butterchurn-presets` bundle. Stone wanted "more, more, more"
   without breaking the curated names already shown in the gear
   menu.
2. Auto-cycle was a fixed interval that churned visuals even
   during silent moments and used a simple "next index" advance
   that felt linear.

## Decision

### Preset library — multi-pack merge with main-wins precedence

`butterchurn-presets@2.4.7` actually ships **five** bundles. The
engine now imports all of them and merges:

```ts
function mergePresets() {
  // Rightmost wins on key collision, so main last keeps curated names stable.
  return {
    ...butterchurnPresetsNonMinimal.getPresets(),
    ...butterchurnPresetsMD1.getPresets(),
    ...butterchurnPresetsExtra2.getPresets(),
    ...butterchurnPresetsExtra.getPresets(),
    ...butterchurnPresets.getPresets(),
  }
}
```

Library grows from ~100 → ~500. No new dependency added; sub-paths
already shipped in the existing `butterchurn-presets` package.
Sub-path module decls live in `web/src/vite-env.d.ts`.

### Auto-shuffle — random + recently-played history + audio gate

`cycleSpeed` semantic:
- `0` → auto-shuffle OFF
- `> 0` → random advance every N seconds

Advance behavior (`nextPreset()`):
- Exclude current index and the last `SHUFFLE_HISTORY_SIZE = 5`
  recently-played indexes
- Random pick from the remaining pool
- Graceful fallback (sequential next) if the exclusion empties
  the pool

Audio gate (two intervals, not one):
- `startSignalPoll()` — 500ms tick reading
  `getCurrentSignalLevel()`. Updates `lastNonSilentMs` when level
  > `SILENCE_THRESHOLD` (0.005).
- `startCycleTimer()` — interval at `cycleSpeed * 1000`. Skips
  the advance if `Date.now() - lastNonSilentMs > SILENCE_GATE_MS`
  (10s). Resumes next tick when audio comes back.

Manual `loadPreset()` resets `lastNonSilentMs` and calls
`startCycleTimer()` to restart the countdown — so the user
clicking a preset doesn't trigger a shuffle 1 second later.

Default `cycleSpeed` raised 15 → 45 (in both engine defaults and
`useVizSettings.ts`). 15s felt frantic with the expanded library;
45s lets a preset breathe.

### Gear menu UI

All three theme GearMenus replaced the prior CYCLE SPD slider
with an AUTO-SHUFFLE select dropdown:
- OFF / 15s / 30s / 45s / 90s / 3 min

Subtle "PRESETS: {count}" header tag added so Stone sees the
library grew.

## Alternatives Considered

- **Single faster cycle interval that polls signal level itself**:
  rejected. Either it ticks fast and is wasteful, or it ticks at
  cycleSpeed and misses transient silences. Two intervals = clean
  separation of concerns.
- **Persist `lastNonSilentMs` across reloads**: rejected. A reload
  resetting to "just heard audio" is fine — the next tick will
  re-evaluate.
- **Shuffle weighted by preset rating**: deferred. No rating
  metadata yet.
- **Prefer recently-NOT-played history (avoid Markov clumps)**:
  the 5-deep ring is the simplest version of this; deeper history
  can come later if Stone reports clumping.

## Files

- `web/src/features/visualizer/VisualizerEngine.ts` (rewrite)
- `web/src/features/visualizer/useVizSettings.ts` (default 45)
- `web/src/features/visualizer/GearMenu.tsx`
- `web/src/themes/asian-vibrant/components/GearMenu.tsx`
- `web/src/themes/ac130-thermal/components/GearMenu.tsx`
- `web/src/vite-env.d.ts` (4 sub-path module decls)

## Status

Shipped. tsc clean, build clean.
