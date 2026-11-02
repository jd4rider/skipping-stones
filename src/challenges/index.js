// Runtime access to the baked journey, plus the deterministic daily and the
// on-demand generator used by Zen and Endless.

import { CHALLENGES, GENERATED_AT } from './data.js'
import { LOCATION_LIST, generateChallenge, locationOf, seedFor } from './generator.js'

export {
  LOCATIONS,
  LOCATION_LIST,
  locationOf,
  describeObjective,
  evaluateChallenge,
  challengeStone,
  locationOf as locationForId,
  seedFor,
  seededRandom,
} from './generator.js'

export const TOTAL_CHALLENGES = CHALLENGES.length
export const CHALLENGE_LIST = CHALLENGES
export const BAKED_AT = GENERATED_AT

export function challengeAt(number) {
  const index = Math.min(TOTAL_CHALLENGES, Math.max(1, Math.round(number || 1))) - 1
  return CHALLENGES[index]
}

export function challengeById(id) {
  return CHALLENGES.find((challenge) => challenge.id === id) ?? null
}

export function locationForChallenge(challenge) {
  return locationOf(challenge?.location)
}

export function locationForNumber(number) {
  return locationForChallenge(challengeAt(number))
}

export function chapterLabel(number) {
  const location = locationForNumber(number)
  const local = ((Math.round(number || 1) - 1) % 20) + 1
  return `${location.name} ${local}`
}

export function todayUTC(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10)
}

export function dayIndex(date) {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000)
}

const cache = new Map()

/**
 * The same UTC date must produce the same challenge for everybody. Generation
 * runs the validator, so a daily board is never handed out unproven.
 */
export function dailyChallenge(date = todayUTC()) {
  const key = `daily:${date}`
  if (cache.has(key)) return cache.get(key)
  const index = dayIndex(date)
  const locationIndex = ((index % LOCATION_LIST.length) + LOCATION_LIST.length) % LOCATION_LIST.length
  const challenge = generateChallenge({
    number: 0,
    locationIndex,
    localIndex: 6 + (index % 10),
    seed: seedFor(`skipping-stones-daily-${date}`),
    dense: true,
  })
  const wrapped = { ...challenge, id: `daily-${date}`, name: 'Daily Challenge', date, daily: true }
  cache.set(key, wrapped)
  return wrapped
}

/** A fresh, validated board for Zen or Endless. */
export function generatedChallenge({ seed, locationIndex, localIndex = 8, dense = true }) {
  const challenge = generateChallenge({ number: 0, locationIndex, localIndex, seed, dense })
  return { ...challenge, id: `free-${seed}`, name: 'Free Throw', freePlay: true }
}

/** Endless ramps the demand up as the streak grows. */
export function endlessChallenge({ seed, step = 0 }) {
  const localIndex = Math.min(19, 4 + Math.floor(step * 1.5))
  return generatedChallenge({ seed, locationIndex: step % LOCATION_LIST.length, localIndex })
}
