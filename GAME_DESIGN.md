# Game design

## The loop

One throw is the whole game: aim, set power, release, watch. Everything else —
challenges, stars, records, stones — exists to give that twenty seconds a reason.

The interesting decision is not "how hard can I throw". It is "how much power can
I spend before the stone stops coming back", and the answer changes with the
lake, the wind and the stone in your hand.

## Controls

Assisted by default, so a first-time player can throw well without reading
anything:

| input | effect |
| --- | --- |
| drag up from the water | power (distance dragged) |
| slide left / right while dragging | heading, ±0.22 rad |
| release | throw |
| arrow keys + Space / Enter | same, on a keyboard |
| R | restart the challenge |
| Esc | menu |

Turn on **Advanced controls** in Settings to get explicit launch angle and spin
steppers. They are hidden by default because the assisted defaults already throw
a good stone, and a wall of sliders in front of a first throw is a bad trade.

## The three things that matter

1. **Power.** 8–20 m/s at release. Too little and the stone sinks without a
   single bounce; maximum power and a shallow launch is the long throw.
2. **Spin.** A stone with no spin fails the stability test and goes straight in.
   Spin also raises the steepest impact the stone can survive, so a spinning
   stone is more forgiving of a slightly steep throw.
3. **Launch angle.** 0–10° all skip; 13° and above dives in. Flatter means more
   skips over less distance, steeper means bigger hops but fewer of them.

Aim matters more than any of them once buoys are involved, because the buoys sit
on the line the stone actually takes.

## Modes

| mode | what it is | scored |
| --- | --- | --- |
| Journey | 100 verified challenges, five lakes of 20 | yes, stars |
| Daily | one board per UTC day, same for everybody | yes, its own stars |
| Zen | a generated lake and no objective | no |
| Endless | consecutive throws, rising demand | no, but records |
| Precision | generated target boards | no |
| Trick Shot | generated boards with three buoys in a row | no |

Practice modes still update records and badges. They simply do not gate the
journey.

## Stars

Three stars are earned per challenge, based on the objective metric:

- one star: the objective is met,
- two: 15% past it,
- three: the best throw the generator could find on that board.

Stars never depend on speed, and nothing in the game is timed. A player who
walks away mid-aim loses nothing.

Stars unlock content: lakes at 4, 10, 22 and 38, stones at 6, 10, 18, 36 and 75,
trails at 4, 14, 26, 45 and 60.

## Progression shape

Each lake runs a ten-step objective cycle (skips, skips, targets, distance,
targets, skips, combo, distance, targets, score) twice. The requirement is 50% of
measurable capability at the start of a lake and rises to 84% by the end, so the
curve is a slope rather than a cliff. Later lakes lean harder on precision.

## Presentation

- Layered scenery drawn from one cached canvas per lake: gradient sky, sun or
  moon, two ridges, a treeline, and a foreground ledge with pebbles.
- Water is a cached gradient plus slow moving glints; ripples are ellipses drawn
  at perspective scale so a far skip makes a small ring.
- Every skip gets a ring, droplets, a pitched note that climbs a scale, and a
  number that floats away. A long chain therefore sounds like a phrase.
- Reduced motion removes drifting scenery, sparkles and floating labels without
  changing any physics.

## What is deliberately absent

No timers, no lives, no energy meters, no consumable power-ups, no interstitial
ads, no purchases. The entitlements `skipping-stones.ad_free` and
`skipping-stones.premium_themes` are reserved in the catalogue and unused.
