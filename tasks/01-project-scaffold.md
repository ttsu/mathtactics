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

**Status:** Complete
**Completed:** 2026-09-14
**PR:** not yet opened

**Acceptance criteria:**
- [x] `npm ci && npm test && npm run typecheck && npm run lint && npm run build` all succeed from a clean clone — Met (ran `rm -rf node_modules dist && npm ci` then all four in sequence; all green)
- [x] `npm run test:e2e` passes locally (WebKit) — Met (`npx playwright install webkit` run first; 1 passed)
- [x] Every dependency in `package.json` is an exact version matching `CLAUDE.md` — Met (`grep -E '[\^~]' package.json` → none found; all 13 pinned packages match the table verbatim)
- [x] Referencing `document` in `/sim` fails `npm run typecheck` — Met (verified with a real temp file `sim/core/__tmp_dom_check.ts`, then deleted; error TS2584 `Cannot find name 'document'`)
- [x] Importing `phaser` or `react` in `/sim`, or `phaser` in `/game/ui`, fails `npm run lint` — Met (verified with 3 real temp files, each triggering `no-restricted-imports`, then deleted)
- [x] `Math.random()` in `/sim` fails `npm run lint` — Met (verified with a real temp file, triggering `no-restricted-properties`, then deleted)
- [x] If any pinned version is incompatible, the replacement is recorded in `CLAUDE.md` and Completion Notes — N/A: all pinned versions in `CLAUDE.md` resolved and installed as specified, no incompatibilities found (see Deviations for the two peer-dependency checks that were run to confirm this)

**Verification:**
- `npm ci` — 153 packages installed, 0 vulnerabilities
- `npm test` — `Test Files 2 passed (2)`, `Tests 5 passed (5)`, ~470ms, no warnings
- `npm run typecheck` — `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.sim.json --noEmit`, both clean
- `npm run lint` — `eslint .`, 0 errors/warnings
- `npm run build` — `vite build` succeeds; one informational Rollup chunk-size warning (Phaser is ~1.5MB minified, unavoidable at this stage — no code-splitting work is in scope for task 01)
- `npm run test:e2e` — `1 passed (webkit)`, page loads, `<canvas>` visible
- All 5 negative acceptance criteria independently verified with real temporary files under `sim/` and `game/ui/`, created and then deleted (not committed); also spot-checked the non-acceptance-criteria layer rules from TR §2 (node builtins and `node:*` banned in `/sim`, `yaml` banned in `/sim` outside `/sim/scenario` and allowed inside it, relative imports reaching `/game` from `/sim` banned, `phaser` banned in `/game/state`, `/game/board` ↔ `/game/ui` cross-imports banned) — all fired as expected.

**Deviations from spec:**
- `@types/node` pinned at `24.13.4` (latest 24.x, matching the Node 24 engine) rather than the npm-latest `26.5.1`, since `@types/node` isn't in the CLAUDE.md pinned table and should track the Node major in `.nvmrc`. Recorded here per the "unlisted supporting dev deps" instruction, not a CLAUDE.md change.
- Confirmed compatibility before installing: `typescript-eslint@8.70.0` peer-requires `typescript ">=4.8.4 <6.1.0"` (satisfied by `6.0.3`) and `eslint "^8.57.0 || ^9.0.0 || ^10.0.0"` (satisfied by `10.10.0`); `vitest@5.0.0` peer-requires `vite "^6.4.0 || ^7.0.0 || ^8.0.0"` (satisfied by `8.3.0`) and `@types/node ">=24.0.0"` (satisfied). No pinned version needed to change.
- `scripts/sim.ts` runs via **`tsx`** (not `node --experimental-strip-types`): it's stable, zero-config, and needs no per-invocation Node flag; the choice is documented in the script's header comment.
- `no-restricted-imports` patterns approximate "reaching into /game" and the `/game/board` ↔ `/game/ui` cross-ban using glob patterns on import specifiers (e.g. `**/game/**`, `**/ui/**`, `**/board/**`) since there are no path aliases in this project — real relative imports were used to verify these fire correctly (see Verification). This is inherently a specifier-text heuristic, not an AST-resolved path check; it's the standard approach for `no-restricted-imports` and matches how TR §2 phrases the rule.
- Added `.gitkeep` (not `index.ts`) to `/data`, `/scenarios`, `/public`, `/tests/game` since those hold non-TS content (JSON/YAML/no files yet) — `index.ts` would be a dead placeholder module there.
- `chunkSizeWarningLimit` was left at Vite's default; the build succeeds with an informational (non-fatal) warning about the Phaser bundle. Left as-is rather than papering over it, since code-splitting is a real future decision, not a scaffold concern.

**Architectural decisions made:**
- ESLint flat config (`eslint.config.js`) uses `typescript-eslint`'s non-type-checked `recommended` config, not `recommendedTypeChecked`. Type-aware linting would require every linted file to resolve against `tsconfig.json` or `tsconfig.sim.json` via `parserOptions.project`, which adds lint latency and fragility (any file outside both configs' `include` globs breaks). Nothing in the task requires type-aware lint rules; layer boundaries and banned globals are both plain syntactic rules. If a later task wants type-aware rules, it can add `projectService` deliberately.
- The Vitest config lives inside `vite.config.ts` (via `vitest/config`'s `defineConfig`) rather than a separate `vitest.config.ts`, to avoid two files with two separate `react()` plugin registrations drifting apart. `environment: 'node'`; test files import `describe`/`it`/`expect` from `'vitest'` explicitly (no `globals: true`) so no ambient Vitest types are injected into `tsconfig.sim.json`, keeping the "no DOM lib leaks into /sim" guarantee airtight.
- Playwright's `iPad (gen 11) landscape` device descriptor was used as the closest built-in base (this Playwright version has no literal "iPad 10th generation" entry), with `viewport`, `deviceScaleFactor`, `isMobile`, `hasTouch` explicitly overridden to the TR §16.1 values (1180×820, DPR 2, true, true) so the base descriptor's own viewport/DPR never leaks through.
- `game/main.tsx` mounts Phaser into `#board-root` and React into `#ui-root` (the two-root DOM structure TR §11.1 specifies), with an empty `BootScene`. This is intentionally minimal — no scaling, no store wiring, no design-space constants — since task 03 owns the real app shell.

**Design questions raised:**
- None. No GDD/TR gaps were hit; where TR left a detail unspecified (exact `no-restricted-imports` patterns, which iPad device descriptor to start from), the call was mechanical enough to make and record above rather than escalate.

**Known issues / follow-up:**
- The single JS bundle is ~1.6MB (425KB gzipped) because Phaser is fully bundled with no code-splitting. Not a defect for task 01 (out of scope), but likely worth a dynamic `import()` split once `game/main.tsx` has real content (task 03).
- `fsevents@2.3.3` (a transitive optional dependency, likely via Vite/Rollup's watcher) has an unapproved install script under npm's `allowScripts` mechanism on this machine; it's macOS-only, optional, and unused by any script `npm test|typecheck|lint|build|test:e2e` runs, so it was left unapproved. A future agent on macOS may see the same npm warning on `npm ci`; it's not an error.

**Files created:** `package.json`, `package-lock.json`, `.npmrc`, `.nvmrc`, `.prettierrc.json`, `.prettierignore`, `eslint.config.js`, `tsconfig.json`, `tsconfig.sim.json`, `vite.config.ts`, `playwright.config.ts`, `index.html`, `game/main.tsx`, `game/state/index.ts`, `game/board/index.ts`, `game/ui/index.ts`, `sim/core/index.ts`, `sim/commands/index.ts`, `sim/resolve/index.ts`, `sim/waves/index.ts`, `sim/shop/index.ts`, `sim/data/index.ts`, `sim/scenario/index.ts`, `scripts/sim.ts`, `tests/sim/trivial.test.ts`, `tests/lint/layer-rules.test.ts`, `e2e/smoke.spec.ts`, `data/.gitkeep`, `scenarios/.gitkeep`, `public/.gitkeep`, `tests/game/.gitkeep`

**Files modified:** `.gitignore` (added `.superpowers/`; all other required entries were already present)

**Notes for next agent:**
- `tsconfig.json` vs `tsconfig.sim.json` split is load-bearing: `/sim` and `/tests` (excluding `tests/game/**`) typecheck under `tsconfig.sim.json` with no DOM lib; `/game`, `/scripts`, `/e2e`, `tests/game/**`, and root config files typecheck under `tsconfig.json` with DOM. When you add real `/game` tests, put them under `tests/game/**` — they'll pick up the app config automatically, no config change needed.
- The layer-rule ESLint config in `eslint.config.js` is enforced by text-matching import specifiers per directory — if task 03+ introduces path aliases (e.g. `@/game/...`), the `no-restricted-imports` patterns will need matching updates or they'll silently stop catching violations.
- `tests/lint/layer-rules.test.ts` is the canonical place to add more layer-boundary regression tests as new rules get added (e.g. once `/game/board` or `/game/ui` have real files, add fixtures proving the cross-import ban fires).
