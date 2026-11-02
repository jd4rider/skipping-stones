# Little Joy Arcade integration

Skipping Stones is a standalone build that also lives inside
[littlejoyarcade.site](https://littlejoyarcade.site). This is exactly how it
plugs in, so nothing here has to be rediscovered later.

## Play URLs

| purpose | URL |
| --- | --- |
| canonical build | `https://jd4rider.github.io/skipping-stones/play/` |
| preferred host | `https://skippingstones.littlejoyarcade.site/play/` |
| repo | `https://github.com/jd4rider/skipping-stones` |

The Pages workflow publishes one build at `/` and copies it to `/play/`, and
`vite.config.js` uses `base: './'` so relative asset paths work from either. The
catalogue links `/play/`; the subdomain is only used if it answers.

## Accounts and saves

`index.html` includes the arcade's drop-in client:

```html
<script src="./arcade-client.js" data-game-id="skipping-stones"></script>
```

`public/arcade-client.js` is a copy of
`littlejoyarcade/packages/sdk/desktop/arcade-client.js` with the public anon key
already inline. It gives the game a sign-in panel and mirrors Web Storage into one
`game_progress` row per player. Nothing in the game code needs to know about it.

Because the save is ordinary JSON under `skipping-stones-save-v1`, mirroring
works with no adapter:

- local edits always win until they are pushed,
- a fresh device accepts the newest cloud snapshot once and reloads,
- the game keeps playing if the backend is unreachable.

To refresh the client after an SDK change:

```bash
cp ../littlejoyarcade/packages/sdk/desktop/arcade-client.js public/arcade-client.js
```

## Catalogue entry

`arcade-manifest.json` is the source for the arcade's `games` row. It is
published with the arcade's own tooling:

```bash
cd ../littlejoyarcade
set -a && . ./.env.local && set +a
node scripts/publish-game.mjs --manifest ../skipping-stones/arcade-manifest.json
```

`src/data/games.ts` in the portal also holds a static fallback entry, because the
portal renders from that file if Supabase is slow or unavailable.

## What the game uses from the arcade

- shared identity (the client's own sign-in),
- cloud saves (mirrored Web Storage),
- ad-free and cosmetic entitlements are **reserved but unused** — the game shows
  no ads, so there is nothing to gate.

## What it does not do

- It does not invent backend endpoints. If the arcade services are unavailable,
  the game plays locally and says nothing about it.
- It does not grant anything from the client. Anything that ever needs to be
  trusted (purchases, entitlements) belongs on the arcade's server, verified
  there; this game treats its local save as a save, not as proof of purchase.

## Subdomain

There is no `public/CNAME` in this repo. A GitHub Pages project site has exactly
one canonical hostname, and adding one would 301 the `github.io` build that the
catalogue links — the embedded player would go blank. The subdomain is wired at
the DNS level and will take over when the whole arcade moves to custom hostnames;
until then the portal probes it and falls back automatically. See
`littlejoyarcade/DNS_CONFIGURATION.md`.
