/*
 * Seeded challenge construction and validation.
 *
 * Nothing here invents a goal and hopes it is reachable. Targets are placed on
 * the contact points of a throw that was actually simulated, and every numeric
 * goal is derived from the best result a search of throws could achieve. The
 * returned challenge always carries the throw that proves it, and the tests
 * replay that proof through the same simulation the player gets.
 */

import {
  STONES,
  clamp,
  simulateThrow,
  stoneOf,
  targetPositionAt,
} from '../physics/simulation.js'

export const LOCATIONS = [
  {
    id: 'mountain',
    name: 'Mountain Lake',
    subtitle: 'Clear water, pine ridges, a steady breeze.',
    sky: ['#8fd0ef', '#dff1fb'],
    water: ['#2f7fa8', '#0f4a6b'],
    shore: '#c2a878',
    hill: '#3d6e6a',
    far: '#6d93a6',
    wind: 0.18,
    chop: 0.1,
    accent: '#3f8fbf',
    unlockStars: 0,
    emoji: '🏔',
  },
  {
    id: 'forest',
    name: 'Forest Pond',
    subtitle: 'Lily pads, dragonflies, no wind at all.',
    sky: ['#a9dcc0', '#e8f6dd'],
    water: ['#2c6f52', '#0d3a2c'],
    shore: '#7d8f52',
    hill: '#2f5a3c',
    far: '#5b8a68',
    wind: 0.05,
    chop: 0.05,
    accent: '#4f8f5c',
    unlockStars: 4,
    emoji: '🌿',
  },
  {
    id: 'sunset',
    name: 'Sunset Beach',
    subtitle: 'Warm light, long swells, a cross-shore breeze.',
    sky: ['#ffb073', '#ffd9a8'],
    water: ['#c96a55', '#5b2a4a'],
    shore: '#e4c08a',
    hill: '#8a5a63',
    far: '#b07a72',
    wind: 0.5,
    chop: 0.35,
    accent: '#e0804b',
    unlockStars: 10,
    emoji: '🌅',
  },
  {
    id: 'lagoon',
    name: 'Crystal Lagoon',
    subtitle: 'Turquoise shallows and glowing stones.',
    sky: ['#9fe8e2', '#dffaf4'],
    water: ['#28b3ad', '#075e63'],
    shore: '#d9f0e2',
    hill: '#4f9d9a',
    far: '#7cc9c4',
    wind: 0.3,
    chop: 0.2,
    accent: '#17a39c',
    unlockStars: 22,
    emoji: '💠',
  },
  {
    id: 'moonlit',
    name: 'Moonlit River',
    subtitle: 'Fireflies, fog, and a current running left.',
    sky: ['#1a2148', '#3a2f6b'],
    water: ['#1a2c52', '#070d22'],
    shore: '#2a2f52',
    hill: '#151a38',
    far: '#2c3462',
    wind: 0.62,
    chop: 0.45,
    accent: '#8f9cf0',
    unlockStars: 38,
    emoji: '🌙',
  },
]

export const LOCATION_LIST = LOCATIONS

export function locationOf(id) {
  return LOCATIONS.find((location) => location.id === id) ?? LOCATIONS[0]
}

export const TIER_NAMES = ['First Ripples', 'Settling In', 'Finding the Line', 'Across the Bay', 'Master of the Lake']

// ---------------------------------------------------------------------------
// Seeded randomness
// ---------------------------------------------------------------------------

/** mulberry32: tiny, deterministic, and good enough for level variation. */
export function seededRandom(seed) {
  let state = (Number(seed) || 1) >>> 0
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seedFor(label) {
  let hash = 2166136261
  for (let index = 0; index < label.length; index += 1) {
    hash ^= label.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const between = (random, low, high) => low + random() * (high - low)
const round = (value, places) => Math.round(value * 10 ** places) / 10 ** places

// ---------------------------------------------------------------------------
// Throw search
// ---------------------------------------------------------------------------

/**
 * Candidate throws around a sensible starting point. Sparse on purpose: the
 * runtime daily challenge uses the same search, so it has to stay quick.
 */
export function searchThrows({ stoneId = 'river', windX = 0, chop = 0, targets = [] }, { dense = false } = {}) {
  const stone = stoneOf(stoneId)
  const powers = dense ? [0.45, 0.55, 0.65, 0.75, 0.85, 0.92, 1] : [0.5, 0.65, 0.8, 0.9, 1]
  const angles = dense ? [-2, -1, 0, 1, 2] : [-1.5, 0, 1.5]
  const headings = dense ? [-3, -1.5, 0, 1.5, 3] : [-2.5, 0, 2.5]
  const spins = dense ? [0.8, 1, 1.2] : [0.9, 1.1]
  const world = { windX, chop, targets }

  const results = []
  for (const power of powers) {
    for (const angleOffset of angles) {
      for (const headingDegrees of headings) {
        for (const spinFactor of spins) {
          const spec = {
            power,
            angle: 4.2 + angleOffset,
            heading: (headingDegrees * Math.PI) / 180,
            spin: stone.idealSpin * spinFactor,
            stoneId,
          }
          results.push(simulateThrow(spec, world))
        }
      }
    }
  }
  return results
}

function bestBy(results, score) {
  let best = null
  let bestScore = -Infinity
  for (const result of results) {
    const value = score(result)
    if (value > bestScore) {
      bestScore = value
      best = result
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------

const TARGET_KINDS = [
  { type: 'ring', label: 'Buoy', radius: 0.95, colour: '#f4a259' },
  { type: 'precision', label: 'Precision Ring', radius: 0.55, colour: '#6ec1e4' },
  { type: 'gold', label: 'Golden Target', radius: 0.7, colour: '#f2c14e' },
  { type: 'drifting', label: 'Drifting Buoy', radius: 0.9, colour: '#c78ce0' },
]

/**
 * Place targets on contact points of a proven throw, so every target sits on
 * water a stone can actually reach from the shore.
 */
function placeTargets(reference, count, random, { allowDrift = false, consecutive = false } = {}) {
  const skips = reference.events.filter((event) => event.type === 'skip')
  if (skips.length < count) return []
  const usable = skips.slice(0, Math.max(1, skips.length - 1))
  if (usable.length < count) return []
  const picks = []

  if (consecutive) {
    // A combo line: neighbouring bounces, so "two in a row" means what it says.
    const start = Math.max(0, Math.floor((usable.length - count) / 2))
    picks.push(...usable.slice(start, start + count))
  } else {
    const stride = usable.length / count
    for (let index = 0; index < count; index += 1) {
      const bucket = usable.slice(Math.floor(index * stride), Math.floor((index + 1) * stride))
      if (bucket.length === 0) continue
      picks.push(bucket[Math.floor(bucket.length / 2)])
    }
  }

  return picks.slice(0, count).map((contact, index) => {
    const kind = TARGET_KINDS[(index + Math.floor(random() * 2)) % TARGET_KINDS.length]
    const drifting = allowDrift && kind.type === 'drifting'
    const period = round(between(random, 4, 7), 1)
    return {
      id: `t${index + 1}`,
      type: kind.type,
      label: kind.label,
      colour: kind.colour,
      radius: kind.radius,
      x: round(contact.x, 2),
      z: round(contact.z, 2),
      // A drifting target is phased so it sits exactly on the contact point at
      // the instant the reference stone arrives. The proof throw therefore hits
      // it, and every other throw has to time it.
      drift: drifting
        ? {
            amplitude: round(clamp(contact.z * 0.012, 0.25, 0.9), 2),
            period,
            phase: round((-(contact.time / period) * Math.PI * 2) % (Math.PI * 2), 3),
          }
        : null,
    }
  })
}

function hitsFor(result, targets) {
  const ids = new Set(targets.map((target) => target.id))
  return result.hits.filter((id) => ids.has(id)).length
}

// ---------------------------------------------------------------------------
// Objectives
// ---------------------------------------------------------------------------

const OBJECTIVE_WEIGHT = {
  skips: (result) => result.skips,
  distance: (result) => result.distance,
  score: (result) => result.score,
  targets: (result) => result.hits.length,
  combo: (result) => result.bestCombo * 100 + result.hits.length,
}

export const OBJECTIVE_LABELS = {
  skips: 'skips',
  distance: 'metres',
  score: 'points',
  targets: 'targets',
  combo: 'targets in a row',
}

/**
 * How demanding a level is within its own objective type. Early levels ask for
 * a little more than half of what the best throw manages; later ones demand
 * most of it, which is what makes the curve feel gradual instead of arbitrary.
 */
function requirementFraction(localIndex, total) {
  const t = clamp(localIndex / Math.max(1, total - 1), 0, 1)
  return 0.5 + t * 0.34
}

function planFor(localIndex, locationIndex) {
  // A repeating shape per location, so each lake opens with a simple goal,
  // teaches its targets, then mixes them.
  const cycle = [
    'skips',
    'skips',
    'targets',
    'distance',
    'targets',
    'skips',
    'combo',
    'distance',
    'targets',
    'score',
  ]
  const base = cycle[localIndex % cycle.length]
  // Lakes later in the journey lean harder on precision.
  if (locationIndex >= 2 && localIndex % 5 === 4) return 'combo'
  if (locationIndex >= 3 && localIndex % 7 === 3) return 'targets'
  return base
}

const NAME_POOL = {
  skips: ['Across the Shallows', 'Ripple Count', 'Keep It Up', 'Steady Hand', 'Long Chain', 'Skimming'],
  distance: ['Far Shore', 'Long Glide', 'Out and Away', 'Big Arm', 'Horizon Line'],
  targets: ['Ring the Buoy', 'Thread the Mark', 'Hit the Spot', 'Marked Water', 'Target Practice'],
  combo: ['Double Tap', 'Back to Back', 'One After Another', 'Chained Marks'],
  score: ['Clean Throw', 'Big Number', 'Full Effort', 'Peak Form'],
}

// ---------------------------------------------------------------------------
// One challenge
// ---------------------------------------------------------------------------

/*
 * Each challenge hands you a specific stone and proves itself with that stone,
 * so a stored proof is exactly reproducible whatever the player has unlocked.
 * The stone rotates so the collection is felt in Journey too.
 */
export function challengeStone(localIndex, seed) {
  if (localIndex < 3) return 'river'
  const rotation = ['river', 'slate', 'granite', 'crystal', 'pebble', 'river', 'slate', 'crystal']
  return rotation[seed % rotation.length]
}

export function generateChallenge({ number, locationIndex, localIndex, seed, dense = false, totalLocal = 20, plan: planOverride = null }) {
  const location = LOCATIONS[locationIndex % LOCATIONS.length]
  const random = seededRandom(seed)
  const stoneId = STONES[challengeStone(localIndex, seed)] ? challengeStone(localIndex, seed) : 'river'
  const windX = round((random() * 2 - 1) * location.wind, 3)
  const world = { windX, chop: location.chop, targets: [] }
  const plan = planOverride ?? planFor(localIndex, locationIndex)

  const referenceSpec = {
    power: round(between(random, 0.82, 1), 3),
    angle: round(between(random, 3.4, 5.4), 2),
    heading: round((random() * 2 - 1) * 0.03, 4),
    spin: stoneOf(stoneId).idealSpin,
    stoneId,
  }
  const reference = simulateThrow(referenceSpec, world)

  let targets = []
  let objective
  let proof = reference
  let proofSpec = referenceSpec

  if (plan === 'targets' || plan === 'combo') {
    const count = plan === 'combo' ? 3 : 1 + (localIndex > 5 ? 1 : 0) + (localIndex > 15 ? 1 : 0)
    targets = placeTargets(reference, count, random, {
      allowDrift: localIndex > 4,
      consecutive: plan === 'combo',
    })
    const withTargets = { windX, chop: location.chop, targets }

    if (targets.length === 0) {
      // Not enough usable contacts: fall back to a skip count, still proven.
      const want = Math.max(2, reference.skips - 1)
      objective = { type: 'skips', target: want, targetIds: [] }
      proof = simulateThrow(referenceSpec, world)
    } else {
      // The reference throw is a candidate too: the targets were placed on its
      // contacts, so it is a proven solution and the level can never be a dead
      // end. The search only exists to find a margin above it.
      const results = [reference, ...searchThrows({ ...withTargets, stoneId }, { dense })]
      const needed = plan === 'combo' ? 2 : Math.max(1, Math.ceil(targets.length * 0.6))
      const best = bestBy(results, (result) => hitsFor(result, targets) * 1000 + (plan === 'combo' ? result.bestCombo : result.skips))
      proof = best
      proofSpec = best.throw
      objective = {
        type: plan === 'combo' ? 'combo' : 'targets',
        target: needed,
        targetIds: targets.map((target) => target.id),
      }
      // If drift made every target unreachable, damp it rather than shipping an
      // impossible level.
      if (hitsFor(best, targets) < needed) {
        // Belt and braces: if even the constructed throw misses, drop the drift
        // entirely rather than ship a target nobody can reach.
        targets = targets.map((target) => ({ ...target, drift: null }))
        const retry = [reference, ...searchThrows({ windX, chop: location.chop, targets, stoneId }, { dense: true })]
        proof = bestBy(retry, (result) => hitsFor(result, targets) * 1000 + result.skips)
        proofSpec = proof.throw
      }
    }
  }

  if (!objective) {
    const results = searchThrows({ ...world, stoneId }, { dense })
    const best = bestBy(results, OBJECTIVE_WEIGHT[plan])
    proof = best
    proofSpec = best.throw
    const metric = OBJECTIVE_WEIGHT[plan](best)
    const fraction = requirementFraction(localIndex, totalLocal)
    const raw = metric * fraction

    if (plan === 'skips') {
      objective = { type: 'skips', target: clamp(Math.floor(raw), 2, Math.max(2, best.skips - 1)), targetIds: [] }
    } else if (plan === 'distance') {
      objective = { type: 'distance', target: Math.max(6, Math.round(raw)), targetIds: [] }
    } else {
      objective = { type: 'score', target: Math.max(40, Math.round(raw / 5) * 5), targetIds: [] }
    }
  }

  const finalWorld = { windX, chop: location.chop, targets }
  const verified = simulateThrow(proofSpec, finalWorld)
  const metric = objective.type === 'targets' || objective.type === 'combo' ? hitsFor(verified, targets) : OBJECTIVE_WEIGHT[objective.type](verified)

  const stars = starThresholds(objective, targets, metric)

  const names = NAME_POOL[objective.type] ?? NAME_POOL.skips
  const name = names[Math.floor(random() * names.length)]

  return {
    id: `${location.id}-${String(localIndex + 1).padStart(2, '0')}`,
    number,
    location: location.id,
    name,
    objective,
    targets,
    windX,
    chop: location.chop,
    stoneId,
    stars,
    proof: {
      throw: verified.throw,
      skips: verified.skips,
      distance: verified.distance,
      hits: verified.hits,
      score: verified.score,
    },
    seed,
  }
}

function starThresholds(objective, targets, achievable) {
  if (objective.type === 'targets') {
    const cap = Math.max(objective.target, achievable)
    return [objective.target, Math.min(cap, objective.target + 1), cap]
  }
  if (objective.type === 'combo') {
    const cap = Math.max(objective.target, achievable)
    return [objective.target, Math.min(cap, objective.target + 1), cap]
  }
  // Stars can never ask for more than the best throw the search managed, so a
  // three-star level is always demonstrably possible.
  const first = objective.target
  const cap = Math.max(first, achievable)
  const second = Math.min(cap, Math.max(first + 1, Math.ceil(first * 1.15)))
  const third = Math.min(cap, Math.max(second + 1, Math.ceil(first * 1.32)))
  return [first, Math.max(first, second), Math.max(second, third)]
}

// ---------------------------------------------------------------------------
// Reading a result
// ---------------------------------------------------------------------------

/**
 * Judge a finished throw against a challenge. `progress` is what the HUD bar
 * shows; `stars` is 0 until the first threshold is met.
 */
export function evaluateChallenge(challenge, result) {
  const objective = challenge.objective
  const targets = challenge.targets ?? []
  let metric = 0
  let passed = false

  if (objective.type === 'targets') {
    const ids = new Set(objective.targetIds ?? [])
    const hit = result.hits.filter((id) => ids.has(id))
    metric = hit.length
    passed = metric >= objective.target
  } else if (objective.type === 'combo') {
    const ids = new Set(objective.targetIds ?? [])
    const hit = result.hits.filter((id) => ids.has(id))
    metric = result.bestCombo
    passed = metric >= objective.target && hit.length >= objective.target
  } else if (objective.type === 'distance') {
    metric = result.distance
    passed = metric >= objective.target
  } else if (objective.type === 'score') {
    metric = result.score
    passed = metric >= objective.target
  } else {
    metric = result.skips
    passed = metric >= objective.target
  }

  const thresholds = challenge.stars ?? [objective.target, objective.target, objective.target]
  let stars = 0
  for (const threshold of thresholds) {
    if (metric >= threshold) stars += 1
  }

  return {
    passed,
    stars: passed ? Math.max(1, stars) : 0,
    metric,
    target: thresholds[0],
    progress: clamp(metric / Math.max(1, thresholds[0]), 0, 1),
  }
}

export function describeObjective(challenge) {
  const objective = challenge.objective
  switch (objective.type) {
    case 'targets':
      return objective.target === 1 ? 'Hit the marked target' : `Hit ${objective.target} marked targets`
    case 'combo':
      return `Hit ${objective.target} targets in a row`
    case 'distance':
      return `Skip out to ${objective.target} m`
    case 'score':
      return `Score ${objective.target} points`
    default:
      return `Make ${objective.target} skips`
  }
}

export function markerPosition(target, time = 0) {
  return targetPositionAt(target, time)
}
