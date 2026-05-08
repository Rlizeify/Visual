# Tool & MCP Server Integration Survey

**Date**: 2026-05-08
**Status**: Complete
**Purpose**: Evaluate tools, MCP servers, and open-source repos for potential integration into VISUAL (Electron desktop) and MHEU (web).

---

## Summary

This survey evaluates 30+ tools across 5 categories. Key findings:
- **MCP ecosystem is mature** — 200+ community servers available as of Q2 2026
- **Audio DSP** — Essentia.js and Meyda.js are standout options for web audio analysis
- **3D/Visual** — Blender MCP is production-ready; Three.js MCP enables natural language scene control
- **OAuth/APIs** — Discord and YouTube viable; Apple Health requires iOS app; MyNetDiary has no public API
- **Viz repos** — projectM WASM port emerging; Butterchurn still best Milkdrop option for web

---

## 1. Audio/DSP Tools

### 1.1 MCP Servers

| Tool | What It Does | Install Cost | License | Fits | Priority |
|------|--------------|--------------|---------|------|----------|
| [mcp-music-analysis](https://github.com/hugohow/mcp-music-analysis) | Librosa + Whisper integration for LLMs. Beat analysis, MFCCs, spectral centroids, onset detection | `npm install` | MIT | Desktop | **Later** |
| [MATLAB MCP Server](https://github.com/matlab/matlab-mcp-core-server) | Official MathWorks server. Run MATLAB from AI agents | Requires MATLAB license | Proprietary | Desktop | Skip |
| [Stem MCP Server](https://lobehub.com/mcp/tolutronics-audio-processing-mcp) | AI-powered stem separation, audio processing for producers | `npm install` | MIT | Desktop | Later |

### 1.2 JavaScript Libraries

| Tool | What It Does | Install Cost | License | Fits | Priority |
|------|--------------|--------------|---------|------|----------|
| [Essentia.js](https://mtg.github.io/essentia.js/) | WebAssembly port of Essentia C++. 100+ MIR algorithms, TensorFlow.js models, real-time analysis | `npm install essentia.js` | AGPL-3.0 | Both | **Now** |
| [Meyda.js](https://meyda.js.org/) | Lightweight audio feature extraction. RMS, MFCCs, spectral features. 3x real-time performance | `npm install meyda` | MIT | Both | **Now** |
| [Tone.js](https://tonejs.github.io/) | Already in use. Active development (commits May 2026). Ecosystem includes React wrappers, Magenta.js | Already installed | MIT | Desktop | N/A |

**Recommendation**: Meyda.js for lightweight feature extraction (beat detection enhancement), Essentia.js for advanced ML-based analysis if needed later.

---

## 2. 3D/Visual Tools

### 2.1 MCP Servers

| Tool | What It Does | Install Cost | License | Fits | Priority |
|------|--------------|--------------|---------|------|----------|
| [Blender MCP](https://github.com/ahujasid/blender-mcp) | Natural language → Blender Python. Scene creation, materials, Polyhaven assets. Socket on port 9876 | Blender addon + Claude Desktop | MIT | Desktop | Later |
| [Three.js MCP](https://github.com/locchung/three-js-mcp) | WebSocket control of Three.js scenes. Object CRUD, camera, lighting via natural language | `npm install` | MIT | Both | Later |
| [mcp-game-asset-gen](https://github.com/Flux159/mcp-game-asset-gen) | Generate images, video, audio, 3D models for game dev | `npm install` | MIT | Desktop | Skip |

### 2.2 Shadertoy Import

| Tool | What It Does | Install Cost | License | Fits | Priority |
|------|--------------|--------------|---------|------|----------|
| [shadertoy-react](https://github.com/mvilledieu/shadertoy-react) | 6KB React component for Shadertoy GLSL. Supports both Shadertoy and classic GLSL syntax | `npm install shadertoy-react` | MIT | Both | **Now** |
| [ShaderMate](https://github.com/Tezumie/ShaderMate) | Lightweight WebGL shader dev. Auto-injects Shadertoy uniforms | `npm install` | MIT | Both | Later |
| [@thi.ng/webgl-shadertoy](https://www.npmjs.com/package/@thi.ng/webgl-shadertoy) | Scaffolding via @thi.ng/shader-ast. Updated May 2026 | `npm install` | Apache-2.0 | Both | Later |

**Recommendation**: shadertoy-react for quick wins on custom shaders in Cockpit. Blender MCP if 3D asset generation becomes a feature.

---

## 3. Data/Chart Tools

### 3.1 MCP Servers

| Tool | What It Does | Install Cost | License | Fits | Priority |
|------|--------------|--------------|---------|------|----------|
| [AntV mcp-server-chart](https://github.com/AntV) | 4,000+ stars. 27 tools, 26+ chart types. Most comprehensive | `npm install` | MIT | Both | Later |
| [mcp-echarts](https://github.com/hustcc/mcp-echarts) | Full ECharts syntax. PNG/SVG/JSON export. 15+ chart types | `npm install` | MIT | Both | Later |
| [Plotly MCP](https://github.com/arshlibruh/plotly-mcp-cursor) | 49+ trace types. Natural language → Plotly HTML | `npm install` | MIT | Both | **Later** |

### 3.2 Audio-Reactive D3

| Tool | What It Does | Install Cost | License | Fits | Priority |
|------|--------------|--------------|---------|------|----------|
| [Visicality](https://github.com/derekwolpert/Visicality) | D3.js + Web Audio visualizer. Customizable designs, color palettes | Reference only | MIT | Web | Skip |
| [Clubber.js](https://github.com/geneome/clubber-app) | Music theory-based audio reactivity | `npm install clubberjs` | MIT | Both | Later |

**Recommendation**: Skip chart MCP servers for now — not aligned with DJ/visualizer focus. Clubber.js worth exploring for music-theory-aware beat detection.

---

## 4. OAuth Providers (Life Score Integration)

### 4.1 Discord API

| Aspect | Details |
|--------|---------|
| **Rate Limits** | Global: 50 req/sec across all routes. Per-route buckets vary |
| **Presence Updates** | 1 update per 15 seconds (SDK auto-queues) |
| **Activity Polling** | Use Gateway for real-time presence, not REST polling |
| **Auth** | OAuth2 + Bot token. `identify`, `activities.read` scopes |
| **Fit** | Both (desktop bot or web OAuth) |
| **Priority** | **Later** — useful for social features |

### 4.2 YouTube Data API v3

| Aspect | Details |
|--------|---------|
| **Quota** | 10,000 units/day default. Resets midnight PT |
| **Costs** | Read: 1 unit. Search: 100 units. Insert: 1,600 units |
| **Higher Quota** | Requires compliance audit |
| **Auth** | OAuth2 or API key |
| **Fit** | Both |
| **Priority** | **Later** — for playlist import or watch history |

### 4.3 Apple HealthKit

| Aspect | Details |
|--------|---------|
| **Web Export?** | **No.** No public server API. HealthKit is iOS-only |
| **Workarounds** | Health Auto Export app → JSON/CSV. Terra SDK (mobile). MCP server exists for local export |
| **Fit** | Desktop only (via export files) |
| **Priority** | **Skip** — requires iOS app or manual export |

### 4.4 MyNetDiary API

| Aspect | Details |
|--------|---------|
| **Public API?** | **No.** Commercial licensing only |
| **Cost** | $40,000 USD initial license. $8,000/year API access after Y1 |
| **Alternative** | Web scraping exists ([data_mynetdiary](https://github.com/talwrii/data_mynetdiary)) but fragile |
| **Fit** | Neither |
| **Priority** | **Skip** — prohibitive cost, no public API |

**Summary Answers**:
- **MyNetDiary API**: No public API. Commercial licensing starts at $40K.
- **Apple Health web export**: Not possible without iOS app. Use Health Auto Export app or Terra SDK.
- **Discord activity polling rate limit**: 50 req/sec global; presence updates 1 per 15 sec.

---

## 5. Open-Source Visualizer Repos

### 5.1 Milkdrop/Butterchurn Ecosystem

| Tool | What It Does | Status | License | Fits | Priority |
|------|--------------|--------|---------|------|----------|
| [Butterchurn](https://github.com/jberg/butterchurn) | WebGL Milkdrop. Already integrated in VISUAL | Active (MIT). 205 commits | MIT | Desktop | N/A |
| [AlaskaButter](https://alaskabutter.com/) | Butterchurn fork with embed/fork/hack features | Active | MIT | Web | Later |
| [projectM WASM](https://github.com/ford442/Project-M) | Emscripten port of projectM. C++ → WebAssembly | Experimental | LGPL-2.1 | Both | **Later** |

### 5.2 Alternative Visualizers

| Tool | What It Does | Status | License | Fits | Priority |
|------|--------------|--------|---------|------|----------|
| [slerp.audio](https://slerp.audio/) | Browser-based shader visualizer. Load local audio | Active | Proprietary | Reference | Skip |
| [ÜBERVIZ](https://www.uberviz.io/) | Custom WebGL + Web Audio visualizers | Active | Proprietary | Reference | Skip |
| [VVavy](https://vvavy.io/) | 120+ built-in audio-reactive visuals | Active | Freemium | Reference | Skip |

### 5.3 Audio Visualization Libraries

| Tool | What It Does | Install Cost | License | Fits | Priority |
|------|--------------|--------------|---------|------|----------|
| [audioMotion-analyzer](https://github.com/hvianna/audioMotion-analyzer) | High-res real-time spectrum analyzer. No dependencies | `npm install` | MIT | Both | **Now** |
| [awesome-audio-visualization](https://github.com/willianjusten/awesome-audio-visualization) | Curated list. 100+ tools, experiments, articles | Reference only | — | Both | Reference |

**Recommendation**: audioMotion-analyzer for enhanced spectrum display. Monitor projectM WASM maturity for potential Butterchurn replacement.

---

## Recommended Next Adds (Top 5)

Ranked by impact-to-effort ratio:

| Rank | Tool | Why | Effort | Impact |
|------|------|-----|--------|--------|
| 1 | **Meyda.js** | Lightweight audio features. Enhances beat detection without replacing Tone.js. MIT license, tiny bundle | Low | High |
| 2 | **shadertoy-react** | Drop-in custom shader support. 6KB. Enables user-imported shaders for Cockpit visualizer panel | Low | Medium |
| 3 | **audioMotion-analyzer** | Professional spectrum analyzer. Zero deps. Complements LJV oscilloscope | Low | Medium |
| 4 | **Essentia.js** | Advanced MIR if ML features needed (genre detection, mood). Heavier than Meyda | Medium | High |
| 5 | **projectM WASM** | Watch for maturity. Could replace Butterchurn with native Milkdrop preset support | High | High |

---

## Decision

- **Integrate Now**: Meyda.js (beat detection), shadertoy-react (custom shaders), audioMotion-analyzer (spectrum)
- **Integrate Later**: Essentia.js (ML), Clubber.js (music theory), Discord API, YouTube API, Three.js MCP
- **Skip**: MyNetDiary (no API), Apple Health (iOS-only), MATLAB MCP (requires license), chart MCPs (off-focus)

---

## Sources

### Audio/DSP
- [mcp-music-analysis](https://github.com/hugohow/mcp-music-analysis)
- [MATLAB MCP Server](https://github.com/matlab/matlab-mcp-core-server)
- [Essentia.js](https://mtg.github.io/essentia.js/)
- [Meyda.js](https://meyda.js.org/)
- [Tone.js](https://tonejs.github.io/)

### 3D/Visual
- [Blender MCP](https://github.com/ahujasid/blender-mcp)
- [Three.js MCP](https://playbooks.com/mcp/locchung-three-js)
- [shadertoy-react](https://github.com/mvilledieu/shadertoy-react)
- [ShaderMate](https://github.com/Tezumie/ShaderMate)

### Data/Charts
- [AntV mcp-server-chart](https://glama.ai/mcp/servers/integrations/antv)
- [mcp-echarts](https://github.com/hustcc/mcp-echarts)
- [Plotly MCP](https://github.com/arshlibruh/plotly-mcp-cursor)
- [Clubber.js](https://github.com/geneome/clubber-app)

### OAuth/APIs
- [Discord Rate Limits](https://discord.com/developers/docs/topics/rate-limits)
- [YouTube Data API Quota](https://developers.google.com/youtube/v3/determine_quota_cost)
- [Apple HealthKit](https://developer.apple.com/documentation/healthkit)
- [MyNetDiary Licensing](https://www.mynetdiary.com/food-database.html)
- [Health Auto Export](https://github.com/Lybron/health-auto-export)

### Visualizers
- [Butterchurn](https://github.com/jberg/butterchurn)
- [projectM](https://github.com/projectM-visualizer/projectm)
- [projectM WASM](https://github.com/ford442/Project-M)
- [audioMotion-analyzer](https://github.com/hvianna/audioMotion-analyzer)
- [awesome-audio-visualization](https://github.com/willianjusten/awesome-audio-visualization)
