---
topic: Agent Workflow
last_compiled: 2026-04-07
status: active
---

# Agent Workflow

## Summary [coverage: high — 5 sources]

Visual treats Claude as an "AI engineering partner" with a rigorous, file-based workflow. Every task is decomposed into discrete steps (no step touches more than 3 files), the plan is stated to the user, then executed step-by-step with verification. The agent reads `context/active.md` and `progress/blockers.md` at session start, surfaces blockers immediately, updates `context/active.md` and `progress/changelog.md` at session end, and moves stale context to `context/stale.md`. Communication style is direct and concise — no filler, no exclamation marks, no "Great question!" — like a senior pair-programming engineer. Mistakes are owned in one sentence, fixed, and logged as patterns so they don't repeat. The infrastructure is directory-based under `.claude/memory/` with six subdirectories (decisions, patterns, context, progress, roadmap) — a deliberate scaling choice over flat files made on 2026-04-04.

## Architecture & Components [coverage: medium — 3 sources]

The agent system lives entirely under `.claude/`:

- `CLAUDE.md` — primary instructions, Rules of Engagement, Do Not list, line cap of 198
- `.claude/AGENT.md` — operational behavior: Task Decomposition, Multi-File Changes, Error Recovery, Session Management, Escalation Rules
- `.claude/SOUL.md` — communication style: Voice, Defaults, On Mistakes, On Uncertainty, Formatting
- `.claude/memory/decisions/index.md` — architecture decision log
- `.claude/memory/patterns/index.md` — recurring patterns observed in the codebase
- `.claude/memory/context/active.md` — current working context (refreshed each session)
- `.claude/memory/context/stale.md` — archived context
- `.claude/memory/progress/changelog.md` — completed work, organized by session
- `.claude/memory/progress/blockers.md` — blocked items
- `.claude/memory/roadmap/{roadmap,priorities}.md` — project direction

Multi-file changes flow in dependency order: types → utils → components → entry points. Modified files are read back after editing.

## Decisions & Rationale [coverage: low — 1 source]

**2026-04-04 — Initialize infrastructure file system.** No CLAUDE.md, memory, agent, or soul files existed. Created the full directory-based memory system under `.claude/memory/` with six subdirectories. Chosen because directory-based structure scales better than flat files and separation of concerns (decisions, patterns, context, progress, roadmap) prevents any single file from becoming unwieldy.

## Patterns & Gotchas [coverage: medium — 2 sources]

- **Read before writing.** Never modify a file not read in the current session.
- **Decompose, state, then execute.** No step should touch more than 3 files.
- **Ask when ambiguous and risky; act when ambiguous and low-risk, then document.**
- **Commit messages**: imperative, <72 char subject, body explains *why*. Format: `type: description` (fix|feat|refactor|perf|docs|chore).
- **Pattern doubling rule**: when a pattern is seen twice, log it in `patterns/index.md`.
- **Decision logging**: every architectural decision goes in `decisions/index.md`.
- **No expansion**: do not add features, tests, or docs beyond what was asked.
- **Never delete files** without explicit user confirmation — always archive to `src/archive/`.
- **CLAUDE.md line cap**: hard cap of 198 lines, count after every edit.

## History & Changelog [coverage: low — 1 source]

- **2026-04-04** — Infrastructure initialization. Created CLAUDE.md, AGENT.md, SOUL.md, and the full memory directory tree. Performed full codebase scan and populated memory.

## Open Threads [coverage: low — 1 source]

No agent-workflow blockers. The blockers file is currently empty. The system is stable and in active use across all sessions logged in the changelog.

## Sources

- [[../../../.claude/AGENT]]
- [[../../../.claude/SOUL]]
- [[../../../.claude/memory/decisions/index]]
- [[../../../.claude/memory/progress/blockers]]
- [[../../../.claude/memory/progress/changelog]]
