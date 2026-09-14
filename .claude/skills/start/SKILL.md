---
name: start
description: Start a Math Tactics task by number. Usage: /start <number> (e.g. /start 1, /start 07). Reads CLAUDE.md, TECHNICAL_REFERENCE.md, the relevant GDD sections, and the task file, checks dependencies, creates the task branch, then begins implementation.
---

The user has invoked `/start` with a task identifier. Follow these steps exactly.

## Step 1 — Resolve the task file

Zero-pad numeric identifiers to 2 digits and find the file:

```bash
ls tasks/ | grep "^07-"
```

If no file matches, tell the user and stop. Human tasks (`H0`, `H1`) have no file — tell the user they are theirs.

## Step 2 — Read context in parallel

- `CLAUDE.md`
- `TECHNICAL_REFERENCE.md`
- The task file
- The `GDD.md` sections listed under the task's **References**

## Step 3 — Check dependencies

For each task under **Depends on**, read its **Completion Notes** and its row in `TASKS.md`.
If any dependency is `Not Started`, `In Progress`, or `Blocked`, stop and tell the user which must finish first.

## Step 4 — Read prior completion notes

For `Complete` or `Partial` dependencies, extract **Deviations from spec**, **Architectural decisions made**,
and **Notes for next agent**. These override the task spec where they conflict.

## Step 5 — Branch and mark In Progress

```bash
git checkout main && git pull
git checkout -b task/<NN>-<slug>      # slug from the task filename
```

Set the task's status to `In Progress` in `TASKS.md`.

## Step 6 — Confirm and begin

Output a short brief (3–5 bullets): what this task builds, files to be created/modified, and any dependency
deviations that affect it. Then immediately begin implementing — do not ask for confirmation.

If you hit a design question the GDD does not answer, **stop and ask the human** (CLAUDE.md rule 5).

## Step 7 — On completion

When all acceptance criteria are met and `npm test`, `npm run typecheck`, and `npm run lint` pass
(plus `build` and `test:e2e` for presentation/infra tasks), commit, push, open a PR with `gh pr create`
(title `<NN>: <task title>`, body = acceptance checklist + preview URL note), then run `/finish-task`.
