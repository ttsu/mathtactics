# Deploy — human setup steps

These steps are **not automatable by agents** (GDD §15.3, TR §16) — they touch DNS and repo
settings outside this checkout. They are tracked as task **H0** in `TASKS.md`, and gate the
`H0` acceptance criterion "blank board on the iPad via production URL" (TR §17.1, M0).

## 1. DNS

Add a `CNAME` record at your DNS provider:

```
mathtactics.timtsu.com  →  ttsu.github.io
```

(`public/CNAME` in this repo already contains `mathtactics.timtsu.com`, so GitHub Pages will
serve the custom domain once the record propagates and Pages is configured below.)

## 2. GitHub Pages settings

In the repo's **Settings → Pages**:

- **Source:** deploy from the `gh-pages` branch (root). This branch is written by
  `.github/workflows/deploy-github-pages.yml` (production, pushed to the branch root) and
  `.github/workflows/pr-preview.yml` (PR previews, pushed under `pr/pr-<N>/` on the same
  branch) — do not create `gh-pages` by hand, the first successful workflow run creates it.
- **Custom domain:** `mathtactics.timtsu.com`.
- **Enforce HTTPS:** enable once the certificate is issued (may take a few minutes after the
  custom domain is set).

## 3. Branch protection

In **Settings → Branches**, add a protection rule for `main` requiring the `CI / ci` status
check (from `.github/workflows/ci.yml`) to pass before merging.

## 4. Home Screen install (iPad)

Home Screen install is a **required** setup step for the playtester (GDD §15.3) — it protects
`localStorage` from Safari's 7-day eviction policy and gives a fullscreen, app-like window.

1. Open `https://mathtactics.timtsu.com` in Safari on the iPad.
2. Tap the Share icon → **Add to Home Screen**.
3. Confirm the name and tap **Add**.
4. Launch the game from the Home Screen icon (not the Safari tab) for all play sessions.

PR previews (`mathtactics.timtsu.com/pr/pr-<N>/`) are path-scoped for storage and manifest
scope, so opening a preview in Safari can never overwrite the production save or hijack the
Home Screen icon — but only the production URL should be added to the Home Screen.
