# Scheduled-Agent Skill Loading — Findings

**Date**: 2026-05-24
**Context**: The scheduled remote agent that built Asian Vibrant
reported a grep for the `frontend-design` skill returned empty. This
file diagnoses why and what to do about it.

## Local environment probe

Running Claude Code locally on Windows (this session, 2026-05-24):

```
$ ls /mnt/skills/public/
ls: cannot access '/mnt/skills/public/': No such file or directory

$ ls /mnt/skills/
ls: cannot access '/mnt/skills/': No such file or directory

$ ls /mnt/
ls: cannot access '/mnt/': No such file or directory
```

Local Windows Claude Code has **no `/mnt/` tree at all**. Skills are
still available to the session — `frontend-design`,
`update-config`, `simplify`, `loop`, `schedule`, `claude-api`,
`keybindings-help` are all listed in the system-reminder and callable
through the `Skill` tool — but they are NOT exposed as files on disk.

## Hypothesis: where skills actually live

Skills are surfaced to Claude through the **Skill tool**, not through
a filesystem path. The mount path `/mnt/skills/public/` is an
implementation detail of the Linux-hosted Anthropic harness used by
some agents (notably the scheduled-trigger / remote-agent harness).
It is NOT a contract any Claude Code session can rely on:

| Harness                          | Skills via `/mnt/skills/`? | Skills via `Skill` tool? |
|----------------------------------|----------------------------|--------------------------|
| Claude Code local (Windows)      | No                         | Yes                      |
| Claude Code local (macOS / Linux) | Likely no                  | Yes                      |
| Anthropic-hosted dev container   | Yes                        | Yes                      |
| Scheduled/remote agent           | **Unknown / inconsistent** | **Unknown / inconsistent** |

The remote agent's empty grep is consistent with the hypothesis that
its harness either did not mount `/mnt/skills/public/` or did not
surface the Skill tool at all for that invocation.

## What can NOT be done

- **Cannot copy the skill content from `/mnt/skills/public/` into
  `.claude/skills/`** — the source path does not exist in this
  environment. We have no canonical text to copy.
- **Cannot grep skill content from the cron-triggered agent's
  filesystem** — we don't share its mount.

## What we can do (and did)

1. **Stop relying on `/mnt/skills/public/` from any agent.** Use the
   `Skill` tool to invoke skills by name. If the tool is not present,
   the harness has no skills regardless of mount.
2. **Project-local fallback prompts.** When a remote / scheduled agent
   needs guidance from a skill, embed the relevant snippet directly in
   the agent prompt or in a project-local `.claude/skills/<name>.md`
   note that the agent can read with the standard `Read` tool. This
   sidesteps the entire mount question.
3. **Document the pattern.** See
   `.claude/memory/patterns/scheduled-agent-workflow.md`.

## Next step

When the next scheduled agent is queued, paste any required skill
guidance directly into its prompt or into a small project-local file
under `.claude/skills/`. Do not assume `/mnt/skills/public/` exists.
