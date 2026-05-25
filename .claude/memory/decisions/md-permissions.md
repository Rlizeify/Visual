# Decision: Pre-authorize .md edits (2026-05-25)

## Context

Claude Code prompts for permission on every file edit. During long
sessions this interrupts flow, especially for memory file updates
which happen constantly. Stone wanted .md edits auto-approved.

## Decision

Created `.claude/settings.json` with a permissions allow-list:
- `Edit(.claude/)` and `Write(.claude/)` — all files under .claude/
- `Edit(CLAUDE.md)`, `Write(CLAUDE.md)` — root markdown files
- Same for CHANGELOG.md, ROADMAP.md, README.md

This is project-level config (committed to git), not user-level.

## Why Not Broader

The permission system supports prefix matching only, not suffix
globs. `*.md` anywhere in the repo isn't expressible. We chose to:
1. Cover the high-frequency paths (.claude/, root docs)
2. Accept that arbitrary .md files elsewhere still prompt
3. Expand later if specific paths become annoying

Deliberately did NOT add:
- `"Edit"` or `"Write"` blanket allows — defeats safety model
- `"Bash(rm:*)"` or other dangerous patterns
- Auto-allow for code files (.ts, .tsx, .css)

## Alternatives Considered

1. **User-level settings** — wouldn't apply to teammates or fresh
   machines.
2. **Blanket Edit allow** — too broad, loses the safety benefit.
3. **Hooks to auto-approve** — overkill for this use case.

## Test Plan

In the next Claude Code session, edit any .md file under
`.claude/memory/` and observe that no permission prompt appears.
