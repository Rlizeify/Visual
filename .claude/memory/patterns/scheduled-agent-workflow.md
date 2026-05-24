# Scheduled-Agent Workflow — Pattern

**Observed**: 2026-05-24, after the Asian Vibrant scheduled build
reported it could not find the `frontend-design` skill in its
`/mnt/skills/public/` tree.

**Pattern**: Remote / scheduled-trigger agents run in a harness that
does NOT share the local Claude Code environment. Anything not
checked into the repo or pasted into the prompt is uncertain to be
available.

## What is reliably available to a scheduled agent

- The repository contents at the commit it checked out.
- The contents of any file the agent reads with the `Read` tool
  (including `.claude/...` files).
- The set of tools listed at the top of its prompt (Read, Edit,
  Write, Bash, Glob, Grep, etc).
- The prompt text itself.

## What is NOT reliably available

- `/mnt/skills/public/` or any other host-filesystem mount. Local
  Claude Code on Windows confirms this path does not exist (see
  `.claude/memory/progress/scheduled-agent-skill-loading.md`).
- The `Skill` tool (it may be a deferred tool that never gets
  surfaced for a non-interactive run).
- Memory files written by previous interactive sessions IF they
  weren't committed to the repo before the agent ran.
- Anthropic CLI skills (`frontend-design`, etc) — even when the tool
  exists, it may resolve no body.
- Environment variables and credentials the local shell has.

## Workflow rules

1. **Anything the agent must know goes in the repo.** If a skill,
   pattern, or decision matters for the agent's task, it must be
   readable via `Read` from a path inside the working tree.
   Project-local skill notes live at `.claude/skills/<name>.md`.
2. **Inline critical guidance in the prompt.** The scheduled-agent
   prompt should restate non-negotiable constraints (function-budget,
   token discipline, archive policy) instead of trusting the agent
   to find them.
3. **Commit before scheduling.** If a session updates `.claude/`
   memory that the next scheduled run depends on, those changes must
   be on `main` (or the branch the trigger targets) before the
   trigger fires.
4. **Treat tool absence as a class of failure.** If the agent reports
   "skill not found" or "tool not surfaced", do not retry on the
   same prompt — paste the substance inline and re-queue.
5. **Verify environment in the first 1-2 tool calls.** A scheduled
   agent should `Bash(ls -la /mnt 2>&1 ; printenv | grep -i node)`
   early and stash any divergence from local expectations so the
   debugging trail is in the log.

## Local vs scheduled — quick decision tree

```
Does this task need a runtime that is only on my laptop
  (Vercel CLI session, browser, local Supabase)?         -> Run local.
Does it need to fire on a cron?                          -> Schedule it.
Does it need a skill that doesn't exist as a file in the
  repo?                                                  -> Inline it
                                                              into the
                                                              prompt or
                                                              copy to
                                                              .claude/
                                                              skills/.
```

## Cross-refs

- `.claude/memory/progress/scheduled-agent-skill-loading.md` —
  primary findings doc.
- `.claude/memory/decisions/theme-lock-safety.md` — applies the
  pattern in the small: themes ship lock-safe so a buggy remote
  build doesn't strand the user.
