/*
 * Deterministic stone-skipping simulation.
 *
 * Pure data in, pure data out: no Phaser, no DOM, no wall clock. A throw is
 * reproducible from its parameters alone, which is what lets the challenge
 * generator prove a board is beatable before it ships, lets the aim preview
 * agree with the real throw, and lets the tests assert exact outcomes.
 *
 * Coordinates follow the brief: x across the lake, y up from the water, z away
 * from the thrower. Water is y = 0. Units are metres and seconds.
 *
 * The model is intentionally not a hydrodynamic solver. It is a small,
 * tunable set of rules that behave like a skipping stone: a shallow, fast,
 * spinning stone with energy left keeps going, and everything else sinks.
 */

export const STEP = 1 / 120
export const DEG = Math.PI / 180
export const GRAVITY = 9.81
export const MAX_SIM_SECONDS = 30
export const MAX_STEPS = Math.round(MAX_SIM_SECONDS / STEP)
export const MAX_SKIPS = 40

/** Impact at or beyond this angle always sinks, in radians. */
export const HARD_ANGLE_LIMIT = (30 * Math.PI) / 180

/** Below this the stone is skating, not skipping, and it sinks. */
export const MIN_SKIP_SPEED = 7

/** Stability below this means the stone is not spinning enough to stay flat. */
export const MIN_STABILITY = 0.6

export const clamp = (value, low, high) => Math.min(high, Math.max(low, value))
const finite = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback)

// ---------------------------------------------------------------------------
// Stones
// ---------------------------------------------------------------------------

/*
 * Every stone changes the throw in a way a player can feel but none of them
 * breaks the game: the spread between the best and worst thrower is about one
 * skip and a few metres. Cosmetics never live here.
 */
export const STONES = {
  river: {
    id: 'river',
    name: 'Smooth River Stone',
    blurb: 'Rounded, forgiving, and the one to learn on.',
    flatness: 0.84,
    skipEfficiency: 0.925,
    spinRetention: 0.95,
    idealSpin: 7.5,
    drag: 0.0055,
    powerScale: 1,
    colour: 0xb9c2cc,
    accent: 0x7f8a96,
    ring: 0xdfe6ec,
    unlockStars: 0,
  },
  slate: {
    id: 'slate',
    name: 'Flat Slate',
    blurb: 'Thin and true. Skips further per bounce than anything else.',
    flatness: 0.95,
    skipEfficiency: 0.934,
    spinRetention: 0.955,
    idealSpin: 8,
    drag: 0.0058,
    powerScale: 0.97,
    colour: 0x7c8b9b,
    accent: 0x55616e,
    ring: 0xa8b6c4,
    unlockStars: 6,
  },
  granite: {
    id: 'granite',
    name: 'Heavy Granite',
    blurb: 'Slow to gather speed, then it keeps hold of it.',
    flatness: 0.86,
    skipEfficiency: 0.929,
    spinRetention: 0.965,
    idealSpin: 6.5,
    drag: 0.0046,
    powerScale: 0.93,
    colour: 0x9a938c,
    accent: 0x6c645e,
    ring: 0xc9c2ba,
    unlockStars: 18,
  },
  pebble: {
    id: 'pebble',
    name: 'Lightweight Pebble',
    blurb: 'Flicks out of the hand easily but the air takes it back.',
    flatness: 0.8,
    skipEfficiency: 0.912,
    spinRetention: 0.93,
    idealSpin: 9,
    drag: 0.0072,
    powerScale: 1.06,
    colour: 0xd7c3a5,
    accent: 0xa88f6d,
    ring: 0xefdfc7,
    unlockStars: 10,
  },
  crystal: {
    id: 'crystal',
    name: 'Polished Crystal',
    blurb: 'Cut to a fine edge. Balanced everywhere it matters.',
    flatness: 0.93,
    skipEfficiency: 0.934,
    spinRetention: 0.955,
    idealSpin: 8,
    drag: 0.0052,
    powerScale: 0.99,
    colour: 0x9fd6e8,
    accent: 0x5d9fbd,
    ring: 0xd7f2fb,
    unlockStars: 36,
  },
  gold: {
    id: 'gold',
    name: 'Golden Stone',
    blurb: 'A smooth river stone that happens to catch the light.',
    flatness: 0.84,
    skipEfficiency: 0.925,
    spinRetention: 0.95,
    idealSpin: 7.5,
    drag: 0.0055,
    powerScale: 1,
    colour: 0xe8c268,
    accent: 0xb98b28,
    ring: 0xfff0c4,
    unlockStars: 75,
    trail: 'golden',
  },
}

export const STONE_LIST = Object.values(STONES)

export function stoneOf(id) {
  return STONES[id] ?? STONES.river
}

export const COSMETICS = [
  { id: 'plain', name: 'No trail', unlockStars: 0 },
  { id: 'rainbow', name: 'Rainbow Trail', unlockStars: 4 },
  { id: 'firefly', name: 'Firefly Trail', unlockStars: 14 },
  { id: 'crystal', name: 'Crystal Sparkle', unlockStars: 26 },
  { id: 'golden', name: 'Golden Ripple', unlockStars: 45 },
  { id: 'moonlight', name: 'Moonlight Glow', unlockStars: 60 },
]

export const COSMETIC_LIST = COSMETICS

// ---------------------------------------------------------------------------
// Throw parameters
// ---------------------------------------------------------------------------

export const DEFAULT_THROW = { power: 0.72, heading: 0, angle: 4, spin: 7.5 }

/** Snap a throw to its canonical form so equal throws are byte-identical. */
export function normalizeThrow(spec = {}) {
  return {
    power: Math.round(clamp(finite(spec.power, DEFAULT_THROW.power), 0.02, 1) * 1000) / 1000,
    heading: Math.round(clamp(finite(spec.heading, 0), -0.24, 0.24) * 10000) / 10000,
    angle: Math.round(clamp(finite(spec.angle, DEFAULT_THROW.angle), 0, 14) * 100) / 100,
    spin: Math.round(clamp(finite(spec.spin, DEFAULT_THROW.spin), 0, 16) * 100) / 100,
    stoneId: STONES[spec.stoneId] ? spec.stoneId : 'river',
  }
}

/** Horizontal speed at release, in m/s. */
export function launchSpeed(power, stone) {
  return (8 + clamp(power, 0, 1) * 12) * stone.powerScale
}

export function createState(spec = {}, world = {}) {
  const launch = normalizeThrow(spec)
  const stone = stoneOf(launch.stoneId)
  const radians = (launch.angle * Math.PI) / 180
  const speed = launchSpeed(launch.power, stone)
  const horizontal = speed * Math.cos(radians)
  return {
    stone: stone.id,
    x: finite(world.startX, 0),
    y: 0.26,
    z: finite(world.startZ, 0),
    vx: Math.sin(launch.heading) * horizontal,
    vy: speed * Math.sin(radians),
    vz: Math.cos(launch.heading) * horizontal,
    spin: launch.spin,
    energy: 1,
    skips: 0,
    time: 0,
    contacts: 0,
    bestZ: 0,
    lastContactZ: 0,
    finalZ: 0,
    longestSkip: 0,
    lost: false,
    targetsHit: [],
    launch,
  }
}

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------

/**
 * Targets drift sideways on a fixed path, so their position is a function of
 * simulation time rather than of how many frames have been drawn.
 */
export function targetPositionAt(target, time) {
  const drift = target.drift
  const offset = drift ? Math.sin((time / drift.period) * Math.PI * 2 + (drift.phase ?? 0)) * drift.amplitude : 0
  return { x: target.x + offset, z: target.z }
}

/**
 * A skip only counts as a hit when the contact point lands on the target. Rings
 * are the same test with a smaller radius, which is why precision challenges
 * need a target that is actually reachable rather than merely nearby.
 */
export function targetHitAt(targets, point, time, alreadyHit = []) {
  for (const target of targets) {
    if (alreadyHit.includes(target.id)) continue
    const position = targetPositionAt(target, time)
    const distance = Math.hypot(point.x - position.x, point.z - position.z)
    if (distance <= target.radius) return { target, distance }
  }
  return null
}

// ---------------------------------------------------------------------------
// One step
// ---------------------------------------------------------------------------

/**
 * Advance the stone by one fixed step and report what happened, or null while
 * it is still in the air. Mutates `state` in place; the renderer and the
 * generator both call this, so a preview and the real throw cannot drift apart.
 */
export function stepState(state, world = {}) {
  if (state.lost) return null
  const stone = stoneOf(state.stone)
  const previousY = state.y

  const speed = Math.hypot(state.vx, state.vy, state.vz)
  const resistance = stone.drag * speed
  state.vx += (-state.vx * resistance + finite(world.windX, 0)) * STEP
  state.vy += (-GRAVITY - state.vy * resistance) * STEP
  state.vz += -state.vz * resistance * STEP
  state.x += state.vx * STEP
  state.y += state.vy * STEP
  state.z += state.vz * STEP
  state.spin *= Math.exp(-0.3 * STEP)
  state.time += STEP
  if (state.z > state.bestZ) state.bestZ = state.z

  if (state.time >= MAX_SIM_SECONDS) {
    state.lost = true
    return sink(state, state.skips >= MAX_SKIPS ? 'floated' : 'timeout')
  }

  if (state.y > 0 || state.vy >= 0) return null

  // Walk back to the water plane so the contact point is the crossing point
  // rather than the step that happened to land below it.
  const drop = previousY - state.y
  const fraction = drop > 1e-6 ? clamp(previousY / drop, 0, 1) : 1
  state.x -= state.vx * STEP * fraction
  state.z -= state.vz * STEP * fraction
  state.y = 0
  state.contacts += 1

  const forward = Math.hypot(state.vx, state.vz)
  const descent = Math.atan2(-state.vy, Math.max(forward, 1e-3))
  const spinQuality = clamp(state.spin / stone.idealSpin, 0, 1.2)
  const stability = stone.flatness * (0.55 + 0.45 * spinQuality)
  const maxAngle = Math.min(HARD_ANGLE_LIMIT, (10 + 5 * spinQuality) * (0.7 + 0.3 * stone.flatness) * DEG)
  const contact = { x: state.x, z: state.z }
  const skipDistance = state.z - state.lastContactZ

  const canSkip =
    state.skips < MAX_SKIPS &&
    forward > MIN_SKIP_SPEED &&
    descent < maxAngle &&
    state.energy > 0.08 &&
    spinQuality > 0.08 &&
    stability > MIN_STABILITY

  if (!canSkip) return sink(state, describeSink({ forward, descent, maxAngle, state, spinQuality }))

  // Energy first: this is the bounded budget that keeps a throw finite even if
  // the bounce arithmetic would otherwise carry it forever.
  const ratio = descent / Math.max(maxAngle, 0.02)
  state.energy -= 0.028 + 0.04 * ratio + (1 - spinQuality) * 0.02 + clamp(finite(world.chop, 0), 0, 1) * 0.03
  state.skips += 1
  state.lastContactZ = state.z
  state.finalZ = state.z
  if (skipDistance > state.longestSkip) state.longestSkip = skipDistance

  const penalty = 1 - 0.06 * ratio
  const efficiency = stone.skipEfficiency * penalty * (0.975 + 0.025 * spinQuality)
  const nextForward = forward * efficiency
  const nextAngle = clamp(descent * 0.99 * (0.94 + 0.06 * spinQuality), 2 * DEG, maxAngle * 0.85)
  state.vx *= efficiency
  state.vz = Math.cos(state.launch.heading) * nextForward
  state.vy = nextForward * Math.tan(nextAngle)
  state.spin *= stone.spinRetention
  state.y = 0.02

  const event = {
    type: 'skip',
    index: state.skips,
    x: state.x,
    z: state.z,
    time: state.time,
    speed: nextForward,
    impact: descent,
    quality: clamp(1 - ratio, 0, 1),
  }

  const targets = world.targets ?? []
  if (targets.length > 0) {
    const hit = targetHitAt(targets, contact, state.time, state.targetsHit)
    if (hit) {
      state.targetsHit.push(hit.target.id)
      event.hit = { id: hit.target.id, type: hit.target.type, x: contact.x, z: contact.z }
    }
  }

  return event
}

function describeSink({ forward, descent, maxAngle, state, spinQuality }) {
  if (state.energy <= 0.08) return 'spent'
  if (spinQuality <= 0.08) return 'no spin'
  if (descent >= maxAngle) return 'too steep'
  if (forward <= MIN_SKIP_SPEED) return 'too slow'
  return 'lost it'
}

function sink(state, reason) {
  state.lost = true
  state.y = 0
  state.finalZ = state.z
  return {
    type: 'sink',
    reason,
    x: state.x,
    z: state.z,
    time: state.time,
    skips: state.skips,
  }
}

// ---------------------------------------------------------------------------
// Whole throws
// ---------------------------------------------------------------------------

export function scoreThrow(result) {
  const skips = Math.max(0, result.skips ?? 0)
  const distance = Math.max(0, result.distance ?? 0)
  const hits = result.hits?.length ?? 0
  const combo = result.bestCombo ?? 0
  return Math.round(skips * 12 + distance * 3.4 + hits * 120 + combo * 60)
}

/**
 * Run a throw to completion. `sampleEvery` adds projected path samples for the
 * preview and for debugging; the returned numbers never depend on it.
 */
export function simulateThrow(spec, world = {}, { sampleEvery = 0, maxSteps = MAX_STEPS } = {}) {
  const state = createState(spec, world)
  const events = []
  const path = []
  let steps = 0
  let combo = 0
  let bestCombo = 0

  while (!state.lost && steps < maxSteps) {
    if (sampleEvery > 0 && steps % sampleEvery === 0) path.push({ x: state.x, y: state.y, z: state.z })
    const event = stepState(state, world)
    if (event) {
      events.push(event)
      if (event.type === 'skip') {
        combo = event.hit ? combo + 1 : 0
        if (combo > bestCombo) bestCombo = combo
      }
    }
    steps += 1
    if (state.z > 240) break
  }

  const result = {
    throw: state.launch,
    skips: state.skips,
    // Distance is how far the skipping carried the stone, so a throw that goes
    // straight in scores nothing: flying far without skipping is not the game.
    distance: Math.round(state.lastContactZ * 10) / 10,
    flight: Math.round(state.finalZ * 10) / 10,
    longestSkip: Math.round(state.longestSkip * 10) / 10,
    hits: state.targetsHit.slice(),
    bestCombo,
    sunk: state.lost,
    time: Math.round(state.time * 100) / 100,
    events,
    path,
  }
  result.score = scoreThrow(result)
  return result
}

/**
 * Points for the aiming guide: the flight up to the first contact, in world
 * space. The renderer projects them; the tests use them to prove the preview
 * matches the real throw.
 */
export function previewPath(spec, world = {}, { points = 28 } = {}) {
  const state = createState(spec, world)
  const out = [{ x: state.x, y: state.y, z: state.z }]
  let steps = 0
  const stride = Math.max(1, Math.round(18 / Math.max(1, points / 12)))
  while (!state.lost && steps < MAX_STEPS) {
    const event = stepState(state, world)
    if (steps % stride === 0) out.push({ x: state.x, y: state.y, z: state.z })
    if (event?.type === 'skip' || event?.type === 'sink') {
      out.push({ x: state.x, y: state.y, z: state.z })
      break
    }
    steps += 1
  }
  return out
}
