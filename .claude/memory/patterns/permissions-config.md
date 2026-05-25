# Permissions Config Pattern

## What It Does

`.claude/settings.json` pre-authorizes Edit and Write operations for:
- All files under `.claude/` (memory, decisions, patterns, progress,
  AGENT.md, SOUL.md, etc.)
- Root-level markdown: CLAUDE.md, README.md, CHANGELOG.md, ROADMAP.md

## Why Only Markdown

1. **Low risk.** Markdown is documentation, not executable code.
2. **High frequency.** Every session updates memory files; prompts
   were interrupting flow.
3. **Reversible.** Git tracks all changes; mistakes are trivially
   undone.
4. **Scoped.** Code changes still require normal permission handling.

## Permission Syntax

```
"Edit(.claude/)"     # path prefix — matches any file starting with .claude/
"Write(CLAUDE.md)"   # exact file at repo root
```

The system uses prefix matching, not glob patterns. `*.md` (suffix
match) is NOT supported — only path prefixes.

## Expanding the Allow List

Edit `.claude/settings.json`:
```json
{
  "permissions": {
    "allow": [
      "Edit(.claude/)",
      "Edit(docs/)",           // add new path prefix
      "Bash(npm run lint:*)"   // add bash pattern
    ]
  }
}
```

**Warning:** Broad patterns like `"Edit"` (all edits) or
`"Bash(rm:*)"` defeat the safety model. Keep allows minimal and
specific.

## Applies To

- All Claude Code sessions in this repo
- Committed to git, so applies to teammates too
- Overridable in `.claude/settings.local.json` (not committed)
