---
concept: Archive, Don't Delete
last_compiled: 2026-04-07
topics_connected: [visualizer-butterchurn, window-architecture, project-roadmap, agent-workflow]
status: active
---

# Archive, Don't Delete

## Pattern

Visual treats deletion as a forbidden operation. Code that is no longer used is moved to `src/archive/` with a meaningful subdirectory name; code that is no longer wired is **commented out** rather than removed, with a marker comment explaining why. The pattern shows up in two distinct flavors: (1) entire directories archived (`visualizer-original/`, `oscilloscopes-original/`, `display-window-original/`, `cockpit-left-panel/`), and (2) code blocks commented out in-place with a `// DISPLAY WINDOW — commented out, Butterchurn now runs inside Cockpit preview panel` prefix. The agent rules in `CLAUDE.md` codify this as "Never delete files without explicit user confirmation," and `roadmap.md` repeats it as an Architecture Rule.

## Instances

- **2026-04-05 (session 4)** in [[../topics/window-architecture]]: `createDisplayWindow()`, its call inside `hub:open-cockpit`, the `hub:open-visualizer` handler, the F11 fullscreen shortcut, and five Display IPC handlers all commented out — not removed — from `electron/main.ts`. Each block prefixed with the marker comment.
- **2026-04-05 (session 3, STEP 1)** in [[../topics/visualizer-butterchurn]]: Display/Butterchurn window copied to `src/archive/display-window-original/` (VisualizerApp, DisplayApp, Visualizer) before the Cockpit redesign started. Original files left untouched until they were later commented out.
- **2026-04-05 (session 2)** in [[../topics/ui-design-system]]: LeftPanel, RightPanel, Dial, ToggleSwitch archived to `apps/desktop/src/archive/cockpit-left-panel/` before the Cockpit was rebuilt.
- **3D oscilloscopes** in [[../topics/visualizer-butterchurn]]: XY/XYZ 3D scopes archived to `src/archive/oscilloscopes-original/`, listed as "deferred — revisit later" in roadmap rather than dropped.
- **Architecture rule** in [[../topics/project-roadmap]]: "Never delete files — move to `src/archive/`" appears verbatim in both `priorities.md` and `roadmap.md`.
- **Agent rule** in [[../topics/agent-workflow]]: `CLAUDE.md` Do-Not list: "Delete files without explicit user confirmation."

## What This Means

The Archive-Don't-Delete rule is paying for itself in three ways:

1. **Reversibility.** Every architectural pivot (Display → Cockpit fold, dial-based left panel → DJ decks, 3D scopes → 2D LJV) can be undone or referenced. The git history exists, but having the working code one directory away is faster than bisecting.

2. **Comparison artifacts.** When the new Cockpit needed to behave like the old Display in some respect, the archive was the canonical reference — not commit hashes.

3. **Decision pressure relief.** "We can always come back to this" lets the project move fast without losing work. The 3D oscilloscope being archived rather than deleted is what makes "deferred" honest rather than a euphemism for "abandoned."

The deeper insight: **archival changes the cost model of change.** When deletion is forbidden, refactoring becomes additive — you create the new thing, test it, then archive the old one. There's never a "between" state where the old behavior is gone but the new isn't fully working. This is the opposite of "move fast and break things"; it's "move fast because nothing breaks."

When recommending changes to this codebase, never propose `rm`. Propose archival paths and marker comments. If you find yourself wanting to delete, that's the signal to slow down and pick an archive directory name first.

## Sources

- [[../topics/visualizer-butterchurn]]
- [[../topics/window-architecture]]
- [[../topics/project-roadmap]]
- [[../topics/ui-design-system]]
- [[../topics/agent-workflow]]
