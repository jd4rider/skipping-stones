import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_SKIPS,
  STONES,
  STONE_LIST,
  createState,
  launchSpeed,
  normalizeThrow,
  previewPath,
  scoreThrow,
  simulateThrow,
  stepState,
  stoneOf,
  targetPositionAt,
} from './simulation.js'
import { CAMERA, laneWidthAt, project, unprojectToWater } from './projection.js'

const still = { windX: 0, targets: [] }

test('the same throw always produces the same result', () => {
  const spec = { power: 0.87, angle: 4.2, spin: 8, heading: 0.03, stoneId: 'slate' }
  const a = simulateThrow(spec, still)
  const b = simulateThrow(spec, still)
  assert.equal(a.skips, b.skips)
  assert.equal(a.distance, b.distance)
  assert.equal(a.score, b.score)
  assert.deepEqual(a.events, b.events)
})

test('throw parameters are clamped into the playable range', () => {
  assert.deepEqual(normalizeThrow({ power: 5, angle: 90, spin: -3, heading: 9, stoneId: 'nope' }), {
    power: 1,
    heading: 0.24,
    angle: 14,
    spin: 0,
    stoneId: 'river',
  })
  assert.equal(normalizeThrow({}).stoneId, 'river')
})

test('launch speed rises with power and stays inside the balanced range', () => {
  const stone = stoneOf('river')
  assert.ok(launchSpeed(0, stone) < launchSpeed(0.5, stone))
  assert.ok(launchSpeed(0.5, stone) < launchSpeed(1, stone))
  assert.ok(launchSpeed(1, stone) <= 21)
  for (const item of STONE_LIST) {
    assert.ok(launchSpeed(1, item) > launchSpeed(1, stone) * 0.9, `${item.id} is not wildly weaker`)
  }
})

test('a still stone does not skip', () => {
  const result = simulateThrow({ power: 0, angle: 4, spin: 7.5 }, still)
  assert.ok(result.skips <= 1)
  assert.equal(result.hits.length, 0)
})

test('spin is what keeps the stone on the surface', () => {
  const noSpin = simulateThrow({ power: 0.9, angle: 4, spin: 0 }, still)
  const spinning = simulateThrow({ power: 0.9, angle: 4, spin: 8 }, still)
  assert.equal(noSpin.skips, 0, 'a stone with no spin sinks')
  assert.ok(spinning.skips >= 4, `expected a spinning stone to skip, got ${spinning.skips}`)
  assert.ok(spinning.distance > noSpin.distance)
})

test('a steep throw dives in instead of skipping', () => {
  const steep = simulateThrow({ power: 0.9, angle: 14, spin: 8 }, still)
  const flat = simulateThrow({ power: 0.9, angle: 4, spin: 8 }, still)
  assert.equal(steep.skips, 0)
  assert.ok(flat.skips > 3)
})

test('distance only counts ground covered while skipping', () => {
  const dud = simulateThrow({ power: 0.9, angle: 14, spin: 8 }, still)
  assert.equal(dud.distance, 0, 'flying far without skipping scores nothing')
  assert.ok(dud.flight > 5, 'but it really did travel in the air')
})

test('a strong throw is worth more than a weak one', () => {
  const weak = simulateThrow({ power: 0.25, angle: 4, spin: 7.5 }, still)
  const strong = simulateThrow({ power: 1, angle: 4, spin: 7.5 }, still)
  assert.ok(strong.skips > weak.skips)
  assert.ok(strong.distance > weak.distance)
  assert.ok(strong.score > weak.score)
})

test('a throw never skips more than the hard limit and always terminates', () => {
  for (const power of [0, 0.3, 0.7, 1]) {
    for (const angle of [0, 2, 6, 10, 14]) {
      for (const spin of [0, 4, 8, 16]) {
        const result = simulateThrow({ power, angle, spin }, still)
        assert.ok(result.skips <= MAX_SKIPS)
        assert.ok(result.sunk, 'the simulation always ends with the stone in the water')
        assert.ok(Number.isFinite(result.distance) && result.distance >= 0)
        assert.ok(Number.isFinite(result.time) && result.time <= 30.01)
      }
    }
  }
})

test('wind bends the throw without breaking it', () => {
  const left = simulateThrow({ power: 0.9, angle: 4, spin: 8 }, { windX: -0.6, targets: [] })
  const right = simulateThrow({ power: 0.9, angle: 4, spin: 8 }, { windX: 0.6, targets: [] })
  const lastLeft = left.events.at(-1)
  const lastRight = right.events.at(-1)
  assert.ok(lastLeft.x < lastRight.x)
  assert.equal(left.skips, right.skips, 'wind does not change the skip count in this model')
})

test('every stone can skip and the spread is modest', () => {
  const counts = STONE_LIST.map((stone) => simulateThrow({ power: 0.95, angle: 4, spin: stone.idealSpin, stoneId: stone.id }, still).skips)
  const best = Math.max(...counts)
  const worst = Math.min(...counts)
  assert.ok(worst >= 3, `a stone must still work: ${worst}`)
  assert.ok(best - worst <= 4, `stones must stay balanced: ${counts.join(',')}`)
})

test('a target placed on the first skip is hit exactly once', () => {
  const reference = simulateThrow({ power: 0.9, angle: 4, spin: 8 }, still)
  const first = reference.events.find((event) => event.type === 'skip')
  assert.ok(first)
  const target = { id: 't1', type: 'ring', x: first.x, z: first.z, radius: 0.8, drift: null }
  const result = simulateThrow({ power: 0.9, angle: 4, spin: 8 }, { windX: 0, targets: [target] })
  assert.deepEqual(result.hits, ['t1'])

  const far = { id: 't2', type: 'ring', x: first.x + 4, z: first.z, radius: 0.5, drift: null }
  const missed = simulateThrow({ power: 0.9, angle: 4, spin: 8 }, { windX: 0, targets: [far] })
  assert.deepEqual(missed.hits, [])
})

test('a drifting target stays inside its lane', () => {
  const target = { id: 'd', type: 'drifting', x: 1, z: 20, radius: 0.9, drift: { amplitude: 0.8, period: 5, phase: 0.4 } }
  let min = Infinity
  let max = -Infinity
  for (let step = 0; step < 200; step += 1) {
    const position = targetPositionAt(target, step * 0.031)
    min = Math.min(min, position.x)
    max = Math.max(max, position.x)
  }
  assert.ok(min >= 0.2 - 1e-9 && max <= 1.8 + 1e-9)
  assert.ok(max - min > 1, 'it really does move')
})

test('the aim preview follows the real throw up to the first contact', () => {
  const spec = { power: 0.9, angle: 4.2, spin: 8 }
  const preview = previewPath(spec, still)
  const result = simulateThrow(spec, still)
  const first = result.events.find((event) => event.type === 'skip')
  const last = preview.at(-1)
  assert.ok(Math.abs(last.z - first.z) < 0.6, `preview ends at ${last.z}, throw lands at ${first.z}`)
  assert.ok(Math.abs(last.x - first.x) < 0.6)
})

test('the preview stops at the first contact so it cannot promise a full chain', () => {
  const preview = previewPath({ power: 1, angle: 4 }, still)
  const result = simulateThrow({ power: 1, angle: 4 }, still)
  assert.ok(preview.length >= 4)
  assert.ok(preview.at(-1).z <= result.events.find((event) => event.type === 'skip').z + 0.6)
})

test('scoring rewards skips, distance and hits', () => {
  assert.equal(scoreThrow({ skips: 0, distance: 0, hits: [], bestCombo: 0 }), 0)
  const small = scoreThrow({ skips: 3, distance: 10, hits: [], bestCombo: 0 })
  const large = scoreThrow({ skips: 6, distance: 20, hits: ['a'], bestCombo: 2 })
  assert.ok(large > small)
})

test('stepping by hand matches a full simulation', () => {
  const spec = { power: 0.8, angle: 4, spin: 8 }
  const state = createState(spec, still)
  let skips = 0
  let guard = 0
  while (!state.lost && guard < 4000) {
    const event = stepState(state, still)
    if (event?.type === 'skip') skips += 1
    guard += 1
  }
  const result = simulateThrow(spec, still)
  assert.equal(skips, result.skips)
  assert.equal(Math.round(state.z * 10) / 10, result.flight)
})

test('projection puts the water in front of the camera and the horizon behind it', () => {
  const near = project({ x: 0, y: 0, z: 0 })
  const far = project({ x: 0, y: 0, z: 40 })
  assert.ok(Math.abs(near.x - CAMERA.width / 2) < 1e-9)
  assert.ok(near.y > far.y, 'near water draws lower on screen than far water')
  assert.ok(far.y > CAMERA.horizonY, 'water never rises above the horizon')
  assert.ok(near.scale > far.scale)
  assert.ok(far.visual >= 0.34, 'a distant stone is still big enough to see')
  assert.ok(near.visual <= 1.7)
  // The stone rests a few metres out so the near shore can be drawn under it.
  const resting = project({ x: 0, y: 0.26, z: 5 })
  assert.ok(resting.y > CAMERA.horizonY && resting.y < CAMERA.height, 'the resting stone is on screen')
})

test('height raises a point above the water line at the same distance', () => {
  const water = project({ x: 0, y: 0, z: 15 })
  const air = project({ x: 0, y: 1.2, z: 15 })
  assert.ok(air.y < water.y)
  assert.equal(air.x, water.x)
})

test('screen points map back onto the water plane', () => {
  const point = project({ x: 1.4, y: 0, z: 18 })
  const back = unprojectToWater(point)
  assert.ok(back)
  assert.ok(Math.abs(back.x - 1.4) < 0.01)
  assert.ok(Math.abs(back.z - 18) < 0.05)
  assert.equal(unprojectToWater({ x: 320, y: CAMERA.horizonY - 10 }), null)
})

test('the reachable lane widens with distance', () => {
  assert.ok(laneWidthAt(30) > laneWidthAt(10))
  assert.ok(laneWidthAt(10) > 0)
})

test('stones and cosmetics expose the fields the UI needs', () => {
  for (const stone of STONE_LIST) {
    assert.ok(stone.name && stone.colour !== undefined && stone.accent !== undefined)
    assert.ok(stone.flatness > 0 && stone.flatness <= 1)
    assert.ok(STONES[stone.id] === stone)
  }
})
