---
topic: DJ Mixer
last_compiled: 2026-04-07
status: active
---

# DJ Mixer

## Summary [coverage: high — 4 sources]

The Cockpit hosts a 4-deck DJ mixer with crossfader, hot cues, and pitch faders. Decks A and B share a complementary-gain crossfader; decks C and D route directly to master. Each deck has its own audio graph (`AudioBufferSourceNode → GainNode`) managed by `DeckEngine.ts`. Waveforms are rendered in `DeckWaveform.tsx` using downsampled peaks with a position indicator and click-to-seek. The DJ strip occupies row 2 of the Cockpit grid (280px tall). Loaded audio files persist into the SQLite media library with cached BPM and key, so reloading is instant — no re-analysis. The "AudioLibrary" panel inside DJDecks shows previously imported tracks with their BPM and key.

## Architecture & Components [coverage: high — 4 sources]

- `components/cockpit/dj/DeckEngine.ts` — per-deck Web Audio graph, transport (play/pause/stop/seek), cue, hot cues, pitch, volume; `loadFromPath()` for IPC-based loading with cached BPM/key; `filePath` field for persistence
- `components/cockpit/dj/DeckWaveform.tsx` — canvas waveform, downsampled peaks, position indicator, click-to-seek
- `components/cockpit/dj/DeckChannel.tsx` — single-deck UI: load (file input via IPC dialog), waveform, play/pause, cue, 4 hot cues, pitch/volume faders. Persists audio to library on load. Stores BPM/key after detection.
- `components/cockpit/dj/DJDecks.tsx` — 4-deck container, A/B crossfader (complementary GainNodes), C/D direct, master volume. Integrates AudioLibrary. State getter includes filePath.
- `components/cockpit/dj/AudioLibrary.tsx` — collapsible panel, previously imported audio with BPM/key, "Set Music Folder" button (opens directory picker), auto-scans music folder on mount, rescans + reloads after folder change
- `components/cockpit/dj/djState.ts` — `DJState` interface, `getDJState()/setDJState()`, exposed on `window` for console
- `state/cockpitStateCollector.ts` — collects/restores DJ deck state for SQLite persistence

## Decisions & Rationale [coverage: medium — 2 sources]

- **4-deck layout, not 2-deck.** A/B share crossfader (typical DJ workflow); C/D are utility decks routed direct to master.
- **Persistent media library, not re-analysis on every load.** Files imported once, BPM/key cached in `media_library` table. Library-loaded files with stored analysis skip re-analysis on subsequent loads.
- **Music folder is a single configurable directory.** Stored in `settings` table via `settings:pick-music-directory`. Scans for `.mp3/.wav/.flac/.ogg/.m4a/.aac/.aiff`.
- **DJState exposed on window** for live console debugging.

## Patterns & Gotchas [coverage: low — 1 source]

- **DeckChannel persists on load.** Always go through the IPC dialog (`load-mp3` was broadened to all audio formats) so files end up in the media library with cached metadata.
- **Pre-existing DeckEngine TypeScript error** — known, persists across sessions, does not block builds.
- **Fader sizing.** Vertical fader was 80px → reduced to 50px in session 12 for responsive layout. Waveform 60px → 48px, now shrinkable to min 32px.

## History & Changelog [coverage: high — 5 sources]

- **2026-04-05 (session 13b)** — Persistent media library: `media_library` table, CRUD functions, IPC handlers. `DeckEngine.loadFromPath()` for cached loads. `DeckChannel` LOAD uses IPC dialog. `AudioLibrary.tsx` new. `DJDecks` integrates library.
- **2026-04-05 (session 12)** — Responsive layout: vertical fader 80px → 50px, waveform 60px → 48px shrinkable, Deck FX panel repositioned as internal overlay (was clipped by `overflow:hidden`).
- **2026-04-05 (sessions 8-9)** — 4-deck DJ mixer introduced. `DeckEngine.ts`, `DeckWaveform.tsx`, `DeckChannel.tsx`, `DJDecks.tsx`, `djState.ts`. Cockpit grid restructured to fit 280px DJ strip.

## Open Threads [coverage: low — 1 source]

DJ deck is in the active priority stack (priorities.md). No specific blockers. Pre-existing DeckEngine TypeScript error remains as a known non-blocker.

## Sources

- [[../../../.claude/memory/progress/changelog]]
- [[../../../.claude/memory/roadmap/roadmap]]
- [[../../../.claude/memory/roadmap/priorities]]
- [[../../../.claude/memory/context/active]]
