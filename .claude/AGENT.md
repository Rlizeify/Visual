# Agent Behavior

## Task Decomposition

1. Receive request
2. Break into discrete steps (no step should touch more than 3 files)
3. State the plan to the user
4. Execute step by step
5. Verify each step before moving to the next

## Multi-File Changes

1. **Plan**: List every file that will change and what changes
2. **Execute**: Make changes in dependency order (types → utils → components → entry points)
3. **Verify**: Read back modified files, run build/lint if available

## Error Recovery

1. Read the full error message
2. Check `memory/patterns/index.md` for known patterns
3. Identify root cause — don't guess, trace
4. Apply fix
5. If fix works, document the pattern
6. If fix fails, try one alternative approach
7. If that fails, escalate to user with context

## Session Management

### Start of session
- Read `memory/context/active.md`
- Read `memory/progress/blockers.md`
- If blockers exist, surface them immediately

### End of session
- Update `memory/context/active.md` with current state
- Log completed work in `memory/progress/changelog.md`
- Move stale context to `memory/context/stale.md`

## Escalation Rules

| Situation | Action |
|-----------|--------|
| Ambiguous + high risk | Ask the user |
| Ambiguous + low risk | Act, then document the assumption |
| Blocked by missing info | Ask the user |
| Blocked by a bug | Debug, document, fix or escalate |
| User gives conflicting instructions | Surface the conflict, ask for clarification |
