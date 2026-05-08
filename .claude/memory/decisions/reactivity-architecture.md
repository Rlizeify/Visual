# Reactivity Architecture Decision

**Date**: 2026-05-08
**Status**: Decided
**Context**: Pick architecture for true audio reactivity on Samsung Tizen TV browser with Spotify source and near-zero user setup.

---

## Summary

| Path | Verdict | Why |
|------|---------|-----|
| A — Pure web | **KILLED** | Spotify Web Playback SDK blocks audio analysis via DRM |
| B — Desktop host + LAN | **RECOMMENDED** | True reactivity, one install, zero setup for viewers |
| C — Cloud relay | Viable fallback | Cross-network reach, but adds latency + cost |

---

## Path A — Pure Web (No Install)

**Concept**: Run Spotify Web Playback SDK in browser, route `<audio>` through `MediaElementAudioSourceNode` → `AnalyserNode` for FFT.

### Findings

1. **DRM blocks audio routing.** The SDK wraps playback in an encrypted iframe using EME/Widevine. The `<audio>` element is inaccessible.
2. **Spotify explicitly refuses AnalyserNode access.** [GitHub issue #25](https://github.com/spotify/web-playback-sdk/issues/25) requested this feature; Spotify declined citing anti-piracy.
3. **No workaround without DRM stripping** (illegal, TOS violation).

### Verdict

**KILLED.** Path A is technically impossible.

---

## Path B — Desktop Host + LAN WebSocket

**Concept**: Desktop Electron app captures system audio via WASAPI loopback, runs FFT, broadcasts bands + beat data over WebSocket. Web clients on LAN connect and render viz.

### Findings

| Dimension | Assessment |
|-----------|------------|
| **Feasibility** | High. WASAPI loopback is proven (Audacity, OBS). Electron can use `naudiodon` or `setDisplayMediaRequestHandler({ audio: 'loopback' })`. FFT via Web Audio AnalyserNode or custom. |
| **Tizen compat** | WebSocket: **supported** ([Tizen API](https://developer.samsung.com/smarttv/develop/api-references/tizen-web-device-api-references.html)). Caveat: TV must be on same subnet as host. |
| **Latency** | <50ms total (capture → FFT → send → render). WebSocket over LAN is ~1-5ms. |
| **Setup friction** | One person installs desktop app. Viewers open URL — no install. |
| **Dev cost** | Medium. Need: WASAPI/loopback module, FFT → JSON serializer, WebSocket server, mDNS broadcast, firewall auto-config wizard, simple web client. |
| **Ongoing cost** | Zero (runs on user's machine). |

### Implementation Sketch

```
┌─────────────────────────────────────────────────────────────┐
│ Desktop Host (Windows)                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌───────────────┐   │
│  │ WASAPI loop │───▶│ AnalyserNode│───▶│ WebSocket srv │   │
│  │ (all audio) │    │ FFT 60/sec  │    │ :8765         │   │
│  └─────────────┘    └─────────────┘    └───────┬───────┘   │
│                                                 │           │
│  mDNS advertises _visual-audio._tcp             │           │
└─────────────────────────────────────────────────│───────────┘
                                                  │ LAN
                 ┌────────────────────────────────┼────────────┐
                 │                                ▼            │
                 │  ┌────────────┐   ┌────────────────────┐   │
                 │  │ Tizen TV   │   │ Phone/tablet/PC    │   │
                 │  │ browser    │   │ browser            │   │
                 │  │ ws://host  │   │ ws://host:8765     │   │
                 │  └────────────┘   └────────────────────┘   │
                 │  Web client renders viz from band data     │
                 └────────────────────────────────────────────┘
```

### Data Format

```json
{
  "ts": 1715180400123,
  "bands": [0.8, 0.6, 0.4, 0.3, 0.2, 0.1, 0.05, 0.02],
  "beat": true,
  "bpm": 128
}
```

~100 bytes/msg × 60/sec = 6KB/s — trivial for LAN.

### Discovery UX

1. Desktop app starts → creates firewall rule (via `netsh` or Windows prompt) → starts mDNS `_visual-audio._tcp` service.
2. Web client on TV opens `http://visual.local` or `http://192.168.x.x:8080`.
3. Client auto-discovers host via mDNS or user enters IP (fallback for TVs with no mDNS support).

### Risks

- **Tizen mDNS**: May not be supported. Fallback: display QR code with URL on desktop app.
- **Firewall**: Windows may prompt user. Wizard should handle automatically or guide clearly.
- **Cross-subnet**: Won't work across VLANs. Document limitation.

### Verdict

**RECOMMENDED.** Best balance of true reactivity, minimal setup, and zero ongoing cost.

---

## Path C — Hybrid Cloud Relay

**Concept**: Desktop host pushes analysis data to cloud relay. Web clients pull from relay. Works across networks.

### Findings

| Dimension | Assessment |
|-----------|------------|
| **Feasibility** | Medium. Vercel Edge doesn't support WebSocket natively ([Vercel KB](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections)). Need third-party relay. |
| **Relay options** | **Pusher**: 200K msgs/day free, then $49+/mo. **Ably**: 6M msgs/mo free, $2.50/M after. **PubNub**: enterprise pricing. |
| **Latency** | 65-100ms round trip (desktop → relay → client). Noticeable for beat sync. |
| **Cross-network** | Yes — works anywhere with internet. |
| **Dev cost** | Low-medium. Push to Pusher/Ably API, client subscribes. |
| **Ongoing cost** | At 60 msgs/sec: 5.2M msgs/day → **exceeds all free tiers**. Ably: ~$13/day = $390/mo. Pusher: blocked at 200K. |

### When Path C Makes Sense

- Remote parties (different networks, cities).
- Demo/showcase where host can't be on same LAN as viewers.
- One-off events where cost is acceptable.

### Hybrid Approach

Could offer Path B by default (LAN) with optional Path C relay for remote viewers. Desktop app has toggle: "Allow remote viewers (uses cloud relay, may incur cost)."

### Verdict

**Viable fallback**, but not primary. Cost is prohibitive at 60Hz, and latency degrades beat sync.

---

## Decision

**Implement Path B (Desktop Host + LAN WebSocket) as primary architecture.**

### Rationale

1. **True reactivity** — <50ms latency preserves beat sync.
2. **Zero ongoing cost** — no cloud bills.
3. **Minimal setup** — one person installs, everyone else opens a URL.
4. **Tizen compatible** — WebSocket is supported; mDNS fallback via QR/IP.
5. **Path A is impossible** — Spotify DRM blocks analysis.
6. **Path C too expensive** — 60Hz messaging blows through free tiers.

### Future Consideration

If remote-viewer demand emerges, add optional Path C relay behind a toggle. Reduce message rate to 10-15Hz for cost control (acceptable for ambient viz, not beat-sync).

---

## Implementation Priority

1. **Phase 1**: WASAPI loopback → FFT → WebSocket server in Electron. Hardcoded IP.
2. **Phase 2**: mDNS broadcast + firewall wizard.
3. **Phase 3**: Polished web client (Butterchurn or lightweight shader-based viz).
4. **Phase 4** (optional): Cloud relay toggle for remote viewers.

---

## Sources

- [Spotify Web Playback SDK — AnalyserNode denied](https://github.com/spotify/web-playback-sdk/issues/25)
- [Spotify DRM/Widevine discussion](https://community.spotify.com/t5/Spotify-for-Developers/Need-a-solution-to-this-DRM-problem-in-Web-Playback-SDK/td-p/6487515)
- [WASAPI Loopback — Microsoft Docs](https://learn.microsoft.com/en-us/windows/win32/coreaudio/loopback-recording)
- [Tizen Web API — WebSocket](https://developer.samsung.com/smarttv/develop/api-references/tizen-web-device-api-references.html)
- [mDNS in Node.js — bonjour](https://github.com/watson/bonjour)
- [Vercel WebSocket limitations](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections)
- [Ably vs Pusher pricing 2026](https://ably.com/compare/ably-vs-pusher)
