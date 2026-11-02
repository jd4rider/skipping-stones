# Skipping Stones

A physics arcade game about the best thing to do at a lake. Drag to set power
and aim, release, and watch a flat stone skip away from you while it keeps just
enough energy for one more bounce.

Part of [Little Joy Arcade](https://littlejoyarcade.site) · planned home
<https://skippingstones.littlejoyarcade.site>

## What is in it

- **Five lakes**, each with its own light, wind and water: Mountain Lake, Forest
  Pond, Sunset Beach, Crystal Lagoon, Moonlit River.
- **100 Journey challenges** across those lakes. Every one was generated and then
  verified: a real throw that satisfies the objective is stored with it, and the
  test suite replays all one hundred through the same physics the player gets.
- **Six stones** that genuinely throw differently, and six trail cosmetics that
  do not touch the physics at all.
- **Modes**: Journey, Daily (seeded by UTC date, identical for everyone), Zen,
  Endless, Precision, Trick Shot.
- **Daily streaks**, personal records, twelve badges, local saves with versioned
  migration.
- **Guest play by default.** Signing in to a Little Joy account mirrors the save
  across devices through the arcade client.

## Running it

```bash
npm install
npm run dev        # vite dev server
npm test           # physics + challenge suites (node --test)
npm run bake       # regenerate src/challenges/data.js, verified
npm run report     # print what the current physics constants do
npm run build      # production build into dist/
npm run preview    # serve the production build
npm start          # build and open the Electron app
```

Desktop installers: `npm run dist:mac`, `npm run dist:win`, `npm run dist:linux`.

## Layout

```
src/
  physics/
    simulation.js      deterministic 3D stone model, stones, targets, scoring
    projection.js      2.5D pinhole camera, screen <-> water maths
    physics.test.js
  challenges/
    generator.js       seeded construction + validation
    data.js            generated: 100 verified challenges
    index.js           runtime access, daily and free-play boards
    challenges.test.js
  phaser/
    common.js          generated textures, scenery, UI controls, water effects
    LakeScene.js       aiming, throwing, simulation playback, HUD
    MenuScene.js  LevelsScene.js  ResultsScene.js
    StonesScene.js  SettingsScene.js  AchievementsScene.js
    scene.js  main.js
  progress.js          stars, unlocks, records, badges
  save.js              localStorage wrapper
  sound.js             synthesised audio
```

Docs: [PHYSICS.md](PHYSICS.md), [LEVEL_GENERATION.md](LEVEL_GENERATION.md),
[GAME_DESIGN.md](GAME_DESIGN.md), [ARCADE_INTEGRATION.md](ARCADE_INTEGRATION.md),
[DEPLOYMENT.md](DEPLOYMENT.md).

## Honest notes

- The engine is Phaser 4, matching every other Little Joy Arcade game, rather
  than the Phaser 3 in the original brief.
- Physics is deterministic under fixed conditions and covered by tests, but it is
  a game model, not hydrodynamics. The numbers are tuned for feel.
- A strong throw lands around six skips and 30 m; the best stone and settings
  reach nine skips and about 36 m. Badges stop at nine skips because ten is not
  achievable with these constants — an unreachable badge would be a lie.
- Challenge proofs are stored for the stone the challenge hands you, so they
  reproduce exactly whatever you have unlocked.
