# 02 — CI, GitHub Pages & PR Previews

**Milestone:** M0 · **Layer:** infra · **Depends on:** 01 · **Branch:** `task/02-ci-and-deploy`

## Task

Add GitHub Actions for CI, production deploy to GitHub Pages at `mathtactics.timtsu.com`, and
per-PR preview deploys at `/pr/pr-<N>/`, modeled on `ttsu/bee-happy`.

## References

- GDD §15.3 · TR §16

## Requirements

1. **`.github/workflows/ci.yml`** — on `pull_request` and `push` to `main`:
   Node from `.nvmrc`, `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`,
   `npx playwright install --with-deps webkit`, `npm run test:e2e`. Upload the Playwright report as an artifact on failure.
2. **`.github/workflows/deploy-github-pages.yml`** — on push to `main` + `workflow_dispatch`:
   build **without** `VITE_TEST_HANDLE`; deploy `dist` with `JamesIves/github-pages-deploy-action@v4`
   to `gh-pages`, `clean-exclude: pr`, `force: false`. `permissions: contents: write`; `concurrency: pages`.
3. **`.github/workflows/pr-preview.yml`** — on PR `opened, reopened, synchronize, closed`:
   build with `VITE_TEST_HANDLE=1` (skip on `closed`); `rossjrw/pr-preview-action@v1` with
   `source-dir: dist`, `preview-branch: gh-pages`, `umbrella-dir: pr`,
   `pages-base-url: mathtactics.timtsu.com`, `wait-for-pages-deployment: false`.
   Add preview URL to the job summary. Permissions: `contents: write`, `pull-requests: write`.
4. **`public/CNAME`** containing `mathtactics.timtsu.com`.
5. A short **`docs/deploy.md`** listing the human setup steps (TR §16): DNS CNAME, Pages source &
   custom domain & HTTPS, branch protection requiring the CI check, Home Screen install instructions for the iPad.
6. Verify the built `dist/` works from a subpath: e2e or a script that serves `dist` under `/pr/pr-0/`
   and loads the page without 404s for assets.

## Out of Scope

Configuring DNS or repo settings (human, task H0).

## Acceptance Criteria

- [ ] CI runs on this task's own PR and is green
- [ ] Opening the PR produces a preview deploy commit under `pr/pr-<N>/` on `gh-pages`
- [ ] Merging to `main` deploys to `gh-pages` root without deleting `pr/`
- [ ] Production build contains no test handle code (grep `dist` for `__GAME__` returns nothing)
- [ ] Assets load correctly when served from a subpath
- [ ] `docs/deploy.md` exists with the human steps

## Completion Notes

**Status:** Partial
**Completed:** 2026-09-14
**PR:** not yet opened

**Acceptance criteria:**
- [ ] CI runs on this task's own PR and is green — Not met: no PR opened this session (instructed not to push/open a PR); workflow validated locally instead (YAML parses, actionlint clean, and every step's underlying command — `npm run typecheck/lint/test/build`, the handle check, `npm run test:e2e` — run green locally). Awaiting push/PR (not run in this session).
- [ ] Opening the PR produces a preview deploy commit under `pr/pr-<N>/` on `gh-pages` — Not met: requires a real PR; awaiting push/PR (not run in this session).
- [ ] Merging to `main` deploys to `gh-pages` root without deleting `pr/` — Not met: requires a real merge; awaiting push/PR (not run in this session).
- [x] Production build contains no test handle code (grep `dist` for `__GAME__` returns nothing) — Met: `npm run check:no-test-handle` (new script, also wired into `ci.yml` and `deploy-github-pages.yml`) passes against a plain `npm run build` output; verified it correctly *fails* by temporarily appending `window.__GAME__ = {}` to a built JS file, then removed the injection and rebuilt clean.
- [x] Assets load correctly when served from a subpath — Met: added `e2e/subpath.spec.ts` plus a second Playwright `webServer` entry (`playwright.config.ts`) that builds a handle-free `dist-subpath-test` and serves it mounted at `/pr/pr-0/` via a new `scripts/serve-subpath.ts` static server; the test asserts the canvas is visible and no request returns ≥400 or fails. `npm run test:e2e` passes both this and the existing smoke test.
- [x] `docs/deploy.md` exists with the human steps — Met: DNS CNAME, Pages source (`gh-pages` branch) + custom domain + HTTPS, branch protection requiring the CI check, and iPad Home Screen install steps; notes this is task H0.

**Verification:**
- `npm test` — 2 files, 5 tests passed
- `npm run typecheck` — clean (app + sim configs)
- `npm run lint` — clean (fixed one `prefer-const` in `scripts/serve-subpath.ts` during self-review)
- `npm run build` — succeeds (same pre-existing Phaser bundle-size warning from task 01, out of scope here)
- `npm run check:no-test-handle` — passes on a clean build; independently verified it fails when `__GAME__` is present (temporary injected line, removed after)
- `npx playwright install webkit` then `npm run test:e2e` — 2 passed (`e2e/smoke.spec.ts`, `e2e/subpath.spec.ts`), both webServers (root :4173 with handle, subpath :4174 without) started and tore down cleanly
- `npx prettier --check` on all new/changed files — clean
- Workflow YAML: parsed with the `yaml` package (already a pinned dependency) — all 3 files parse; also linted with `actionlint@2.0.6`'s npm package (no CLI binary is published, so it was driven programmatically via its documented `createLinter`/`node.cjs` API rather than `npx actionlint`) — 0 findings across `ci.yml`, `deploy-github-pages.yml`, `pr-preview.yml`
- `ttsu/bee-happy`'s `.github/workflows/deploy-github-pages.yml` and `pr-preview.yml` were read via `raw.githubusercontent.com` and used as the direct pattern for those two workflows (adapted: Node version from `.nvmrc` instead of hardcoded, `npm run build`/`npm ci` scripts instead of raw `tsc`/`vite` calls, `mathtactics.timtsu.com` instead of `beehappy.timtsu.com`). `bee-happy` has no `ci.yml`, so that workflow follows the task brief and TR §16 directly.

**Deviations from spec:**
- Subpath verification (req. 6) is implemented as a Playwright test (`e2e/subpath.spec.ts`) backed by a second `webServer` entry in `playwright.config.ts`, per the task's own decision list — not a separate CI step. It runs automatically as part of `npm run test:e2e`, which `ci.yml` already runs, so no additional CI step was needed. The second webServer builds to its own `dist-subpath-test/` output directory (gitignored) rather than reusing `dist/`, to avoid a build race with the first webServer's handle build running concurrently.
- `scripts/serve-subpath.ts` is new, minimal, test-only tooling (a ~90-line static file server mounting a directory under a URL prefix) — no existing dependency does this out of the box without pulling in a new package; kept intentionally small (YAGNI: no directory listing, no range requests, no caching headers).
- `actionlint` has no npm-published CLI binary under that package name (the `actionlint` npm package is a WASM library, not a CLI); it was driven via a short inline Node script calling its documented API instead of `npx actionlint`. No system tool was installed (Homebrew's `actionlint` formula was also unavailable/not installed, and was not installed per instructions).
- `pr-preview.yml`'s build step deliberately builds *with* `VITE_TEST_HANDLE=1` (per task requirement 3, matching GDD/TR intent that previews carry the same handle build path as e2e), so the `check:no-test-handle` script is intentionally **not** run in that workflow — only in `ci.yml` (after the plain build) and `deploy-github-pages.yml` (production).

**Architectural decisions made:**
- `check:no-test-handle` (new `npm run` script backed by `scripts/check-no-test-handle.ts`) recursively scans a build output directory (default `dist`, overridable via `argv[2]`) for the literal string `__GAME__` in any text-readable file, skipping files that aren't valid UTF-8 (binary assets). Used identically from `ci.yml` and `deploy-github-pages.yml`, and runnable locally.
- Both new GitHub Actions workflows (`deploy-github-pages.yml`, `pr-preview.yml`) mirror `ttsu/bee-happy`'s structure closely (job names, step order, `concurrency` groups, `permissions`) to keep the two repos easy to cross-reference, with only the values TR §16 / the task spec call out changed.
- `ci.yml` job/step names are plain and mechanical (`Typecheck`, `Lint`, `Test`, `Build (no test handle)`, `Check dist has no test handle`, `Install Playwright browsers`, `E2E tests`) rather than combined multi-command steps, so a CI failure's step name alone tells you which `CLAUDE.md` command failed.

**Design questions raised:**
- None. Every workflow value came from the task file, TR §16/16.1, GDD §15.3, or the "Decisions already made" list; where the task explicitly deferred to `bee-happy`'s pattern, that repo's actual workflow files were read directly rather than guessed.

**Known issues / follow-up:**
- All three acceptance criteria that require a real PR/CI run (CI green on this task's own PR, a preview commit under `pr/pr-<N>/`, a `main` merge deploying without deleting `pr/`) are unverified in this session per instructions — this task was not pushed, no PR was opened, and no GitHub/repo settings were touched. Task H0 (human: DNS, Pages settings, branch protection) still needs to be done before the production URL and previews are live at all.
- The Phaser bundle-size warning from task 01 (`dist/assets/index-*.js` ~1.6 MB / ~426 KB gzipped) is unchanged and still out of scope here.

**Files created:** `.github/workflows/ci.yml`, `.github/workflows/deploy-github-pages.yml`, `.github/workflows/pr-preview.yml`, `public/CNAME`, `docs/deploy.md`, `scripts/check-no-test-handle.ts`, `scripts/serve-subpath.ts`, `e2e/subpath.spec.ts`

**Files modified:** `package.json` (added `check:no-test-handle` script), `.gitignore` (added `dist-subpath-test/`), `playwright.config.ts` (`webServer` changed from a single object to an array; added the subpath verification server), `TASKS.md` (status for task 02)

**Notes for next agent:**
- `npm run check:no-test-handle` is the canonical local/CI check for CLAUDE.md Core Rule 7 ("production never ships the test handle"); task 05 (adding the real `__GAME__` handle) must keep `ci.yml`'s "Check dist has no test handle" step green — it runs on the *plain* `npm run build`, not the handle build, so it should keep passing as long as `VITE_TEST_HANDLE` gating stays correct in `game/main.tsx` (or wherever task 05 wires it up).
- `playwright.config.ts` now starts two webServers; if a future task adds more e2e projects/servers, keep each build going to its own `outDir` to avoid races (`dist` vs `dist-subpath-test`).
- Task H0 (human) is the next thing standing between this work and a live preview: DNS CNAME, Pages source/custom domain/HTTPS, and branch protection, all documented in `docs/deploy.md`.
