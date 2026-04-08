---
concept: Singleton Engines vs React Lifecycle
last_compiled: 2026-04-07 (r6)
topics_connected: [audio-engine, spotify-integration, studio-synth-sampler, plugin-effects]
status: active
---

# Singleton Engines vs React Lifecycle

## Pattern

Visual's audio code lives in module-level singletons (`AudioEngine`, `SynthEngine`, `BeatDetector`, `SpotifyPlayerAudio`, `PluginChain`, `DeckEngine`, `SampleEngine`, `PadEngine`) — never instantiated per-component. The hook (`useAudioEngine`) wraps them. This works because audio graphs are stateful and global: a second AudioContext, a duplicate analyser, or a re-initialized synth would produce silence, glitches, or stale references.

But singletons collide with React's lifecycle in subtle ways: React strict mode mounts components twice in dev, audio elements created via SDKs need MutationObserver or IPC bridges to find them, async Promise rejections from `audio.play()` interrupted by `pause()` surface as unhandled rejections, and "ready" flags from external SDKs (Spotify Web Playback) don't line up with "we have the data we need to render." Every one of these collisions has its own changelog fix.

## Instances

- **2026-04-05 (session 11)** in [[../topics/studio-synth-sampler]]: AdditiveSynth's pre-loaded layer disappeared on second mount because React strict mode re-creates the AudioContext. Fix: reset `prevLayerIdsRef.current` in the engine init effect so the pre-loaded layer is treated as new after re-creation.
- **2026-04-05 (session 11)** in [[../topics/audio-engine]]: `SampleEngine.source.onended` was nullifying the active node ref via a *stale* callback after a previous source had ended. Fix: guard with `this.sourceNode === source` before clearing.
- **2026-04-05 (session 20)** in [[../topics/spotify-integration]]: `SpotifyBrowser` showed "Not connected" despite a valid OAuth token because `isConnected` was gated on the SDK's `ready` event, which never fired without Premium. Fix: `markTokenValid(true)` decouples "has token" from "SDK player ready" — must be called *before* `init()`.
- **2026-04-06 (session 25)** in [[../topics/window-architecture]]: Hub autoplay threw an unhandled Promise rejection from "play() interrupted by pause()". Fix: replace `try { audio.play() } catch {}` with `audio.play().catch(() => {})` because the rejection is async — `try/catch` doesn't see it.
- **2026-04-06 (session 25)** in [[../topics/audio-engine]]: `SpotifyPlayerAudio` previously used `getUserMedia({chromeMediaSource:'desktop'})` in the renderer, which crashed Electron with "bad IPC message reason 263". Short-term fix: silent OscillatorNode at gain=0 connected to AnalyserNode as a fallback.
- **2026-04-07 (session 25b)** in [[../topics/spotify-integration]]: the real loopback landed, but `getDisplayMedia` requires a user-gesture chain. Auto-reconnect called `startLoopback()` from the OAuth callback path and threw `NotAllowedError` because the gesture chain is not preserved across the HTTP callback. Fix: an explicit "Enable Audio Reactivity" button in `SpotifyBrowser` is the reliable entrypoint; `CockpitApp.handleSpotifyConnected` keeps a best-effort call but does not rely on it. This is another instance of "ready" being richer than a boolean — "connected" and "gesture-armed" are different states.
- **2026-04-05 (session 17)** in [[../topics/spotify-integration]]: `SpotifySettings` auto-reconnect race — calling `spotifyIsConnected()` instead of `spotifyGetAccessToken()` skipped the token-refresh path. Fix: always go through the path that triggers refresh.
- **Audio routing extracted** (session 21) in [[../topics/spotify-integration]]: `SpotifyPlayerAudio.ts` exists as a module-level singleton precisely *because* it must outlive component mounts.

## What This Means

The recurring lesson is: **"ready" is a richer concept than React lets you express in a single boolean.** Every collision in the instances above comes from confusing one of these states:

1. **Module loaded** (singleton instance exists)
2. **Resources acquired** (token, audio buffer, AudioContext open)
3. **External SDK ready** (Spotify Web Playback `ready` event)
4. **Engine initialized** (analysers wired, layers loaded)
5. **Component mounted** (React lifecycle says go)
6. **Playback active** (actually producing sound)

Treating these as the same boolean produces every bug above. The fix in each case was to **add a state**, not to consolidate them: `markTokenValid` introduced a sixth state in the Spotify player; `prevLayerIdsRef` introduced a per-mount flag in AdditiveSynth; the `this.sourceNode === source` guard introduced an identity check that distinguishes "current" from "previous" sources.

A second lesson: **React strict mode is a forcing function for correctness, not a nuisance.** Every bug it surfaced (AdditiveSynth, SampleEngine staleness) was a real bug that would have shipped without it. Don't disable strict mode; treat its failures as design feedback.

When recommending changes to audio code in this repo, always ask:
- Will React strict mode mount this twice? If yes, what state needs to survive or reset?
- Is there a "ready" boolean? If yes, does it actually conflate two states?
- Is there a Promise that might reject? If yes, use `.catch()` not `try/catch`.
- Is there an `onended`/`onmessage` callback? If yes, does it guard against stale closures?

## Sources

- [[../topics/audio-engine]]
- [[../topics/spotify-integration]]
- [[../topics/studio-synth-sampler]]
- [[../topics/window-architecture]]
- [[../topics/plugin-effects]]
