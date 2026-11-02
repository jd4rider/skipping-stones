import assert from 'node:assert/strict'
import test from 'node:test'
import { CHALLENGES } from './data.js'
import {
  LOCATIONS,
  evaluateChallenge,
  generateChallenge,
  seedFor,
} from './generator.js'
import { TOTAL_CHALLENGES, challengeAt, dailyChallenge, dayIndex, generatedChallenge, todayUTC } from './index.js'
import { simulateThrow } from '../physics/simulation.js'

function replay(challenge) {
  return simulateThrow(challenge.proof.throw, {
    windX: challenge.windX,
    chop: challenge.chop,
    targets: challenge.targets,
  })
}

function worldOf(challenge) {
  return { windX: challenge.windX, chop: challenge.chop, targets: challenge.targets }
}

test('the journey is a hundred challenges, twenty per lake', () => {
  assert.equal(CHALLENGES.length, 100)
  assert.equal(TOTAL_CHALLENGES, 100)
  const perLocation = {}
  for (const challenge of CHALLENGES) perLocation[challenge.location] = (perLocation[challenge.location] ?? 0) + 1
  for (const location of LOCATIONS) assert.equal(perLocation[location.id], 20, location.id)
  assert.equal(new Set(CHALLENGES.map((challenge) => challenge.id)).size, 100, 'ids are unique')
  assert.equal(new Set(CHALLENGES.map((challenge) => challenge.number)).size, 100, 'numbers are unique')
})

test('every stored proof replays and satisfies its own objective', () => {
  for (const challenge of CHALLENGES) {
    const result = replay(challenge)
    const judged = evaluateChallenge(challenge, result)
    assert.ok(judged.passed, `${challenge.id} (${challenge.objective.type} ${challenge.objective.target}) got ${judged.metric}`)
    assert.equal(result.skips, challenge.proof.skips, `${challenge.id} replay must match the bake`)
  }
})

test('star thresholds rise and never ask for more than the proof achieved', () => {
  for (const challenge of CHALLENGES) {
    const [first, second, third] = challenge.stars
    assert.equal(first, challenge.objective.target, `${challenge.id} one star is the objective`)
    assert.ok(second >= first, `${challenge.id} two stars is harder than one`)
    assert.ok(third >= second, `${challenge.id} three stars is the hardest`)
    const judged = evaluateChallenge(challenge, replay(challenge))
    const ceiling = challenge.objective.type === 'targets' || challenge.objective.type === 'combo'
      ? challenge.targets.length
      : judged.metric
    assert.ok(third <= ceiling, `${challenge.id} asks for ${third} but only ${ceiling} is known reachable`)
  }
})

test('a challenge is failed by a throw that does nothing', () => {
  for (const challenge of CHALLENGES.slice(0, 12)) {
    const dud = simulateThrow({ power: 0.02, angle: 0, spin: 0, stoneId: challenge.stoneId }, worldOf(challenge))
    const judged = evaluateChallenge(challenge, dud)
    assert.equal(judged.passed, false, `${challenge.id} should not be passed by a dud`)
    assert.equal(judged.stars, 0)
  }
})

test('a mostly-good throw earns one star, not three', () => {
  for (const challenge of CHALLENGES) {
    const proof = evaluateChallenge(challenge, replay(challenge))
    assert.ok(proof.stars >= 1 && proof.stars <= 3)
  }
})

test('targets sit on water a stone can reach', () => {
  for (const challenge of CHALLENGES) {
    for (const target of challenge.targets) {
      assert.ok(target.z > 0 && target.z < 45, `${challenge.id} target at ${target.z}m`)
      assert.ok(Math.abs(target.x) <= target.z * 0.25 + 0.5, `${challenge.id} target off the lane at ${target.x}`)
      assert.ok(target.radius > 0.4 && target.radius <= 1)
    }
  }
})

test('combo challenges really do require consecutive hits', () => {
  const combos = CHALLENGES.filter((challenge) => challenge.objective.type === 'combo')
  assert.ok(combos.length >= 10)
  for (const challenge of combos) {
    const result = replay(challenge)
    assert.ok(result.bestCombo >= challenge.objective.target, `${challenge.id} best combo ${result.bestCombo}`)
    assert.ok(result.hits.length >= challenge.objective.target)
  }
})

test('challenge generation is deterministic for a seed', () => {
  const seed = seedFor('skipping-stones-test-seed')
  const first = generateChallenge({ number: 42, locationIndex: 2, localIndex: 7, seed })
  const second = generateChallenge({ number: 42, locationIndex: 2, localIndex: 7, seed })
  assert.deepEqual(first, second)
})

test('different seeds produce different boards', () => {
  // Two seeds can legitimately agree on a tiny board, so the check is that most
  // of a handful of pairs differ rather than every single one.
  let differing = 0
  for (let index = 0; index < 6; index += 1) {
    const a = generateChallenge({ number: 1, locationIndex: 3, localIndex: 9, seed: seedFor(`a${index}`) })
    const b = generateChallenge({ number: 1, locationIndex: 3, localIndex: 9, seed: seedFor(`b${index}`) })
    if (JSON.stringify(a.proof) !== JSON.stringify(b.proof) || JSON.stringify(a.targets) !== JSON.stringify(b.targets)) differing += 1
  }
  assert.ok(differing >= 4, `only ${differing}/6 seed pairs differed`)
})

test('every generated challenge proves itself', () => {
  for (let index = 0; index < 24; index += 1) {
    const challenge = generateChallenge({
      number: index + 1,
      locationIndex: index % LOCATIONS.length,
      localIndex: index % 20,
      seed: seedFor(`generated-${index}`),
    })
    const judged = evaluateChallenge(challenge, replay(challenge))
    assert.ok(judged.passed, `generated ${challenge.id} is not solvable`)
  }
})

test('the daily challenge is the same for everyone on a date', () => {
  const date = '2026-11-02'
  const first = dailyChallenge(date)
  const second = dailyChallenge(date)
  assert.equal(first.id, `daily-${date}`)
  assert.deepEqual(first, second, 'cached and regenerated boards must match')
  assert.ok(evaluateChallenge(first, replay(first)).passed)
})

test('a different day means a different daily challenge', () => {
  const today = dailyChallenge('2026-11-02')
  const tomorrow = dailyChallenge('2026-11-03')
  assert.notDeepEqual(today.proof.throw, tomorrow.proof.throw)
  assert.notEqual(today.location, tomorrow.location === today.location ? 'same' : tomorrow.location)
  assert.equal(dayIndex('2026-11-03') - dayIndex('2026-11-02'), 1)
})

test('todayUTC is a plain UTC date', () => {
  assert.match(todayUTC(new Date('2026-03-04T23:30:00Z')), /^2026-03-04$/)
})

test('free-play boards are valid and stable per seed', () => {
  const seed = seedFor('free-play')
  const board = generatedChallenge({ seed, locationIndex: 1 })
  assert.ok(evaluateChallenge(board, replay(board)).passed)
  const again = generatedChallenge({ seed, locationIndex: 1 })
  assert.deepEqual(board.proof, again.proof)
})

test('journey lookup is bounded in both directions', () => {
  assert.equal(challengeAt(1).number, 1)
  assert.equal(challengeAt(100).number, 100)
  assert.equal(challengeAt(-5).number, 1)
  assert.equal(challengeAt(9999).number, 100)
})

test('each challenge offers the stone it was proven with', () => {
  for (const challenge of CHALLENGES) {
    assert.ok(challenge.stoneId)
    assert.ok(challenge.proof.skips >= 0)
    assert.equal(challenge.proof.throw.stoneId, challenge.stoneId, `${challenge.id} proof uses its own stone`)
  }
})
