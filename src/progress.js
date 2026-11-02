// Progression rules: stars, unlocks, records and badges. Pure functions over a
// plain save object, so the arcade client can mirror it as ordinary JSON.

import { COSMETIC_LIST, STONE_LIST } from './physics/simulation.js'
import { LOCATION_LIST, LOCATIONS } from './challenges/generator.js'

export const SAVE_VERSION = 1
export const MAX_STARS = 3
export const TOTAL_LEVELS = 100
export const LEVELS_PER_LOCATION = 20

export const ACHIEVEMENTS = [
  { id: 'first_skip', name: 'First Skip', description: 'Make a stone skip once.', check: (save) => save.records.bestSkips >= 1 },
  { id: 'triple_skipper', name: 'Triple Skipper', description: 'Make three skips in one throw.', check: (save) => save.records.bestSkips >= 3 },
  { id: 'five_skips', name: 'Five Skips', description: 'Make five skips in one throw.', check: (save) => save.records.bestSkips >= 5 },
  { id: 'seven_skips', name: 'Seven Skips', description: 'Make seven skips in one throw.', check: (save) => save.records.bestSkips >= 7 },
  { id: 'nine_skips', name: 'Nine Skips', description: 'Make nine skips in one throw — the best a stone will give.', check: (save) => save.records.bestSkips >= 9 },
  { id: 'long_distance', name: 'Long Distance', description: 'Send a stone 25 metres.', check: (save) => save.records.bestDistance >= 25 },
  { id: 'bullseye', name: 'Bullseye', description: 'Hit a precision ring.', check: (save) => save.precisionHits >= 1 },
  { id: 'combo_master', name: 'Combo Master', description: 'Hit three targets in one throw.', check: (save) => save.records.bestCombo >= 3 },
  { id: 'mountain_lake_champion', name: 'Mountain Lake Champion', description: 'Finish every Mountain Lake challenge.', check: (save) => locationCleared(save, 'mountain') },
  { id: 'sunset_skipper', name: 'Sunset Skipper', description: 'Finish ten Sunset Beach challenges.', check: (save) => locationClearedCount(save, 'sunset') >= 10 },
  { id: 'moonlight_master', name: 'Moonlight Master', description: 'Finish ten Moonlit River challenges.', check: (save) => locationClearedCount(save, 'moonlit') >= 10 },
  { id: 'stone_legend', name: 'Stone Legend', description: 'Earn one hundred stars.', check: (save) => totalStars(save) >= 100 },
]

const asInt = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : fallback)
const isDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

export function defaultSave() {
  return {
    version: SAVE_VERSION,
    stars: {},
    unlocked: 1,
    daily: {},
    streak: { last: null, count: 0 },
    achievements: [],
    records: { bestSkips: 0, bestDistance: 0, bestScore: 0, bestCombo: 0, totalSkips: 0, throws: 0 },
    precisionHits: 0,
    challengesCleared: 0,
    perfects: 0,
    settings: {
      sound: true,
      music: true,
      reducedMotion: false,
      assistance: 'first',
      advanced: false,
      stone: 'river',
      cosmetic: 'plain',
      quality: 'high',
    },
    updatedAt: 0,
  }
}

export function normalizeSave(raw) {
  const base = defaultSave()
  if (!raw || typeof raw !== 'object') return base

  const stars = {}
  if (raw.stars && typeof raw.stars === 'object') {
    for (const [key, value] of Object.entries(raw.stars)) {
      if (!/^[a-z]+-\d{2}$/.test(key)) continue
      const star = Math.min(MAX_STARS, asInt(value))
      if (star > 0) stars[key] = star
    }
  }

  const daily = {}
  if (raw.daily && typeof raw.daily === 'object') {
    for (const [date, entry] of Object.entries(raw.daily)) {
      if (!isDate(date)) continue
      daily[date] = { stars: Math.min(MAX_STARS, Math.max(1, asInt(entry?.stars, 1))) }
    }
  }

  const records = raw.records && typeof raw.records === 'object' ? raw.records : {}
  const stone = STONE_LIST.some((item) => item.id === raw.settings?.stone) ? raw.settings.stone : base.settings.stone
  const cosmetic = COSMETIC_LIST.some((item) => item.id === raw.settings?.cosmetic) ? raw.settings.cosmetic : base.settings.cosmetic
  const assistance = ['full', 'first', 'direction', 'none'].includes(raw.settings?.assistance) ? raw.settings.assistance : 'first'

  return {
    ...base,
    version: SAVE_VERSION,
    stars,
    unlocked: Math.min(TOTAL_LEVELS, Math.max(1, asInt(raw.unlocked, 1))),
    daily,
    streak: {
      last: isDate(raw.streak?.last) ? raw.streak.last : null,
      count: asInt(raw.streak?.count),
    },
    achievements: Array.isArray(raw.achievements) ? raw.achievements.filter((id) => typeof id === 'string') : [],
    records: {
      bestSkips: asInt(records.bestSkips),
      bestDistance: asInt(records.bestDistance),
      bestScore: asInt(records.bestScore),
      bestCombo: asInt(records.bestCombo),
      totalSkips: asInt(records.totalSkips),
      throws: asInt(records.throws),
    },
    precisionHits: asInt(raw.precisionHits),
    challengesCleared: asInt(raw.challengesCleared),
    perfects: asInt(raw.perfects),
    settings: {
      sound: raw.settings?.sound !== false,
      music: raw.settings?.music !== false,
      reducedMotion: raw.settings?.reducedMotion === true,
      assistance,
      advanced: raw.settings?.advanced === true,
      stone,
      cosmetic,
      quality: raw.settings?.quality === 'low' ? 'low' : 'high',
    },
    updatedAt: asInt(raw.updatedAt),
  }
}

export function totalStars(save) {
  return Object.values(save.stars).reduce((sum, value) => sum + value, 0)
}

export function starsFor(challengeId, save) {
  return save.stars[challengeId] ?? 0
}

export function isUnlocked(save, number) {
  return number <= Math.max(1, save.unlocked)
}

export function clearedIn(save, locationId) {
  return Object.keys(save.stars).filter((id) => id.startsWith(`${locationId}-`)).length
}

export function locationCleared(save, locationId) {
  return clearedIn(save, locationId) >= LEVELS_PER_LOCATION
}

export const locationClearedCount = clearedIn

export function unlockedStones(save) {
  return STONE_LIST.filter((stone) => totalStars(save) >= stone.unlockStars).map((stone) => stone.id)
}

export function unlockedCosmetics(save) {
  return COSMETIC_LIST.filter((item) => totalStars(save) >= item.unlockStars).map((item) => item.id)
}

export function unlockedLocations(save) {
  return LOCATION_LIST.filter((location) => totalStars(save) >= location.unlockStars).map((location) => location.id)
}

export function locationById(id) {
  return LOCATIONS.find((location) => location.id === id) ?? LOCATIONS[0]
}

export function unlockedAchievements(save) {
  return ACHIEVEMENTS.filter((achievement) => {
    try {
      return achievement.check(save)
    } catch {
      return false
    }
  })
}

function previousDate(date) {
  return new Date(Date.parse(`${date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)
}

function updateStreak(next, date) {
  if (next.streak.last === date) return
  next.streak.count = next.streak.last && previousDate(date) === next.streak.last ? next.streak.count + 1 : 1
  next.streak.last = date
}

/** Records are updated by every throw, challenge or not. */
export function recordThrow(save, result) {
  const next = normalizeSave(save)
  next.records.throws += 1
  next.records.totalSkips += Math.max(0, result.skips ?? 0)
  next.records.bestSkips = Math.max(next.records.bestSkips, result.skips ?? 0)
  next.records.bestDistance = Math.max(next.records.bestDistance, Math.round(result.distance ?? 0))
  next.records.bestScore = Math.max(next.records.bestScore, result.score ?? 0)
  next.records.bestCombo = Math.max(next.records.bestCombo, result.bestCombo ?? 0)
  if ((result.hits ?? []).length > 0) {
    const targets = result.targets ?? []
    if (targets.some((target) => target.type === 'precision')) next.precisionHits += 1
    else next.precisionHits += 1
  }
  next.achievements = unlockedAchievements(next).map((achievement) => achievement.id)
  next.updatedAt = Date.now()
  return next
}

/**
 * Record a finished challenge. Never mutates its input: a failed write must not
 * corrupt the screen the player is looking at.
 */
export function recordChallenge(save, { challengeId, number = 0, stars = 0, mode = 'journey', date = new Date().toISOString().slice(0, 10) }) {
  const next = normalizeSave(save)
  const earned = Math.min(MAX_STARS, Math.max(1, Math.round(stars)))

  if (mode === 'journey' && challengeId) {
    next.stars[challengeId] = Math.max(next.stars[challengeId] ?? 0, earned)
    const cleared = Object.keys(next.stars).length
    next.challengesCleared = cleared
    if (number > 0) next.unlocked = Math.min(TOTAL_LEVELS, Math.max(next.unlocked, number + 1))
    if (earned === MAX_STARS) next.perfects += 1
  } else if (mode === 'daily' && isDate(date)) {
    next.daily[date] = { stars: Math.max(next.daily[date]?.stars ?? 0, earned) }
    updateStreak(next, date)
  }

  const stones = unlockedStones(next)
  if (!stones.includes(next.settings.stone)) next.settings.stone = stones[stones.length - 1] ?? 'river'
  const cosmetics = unlockedCosmetics(next)
  if (!cosmetics.includes(next.settings.cosmetic)) next.settings.cosmetic = cosmetics[cosmetics.length - 1] ?? 'plain'

  next.achievements = unlockedAchievements(next).map((achievement) => achievement.id)
  next.updatedAt = Date.now()
  return next
}

export function newlyUnlocked(before, after) {
  const had = new Set(before?.achievements ?? [])
  return ACHIEVEMENTS.filter((achievement) => after.achievements.includes(achievement.id) && !had.has(achievement.id))
}

export function setSetting(save, key, value) {
  const next = normalizeSave(save)
  next.settings = { ...next.settings, [key]: value }
  return normalizeSave(next)
}
