# Deployment

## Web (GitHub Pages)

`.github/workflows/pages.yml` runs on every push to `main`:

1. `npm ci --include=optional`
2. `npm test` — physics, determinism, and a replay of every stored challenge proof
3. `npm run build`
4. copies the build into `dist/play/`
5. publishes `dist/` with `actions/deploy-pages`

Pages is set to `build_type=workflow`, so this workflow is the only publisher.

Verify:

```bash
curl -sI https://jd4rider.github.io/skipping-stones/play/ | head -3
curl -s -o /dev/null -w '%{http_code}\n' https://jd4rider.github.io/skipping-stones/play/
```

## Desktop

```bash
npm run dist:mac     # .dmg for arm64 and x64
npm run dist:win     # NSIS installer, x64
npm run dist:linux   # AppImage
```

`electron/main.cjs` uses context isolation, no node integration and a sandbox,
and refuses to open anything but https links externally. The packaged app loads
`dist/index.html` from disk, so it runs offline.

`.github/workflows/release.yml` builds all three on a `v*` tag and attaches the
artifacts to the GitHub release. The arcade's release sync then picks the
installers up for the game's detail page.

Install the macOS build locally with:

```bash
cp -R "release/mac-arm64/Skipping Stones.app" /Applications/
```

## No custom domain on the game repo

This repo deliberately has no `public/CNAME`. A Pages project site has one
canonical hostname; adding `skippingstones.littlejoyarcade.site` there would 301
the `github.io` build the catalogue links, and the arcade's embedded player would
go blank. The catalogue uses the `github.io` URL as `playUrl` and the subdomain
only as an optional probe until the whole arcade moves to custom hostnames.

## Local checks

```bash
npm test
npm run build
python3 -m http.server 4174 --directory dist
node scripts/smoke.mjs http://localhost:4174/
```

`scripts/smoke.mjs` drives the built game in headless Chrome at a phone viewport:
it boots the menu, starts Journey, drags upward to throw, waits for the results
screen, then asserts that the save recorded a throw with skips and distance.

## Rollback

Re-run an earlier successful Pages workflow, or revert the commit on `main`.
Rolling back code never touches DNS, and the arcade falls back to the static
catalogue entry if the manifest row is stale.
