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

**Status:** Not Started
