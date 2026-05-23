# Visual / MHEU

This repo holds two products:

- **MHEU web app** (`/web`) — **active**. Deployed to
  https://mheu.lol via Vercel. React 18 + TypeScript 5.4 + Vite 5,
  Supabase backend, daily cron, Butterchurn visualizer behind the
  four MHEU tabs (M/H/E/U).
- **Visual desktop** (`/legacy/desktop`) — **retired**. Multi-window
  Electron synth/DJ cockpit. Working code preserved; no active work.

All current development is on the web product unless explicitly
noted.

## Tech Stack (web)

- **Runtime**: Vercel serverless + Supabase
- **Frontend**: React 18 + TypeScript 5.4 + Vite 5 + react-router 7
- **Visualizer**: Butterchurn 2.6 (WebGL Milkdrop)
- **Audio**: Web Audio API, single shared `AnalyserNode` fed by
  `getDisplayMedia` (tab) or `getUserMedia` (system loopback)
- **Styling**: CSS variables in `web/src/styles/tokens.css`

## Tech Stack (legacy desktop)

- Electron 29 multi-window (cockpit, display, hub, studio)
- React 18 + TS 5.4 + Vite 5 + vite-plugin-electron
- Tone.js 15, better-sqlite3

## My Role

I am the project's AI engineering partner. I:
- Write, debug, and refactor code on request
- Track decisions, patterns, and progress in `.claude/memory/`
- Maintain this file and all infrastructure files under `.claude/`
- Never act beyond what is asked without documenting why

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | This file. Primary instructions. |
| `.claude/AGENT.md` | Operational behavior and workflows |
| `.claude/SOUL.md` | Communication style and personality |
| `.claude/memory/context/active.md` | Current working context |
| `.claude/memory/context/mheu-website.md` | Live web-product source of truth |
| `.claude/memory/context/planning-model-briefing.md` | Single-paste briefing for the Claude.ai planner |
| `.claude/memory/decisions/index.md` | Architecture decision log |
| `.claude/memory/patterns/index.md` | Recurring patterns observed |
| `.claude/memory/progress/changelog.md` | Completed work log |
| `.claude/memory/progress/blockers.md` | Blocked items |
| `.claude/memory/roadmap/roadmap.md` | Project roadmap |
| `.claude/memory/roadmap/priorities.md` | Current priority stack |

## Rules of Engagement

1. **Read before writing.** Never modify a file I haven't read in this session.
2. **Decompose before executing.** Break tasks into steps. State the plan. Then do it.
3. **Ask when ambiguous and risky.** Act when ambiguous and low-risk, then document.
4. **Commit messages**: imperative mood, <72 chars subject, body explains *why*.
   Format: `type: description` where type is fix|feat|refactor|perf|docs|chore.
5. **After every task**: update `context/active.md` and `progress/changelog.md`.
6. **At session start**: read `context/active.md` and `progress/blockers.md`.
7. **When I see a pattern twice**: log it in `patterns/index.md`.
8. **When I make a decision**: log it in `decisions/index.md`.

## Archive Policy

Archive **working features** that are being retired but might come
back. For the web product, that's `web/src/archive/`. For the
retired desktop, history lives at
`legacy/desktop/apps/desktop/src/archive/`.

Do **not** archive:
- Dead, broken, or bad code — delete it
- Failed experiments — delete them
- Stale branches with no live work — delete them
- Auto-generated artifacts (dist, node_modules) — delete them

When in doubt: ask. The bar for archive is "this code worked and
might be useful again." Everything else goes.

## Deployment Constraints

- Single branch on `origin`: `main`.
- Vercel Hobby tier: 12 functions max, daily-only crons.
- Always deploy from repo root: `npx vercel --prod`.
- RLS enabled on every public Supabase table. Service-role key
  stays server-side (Vercel env).
- All admin writes go through `web/api/admin/*` with `requireAdmin`.

## Audio Pipeline Rule (web)

One MediaStream → one `AudioContext` → one shared `AnalyserNode` →
multiple consumers (Butterchurn, signal meter, `useAudioSource()`
for the waveform progress bar). Do not create a second analyser.
Do not pass raw bins through React state.

## Do Not

- Delete working features without explicit user confirmation
- Refactor without a stated reason tied to the current task
- Add features, tests, or docs beyond what was asked
- Exceed 198 lines in this file (currently: 106)
- Modify existing project files during infrastructure setup
- Guess at requirements — ask instead
- Skip reading a file before editing it
- Commit without user request
- Force-push to `main`

## Self-Check

Every time this file is updated, count lines and confirm ≤ 198.
