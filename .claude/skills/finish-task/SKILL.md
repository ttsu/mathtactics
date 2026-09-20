---
name: finish-task
description: Run at the end of a Math vs. Robots agent session to write Completion Notes into the active task file and update TASKS.md status. Reviews the branch diff, checks acceptance criteria, identifies deviations from spec, and writes notes for the next agent.
---

# Finish Task

Close out a work session by recording what was actually built.

## 1. Identify the active task

Read `TASKS.md` and find the task marked `In Progress`. If none, infer from the current branch name (`task/NN-slug`).

## 2. Read the task spec

Read the full task file, including acceptance criteria.

## 3. Review what was built

```bash
git log main..HEAD --oneline
git diff main...HEAD --stat
git diff main...HEAD
```

Understand each changed file and compare against the task spec, `TECHNICAL_REFERENCE.md`, and `CLAUDE.md` rules
(layer boundaries, no hardcoded tuning, tests on event lists, pinned versions).

## 4. Verify

Run and record results:

```bash
npm test && npm run typecheck && npm run lint
```

For presentation or infra tasks also run `npm run build` and `npm run test:e2e`. Do not mark criteria Met
without evidence. Criteria marked "human check" stay unchecked with a note: "awaiting human check on preview".

## 5. Write Completion Notes

Replace the task file's `## Completion Notes` section:

```markdown
## Completion Notes

**Status:** Complete | Partial | Blocked
**Completed:** YYYY-MM-DD
**PR:** #<n> · Preview: https://mathtactics.timtsu.com/pr/pr-<n>/

**Acceptance criteria:**
- [x] criterion — Met
- [~] criterion — Partial: what's missing
- [ ] criterion — Not met: why

**Verification:** npm test ✔ · typecheck ✔ · lint ✔ · build ✔ · e2e ✔ (list what was run)

**Deviations from spec:**
- Specific differences from the task spec, TECHNICAL_REFERENCE.md, or GDD, and why.

**Architectural decisions made:**
- Decisions not covered by the spec that future agents need.

**Design questions raised:**
- Anything escalated to (or needing) the human.

**Known issues / follow-up:**
- Incomplete work, bugs found, tech debt.

**Files created:** …
**Files modified:** …

**Notes for next agent:**
- The single most important thing to know before touching these systems.
```

If a deviation changes architecture, also update `TECHNICAL_REFERENCE.md` in the same PR.

## 6. Update TASKS.md

Set status to `Complete`, `Partial` (with a short parenthetical), or `Blocked`. Commit and push both files to the PR branch.

## 7. Report

Summarize: task completed, criteria met/not met, deviations that matter, human checks needed on the preview,
and the next `Not Started` task whose dependencies are now satisfied.

Be honest: write the actual state, not the intended state. A partial session is `Partial`, never `Complete`.
