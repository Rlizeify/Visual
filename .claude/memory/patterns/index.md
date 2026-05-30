# Patterns

## Canvas Performance Requires Pre-allocation
**Observed**: Oscilloscope and Visualizer components; commits c7ce384, c162144
**Pattern**: Canvas-based rendering (oscilloscope, particles) hits performance issues when allocating arrays per frame. Ring buffers and pre-allocated particle pools solve it.
**Response**: Always use pre-allocated data structures for animation loops. Never allocate in requestAnimationFrame callbacks.

## Oscilloscope Glow Causes Gray Buildup
**Observed**: Display visualizer and oscilloscope; commits c162144, 08fd026
**Pattern**: Semi-transparent fade passes (for phosphor/glow trails) accumulate to gray instead of fading to black when alpha math doesn't converge to 0.
**Response**: Use explicit clear-to-black periodically, or clamp low alpha values to 0. Test fade trails visually before shipping.

## IPC Is One-Way Cockpit → Display
**Observed**: Preload files and main.ts IPC handlers
**Pattern**: Data flows from Cockpit to Display only. Display never sends back. Studio is isolated.
**Response**: If a feature needs Display → Cockpit feedback or Studio ↔ Cockpit sync, new IPC channels must be added in main.ts + preloads.

## Singleton Audio Engines
**Observed**: AudioEngine.ts, SynthEngine.ts, BeatDetector.ts
**Pattern**: Audio engines are module-level singletons, not instantiated per-component. The hook (useAudioEngine) wraps them.
**Response**: Never create second instances. Always go through the existing singleton or the hook.

## Dial Interaction: Vertical Drag, Not Rotation
**Observed**: Dial.tsx, commit 08fd026
**Pattern**: Dials use vertical mouse movement (drag up = increase), not circular rotation gestures. Scroll wheel also works.
**Response**: Keep this interaction model consistent for any new dial-like controls.

## OscillatorNode Lifecycle: One-Shot, Recreate to Restart
**Observed**: SynthEngine.ts stopAll(); Web Audio API
**Pattern**: OscillatorNode cannot be restarted after stop(). stopAll() must tear down and recreate all oscillator nodes to enable future startAll() calls.
**Response**: Always recreate OscillatorNodes on stop. Keep config separate from node lifecycle so state survives the recreation.

## Hidden Subtree with Forced Theme Override
**Observed**: OBSESSION feature (2026-05-25)
**Pattern**: When a feature must be hidden + theme-locked + RLS-isolated, mount it at a fixed route subtree with a `ThemeOverrideProvider` that mutates `document.documentElement.dataset.theme` on mount/unmount only (never call shared `setTheme()`). Access via egg keystroke hook at app root. Routing gates need an early-return exemption for the subtree.
**Response**: Full breakdown at `patterns/obsession-feature-pattern.md`. Don't write back through `ThemeContext.setTheme()` — it persists to Supabase and flips the user's chosen theme. Don't trust `setInterval` for duration math — store `started_at` and derive elapsed from `Date.now()`.

## Audio-Gated Cycling: Two Intervals, Not One
**Observed**: Butterchurn auto-shuffle (`VisualizerEngine.ts`, 2026-05-30)
**Pattern**: When an action should fire on a coarse interval but be conditioned on a fast-changing predicate (audio silence, network reachability, focus state), don't bake the predicate into one slow tick. Use **two** intervals: a fast poller (500ms) that updates a timestamp (`lastNonSilentMs`), and a slow ticker at the action cadence that consults the timestamp. The slow tick stays simple; the fast tick stays cheap.
**Response**: For Butterchurn, `startSignalPoll()` (500ms) updates `lastNonSilentMs` when `getCurrentSignalLevel() > SILENCE_THRESHOLD`. `startCycleTimer()` (N seconds) skips the advance if `Date.now() - lastNonSilentMs > SILENCE_GATE_MS`. Manual advance resets the timestamp + restarts the cycle so the user-initiated action isn't second-guessed. Same shape would apply to "only sync when foreground", "only ping when online", etc.

## Multi-Bundle Library Merge with Curated-Wins Precedence
**Observed**: Butterchurn presets (`VisualizerEngine.ts` `mergePresets()`, 2026-05-30)
**Pattern**: When extending a curated set with bulk additions, key collisions are inevitable. Spread merge with rightmost-wins semantics — put the curated bundle last. Library grows ~5x without breaking display names already cached in `presetKeys`, `selectedPreset` localStorage, or admin tooltip rows.
**Response**: `{...nonMinimal, ...MD1, ...extra2, ...extra, ...main}`. Same shape applies to any "expand defaults without breaking overrides" merge — env-var loading, theme registries, locale fallback chains.

## UNION View for Split-Table Admin Reads
**Observed**: `oauth_connections_unified` view (2026-05-30)
**Pattern**: When a table gets denormalized into per-type tables (`spotify_tokens`, `obsession_strava_tokens`) but admin tooling needs a unified read, create a read-only VIEW with `security_invoker = true` and synthetic ID `${type}:${pk}`. Writes still go to the per-type tables via a `providerTable` map keyed on the parsed prefix. Cheap to add, no drift, RLS still works.
**Response**: `CREATE OR REPLACE VIEW ... WITH (security_invoker = true) AS SELECT ('type:' || pk::text) AS id, ... UNION ALL ...`. Decision log at `.claude/memory/decisions/oauth-union-view.md`.

## User-Editable Content via public/ Markdown
**Observed**: Obsession manifesto (`web/public/manifesto.md`,
`Amor.tsx`, 2026-05-26)
**Pattern**: For prose that the project owner wants to edit without
opening code or running a new Claude Code session, store it as a
standalone `.md` under `web/public/`, fetch at runtime from the
served root (`/<file>.md`), and parse inline with a 30-line
regex-based parser (no markdown library). Cache parsed result in
module scope so revisits don't refetch.
**Response**: Use for any future text content — quote pools,
additional manifestos, copy blocks. Parser conventions for the
current implementation: `# Heading` → title, `*line*` (whole line
wrapped) → subtitle, other lines → paragraphs, inline `*word*` →
`<em>`. Show a loading state during fetch, an error state on
failure (referencing the file path so Stone knows what to fix).
Do NOT pull in `react-markdown` or similar — the format is tiny and
hand-rolled keeps deps lean. Add a comment at the top of the
consuming component pointing at the markdown file path so the
editing workflow is discoverable.

## CSS Design System in :root Variables
**Observed**: global.css
**Pattern**: Colors, glows, and fonts defined as CSS custom properties. Components reference variables, not hardcoded values.
**Response**: Use existing variables for any new styling. Add new variables to :root if needed, don't inline colors.
