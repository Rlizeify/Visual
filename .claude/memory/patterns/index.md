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

## CSS Design System in :root Variables
**Observed**: global.css
**Pattern**: Colors, glows, and fonts defined as CSS custom properties. Components reference variables, not hardcoded values.
**Response**: Use existing variables for any new styling. Add new variables to :root if needed, don't inline colors.
