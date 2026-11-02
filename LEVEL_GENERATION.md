# Challenge generation and validation

`npm run bake` writes `src/challenges/data.js`: one hundred challenges, five
lakes of twenty. Nothing in that file is hand-authored, and nothing is shipped
until a real throw has satisfied it.

## The problem with "generate and hope"

A randomly placed buoy is usually unreachable, and a randomly chosen skip
requirement is usually either trivial or impossible. Guessing which is which
from a difficulty curve is how games ship levels nobody can beat.

So the generator works backwards:

1. **Place targets on proven water.** A reference throw is simulated first. Its
   contact points become candidate target positions, so every buoy sits exactly
   where a stone has already touched.
2. **Prove the objective.** The reference throw is included in the candidate
   set, and the remaining candidates come from a coarse search over power,
   launch angle, heading and spin. The best result by the challenge's own metric
   is stored as the proof.
3. **Derive the requirement from measured capability, not a difficulty table.**
   For skip, distance and score challenges the pass mark is 50–84% of what the
   best searched throw achieved, rising with the level's position in its lake.
   For target challenges the reference throw hits every buoy, so the pass mark
   (60% of them) is always met.
4. **Cap the stars by what is reachable.** Three stars can never ask for more
   than the best throw the search actually produced.

`scripts/bake-challenges.mjs` then replays each stored proof through the same
simulation the player gets and fails the build if any challenge does not satisfy
its own objective. The test suite does the same replay, so a physics retune that
invalidates a level fails CI rather than shipping an unbeatable board.

## Objectives

| type | judged on | notes |
| --- | --- | --- |
| `skips` | skip count | the core skill |
| `distance` | metres covered while skipping | a throw that flies far without skipping scores zero |
| `targets` | buoys hit | required count is 60% of the buoys placed |
| `combo` | consecutive buoy hits | buoys are placed on neighbouring bounces so "in a row" is literal |
| `score` | `skips*12 + distance*3.4 + hits*120 + combo*60` | only four of the hundred |

The plan for each level comes from a ten-step cycle, with lakes three to five
leaning harder on precision. That keeps the shape predictable for a returning
player without every level being "two more skips".

## Lakes

| lake | wind | chop | unlocks at |
| --- | --- | --- | --- |
| Mountain Lake | ±0.18 | 0.10 | 0 stars |
| Forest Pond | ±0.05 | 0.05 | 4 stars |
| Sunset Beach | ±0.50 | 0.35 | 10 stars |
| Crystal Lagoon | ±0.30 | 0.20 | 22 stars |
| Moonlit River | ±0.62 | 0.45 | 38 stars |

Wind bends the throw; `chop` costs a little more energy per contact. Both are
inputs to the simulation, so a challenge proven in a windy lake is proven with
that wind.

## Stones in challenges

Each challenge hands you a specific stone and proves itself with that stone, so
a stored proof is exactly reproducible whatever the player has unlocked. The
stone rotates through the collection so the differences are felt in Journey too.
Practice modes use whatever you have equipped.

## Daily and practice boards

`dailyChallenge(date)` seeds from `skipping-stones-daily-<UTC date>` and runs the
same generator, including validation, on the device. The result is identical for
every player on that date and cannot be an impossible board. Zen, Endless,
Precision and Trick Shot use `generatedChallenge` with a seed, Endless stepping
up the demand as the session continues.

## Determinism

`seededRandom` is mulberry32 over an FNV-1a hash of the seed string. No
`Math.random()` is used in generation, so the same seed yields a byte-identical
challenge — which is what the determinism test asserts.
