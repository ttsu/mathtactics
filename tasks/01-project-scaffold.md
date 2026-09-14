# 01 — Project Scaffold & Tooling

**Milestone:** M0 · **Layer:** infra · **Depends on:** — · **Branch:** `task/01-project-scaffold`

## Task

Create the Vite + React + Phaser 4 + TypeScript project with all tooling, scripts, folder layout,
and layer-boundary enforcement, so every later task has a working `npm test` / `typecheck` /
`lint` / `build` / `test:e2e` loop.

## References

- `CLAUDE.md` — pinned versions, commands
- `TECHNICAL_REFERENCE.md` §1 (layout), §2 (layer rules), §16.1 (Playwright)

## Requirements

1. `package.json` with **exact** pinned versions from `CLAUDE.md` (`save-exact`, add `.npmrc` with `save-exact=true`).
   Add `yaml` (latest, exact) for the scenario parser.
2. `.nvmrc` = `24`. `.gitignore`: `node_modules`, `dist`, `playwright-report`, `test-results`,
   `.playwright-browsers`, `.DS_Store`, `coverage`.
3. Folder skeleton per TR §1 with a placeholder `index.ts` (or `.gitkeep`) in each.
4. **TypeScript configs:**
   - `tsconfig.json` (app: `/game`, `/scripts`, `/e2e`, DOM lib, strict, `noUncheckedIndexedAccess`).
   - `tsconfig.sim.json` (`/sim`, `/tests`, `lib: ["ES2023"]`, **no DOM**, strict).
   - `npm run typecheck` runs both.
5. **ESLint** (flat config, typescript-eslint) with the layer rules from TR §2:
   `no-restricted-imports` per directory, and banned `Math.random` / `Date.now` / timers in `/sim`.
   Prettier integrated (`npm run format`, lint does not fight prettier).
6. **Vitest** configured for `/tests/**/*.test.ts` (node environment). One trivial passing test.
7. **Playwright** configured per TR §16.1 (WebKit, 1180×820, DPR 2, touch). `webServer` runs
   `vite build` with `VITE_TEST_HANDLE=1` then `vite preview`. One smoke test: page loads, has a `<canvas>`.
8. **Vite:** `base: "./"`, React plugin. `game/main.tsx` renders a placeholder React root and a Phaser game
   with an empty scene (just enough for the smoke test — real shell is task 03).
9. Scripts: `dev`, `build`, `preview`, `test`, `typecheck`, `lint`, `format`, `sim` (stub in `/scripts/sim.ts`
   printing "not implemented", run via `tsx` or `node --experimental-strip-types` — pick one, document it),
   `test:e2e`.
10. A layer-rule self-test: a vitest or lint fixture proving an import of `phaser` from `/sim` fails lint
    (e.g. run ESLint programmatically on a fixture string).

## Out of Scope

CI workflows (02), app shell/scaling (03), real types or data (04).

## Acceptance Criteria

- [ ] `npm ci && npm test && npm run typecheck && npm run lint && npm run build` all succeed from a clean clone
- [ ] `npm run test:e2e` passes locally (WebKit)
- [ ] Every dependency in `package.json` is an exact version matching `CLAUDE.md`
- [ ] Referencing `document` in `/sim` fails `npm run typecheck`
- [ ] Importing `phaser` or `react` in `/sim`, or `phaser` in `/game/ui`, fails `npm run lint`
- [ ] `Math.random()` in `/sim` fails `npm run lint`
- [ ] If any pinned version is incompatible, the replacement is recorded in `CLAUDE.md` and Completion Notes

## Completion Notes

**Status:** Not Started
