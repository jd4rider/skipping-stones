# Stone physics

The stone is simulated as logical state in metres and seconds, never as a
sprite. `src/physics/simulation.js` has no Phaser, no DOM and no clock, so a
throw is a pure function of its parameters. That is what makes three things
possible at once:

- the aim guide can predict exactly what the throw will do,
- the challenge generator can prove a board is beatable before it ships,
- the tests can assert exact numbers instead of "looks about right".

## Coordinates and projection

Water is `y = 0`. `x` runs across the lake, `z` away from the thrower. A pinhole
camera on the shoreline looks straight down `z` from `camHeight`, so
`src/physics/projection.js` maps a world point to the screen with

```
scale    = focal / (z + zNear)
screen.x = width/2 + x * scale
screen.y = horizonY + (camHeight - y) * scale
```

Two consequences are used by the game: water converges on the horizon line as
`z` grows, and a stone in the air sits above the water it is above. The sprite
also gets `visual`, a size multiplier floored at 0.34 so a stone 30 m out is
still visible.

`unprojectToWater` inverts this for pointer input, and `laneWidthAt` answers
"how wide is the lake at this distance", which the test suite uses to keep
targets inside the throwable cone.

## Step

Fixed 1/120 s step, driven by an accumulator in the scene so rendering frame
rate cannot change the outcome. Air drag is quadratic:

```
k = drag * |v|
vx += (-vx*k + windX) * dt
vy += (-g - vy*k) * dt
vz += -vz*k * dt
```

Spin decays exponentially; each contact costs it `spinRetention` as well.

## Contact

A contact happens when the stone crosses `y = 0` while descending. The crossing
point is interpolated back to the surface so the ripple lands where the stone
actually touched, not on the frame boundary below it.

At the surface:

| quantity | meaning |
| --- | --- |
| `forward` | horizontal speed, m/s |
| `descent` | angle below horizontal, radians |
| `spinQuality` | `spin / stone.idealSpin`, clamped to 1.2 |
| `stability` | `flatness * (0.55 + 0.45 * spinQuality)` |
| `maxAngle` | steepest impact that can still skip |

The stone skips only when **all** of these hold: `forward > 7`, `descent <
maxAngle`, `energy > 0.08`, `spinQuality > 0.08`, `stability > 0.6`, and fewer
than `MAX_SKIPS` contacts. Anything else sinks, with a reason string (`too
steep`, `no spin`, `too slow`, `spent`) that the tests and the results screen use.

`maxAngle` grows with spin and flatness. With no spin a stone fails the
stability test outright, which is the game's one piece of real advice: spin is
what keeps a stone flat.

## Bounce

```
energy -= 0.03 + 0.045 * (descent / maxAngle) + (1 - spinQuality) * 0.02 + chop * 0.03
penalty  = 1 - 0.06 * (descent / maxAngle)
speed'   = forward * skipEfficiency * penalty * (0.975 + 0.025 * spinQuality)
angle'   = clamp(descent * 0.99 * (0.94 + 0.06 * spinQuality), 2°, maxAngle * 0.85)
vy'      = speed' * tan(angle')
```

Energy is the hard budget; speed decay and the minimum speed are what end most
throws. Both are bounded, and `MAX_SIM_SECONDS` guarantees termination even if a
future tuning change misbehaves.

## What the current numbers do

Measured with `npm run report`:

| throw | skips | distance |
| --- | --- | --- |
| 20% power | 3 | 9.8 m |
| 60% power | 6 | 22.8 m |
| 100% power, 4° | 6 | 31.7 m |
| best across all stones and settings | 9 | 36 m |

Launch angles of 0–10° all skip; 13° and above dives in. Spin below about 4
never skips. Wind bends the chain (0.6 m/s² moves it about 0.7 m) without
changing the skip count, so it changes aim, not score.

## Stones

All six stones share the same rules and differ in `flatness`, `skipEfficiency`,
`spinRetention`, `idealSpin`, `drag` and `powerScale`. The spread between the
best and worst is small on purpose — about one skip and a few metres at equal
input — so a cosmetic stone can never buy an advantage. Care cosmetics do not
touch this file at all.

## Targets

A target is a circle on the water in world coordinates. A skip counts as a hit
when the contact point is within its radius. Drifting targets follow
`x + A * sin(2πt/period + phase)`.

Targets are **static while you aim** and drift with simulation time only during
the flight. This is deliberate: the stored proof for a challenge was validated
against the phase-0 positions, so a live wall-clock drift would make the proof
describe different water from the one the player sees.
