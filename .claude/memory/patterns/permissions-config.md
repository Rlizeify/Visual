# Permissions Config Pattern

## Goal

Zero permission interruptions for SAFE writes. Stone walks away from
long sessions; nothing should block on a prompt for a routine
documentation or migration write. Code changes outside the archive
still flow through normal review.

## What's Pre-authorized (`.claude/settings.json`)

Edit + Write are allowed on:

- `.claude/` — entire tree (memory, decisions, patterns, audits)
- Root markdown + meta: `CLAUDE.md`, `AGENT.md`, `SOUL.md`,
  `README.md`, `CHANGELOG.md`, `ROADMAP.md`, `LICENSE`, `.gitignore`
- `web/docs/` — any extension
- `web/supabase/migrations/` — SQL files
- `web/public/` — manifesto.md, reference assets, asset additions
- `web/src/archive/` — archival writes (never destructive)

Explicit `deny`:

- `.env`, `.env.local`, `.env.production` (repo root + `web/`)
- `web/.vercel/` — link state, must stay clean

## Permission System Rules (observed)

1. **Prefix matching only.** `Edit(web/docs/)` matches every file
   whose path starts with `web/docs/`. There is no suffix glob —
   `Edit(*.md)` to catch every markdown file anywhere is NOT
   expressible.
2. **Per-tool granularity.** Each entry is scoped to a tool
   (`Edit`, `Write`, `Bash`, etc.). `Edit` and `Write` are listed
   separately.
3. **`deny` overrides `allow`.** A denied path is refused outright,
   not prompted.
4. **Project-level config (`.claude/settings.json`) is committed and
   applies to all sessions / teammates.** User-level overrides go in
   `.claude/settings.local.json` (gitignored).
5. **Changes take effect for the NEXT session.** The current session
   uses whatever rules it loaded at start.

## Expansion Principle

When a new safe high-frequency path keeps prompting, ADD it
immediately and document why. The bar is:

- **Safe**: documentation, migrations, public assets, archival.
- **High-frequency**: enough that prompting interrupts flow.
- **Reversible**: git tracks it; mistakes undo trivially.

Do NOT pre-authorize:

- `web/src/` (application source — code review matters)
- `web/api/` (serverless functions — affect deployed behavior)
- `.env*` files (secrets)
- Anything that affects shared infrastructure or external services.

## Workflow When a Prompt Hits

1. If the path matches the "safe" criteria above, suggest Stone
   add the prefix to `.claude/settings.json` in the same session.
2. The current session still prompts — accept the prompt and proceed.
3. The next session won't prompt for that prefix.

## Syntax Examples

```json
{
  "permissions": {
    "allow": [
      "Edit(.claude/)",
      "Edit(web/docs/)",
      "Write(web/supabase/migrations/)"
    ],
    "deny": [
      "Edit(.env)",
      "Write(web/.vercel/)"
    ]
  }
}
```

## Related Decisions

- `decisions/md-permissions.md` — original .md auto-allow rationale,
  superseded/extended by the 2026-05-30 broadening.
