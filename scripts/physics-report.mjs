#!/usr/bin/env node
/*
 * Prints what the current physics constants actually do, so a feel change is a
 * measurement rather than a guess. Used while tuning and handy later:
 *
 *   npm run report
 */
import { STONE_LIST, simulateThrow } from '../src/physics/simulation.js'

const world = { windX: 0, targets: [] }

function line(label, spec) {
  const result = simulateThrow(spec, world)
  const skips = String(result.skips).padStart(2)
  const distance = `${result.distance.toFixed(1)}m`.padStart(7)
  const score = String(result.score).padStart(5)
  const longest = `${result.longestSkip.toFixed(1)}m`.padStart(6)
  console.log(`${label.padEnd(26)} skips ${skips}  distance ${distance}  longest ${longest}  score ${score}  ${result.time.toFixed(2)}s`)
}

console.log('\nPower sweep (river stone, 6.5°, full spin):')
for (const power of [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1]) {
  line(`power ${Math.round(power * 100)}%`, { power, angle: 4, spin: 7.5 })
}

console.log('\nLaunch angle sweep (river stone, 90% power):')
for (const angle of [0, 2, 4, 6, 8, 10, 14, 20]) {
  line(`${angle}°`, { power: 0.9, angle, spin: 7.5 })
}

console.log('\nSpin sweep (river stone, 90% power, 6.5°):')
for (const spin of [0, 1, 3, 5, 7.5, 10, 14]) {
  line(`spin ${spin}`, { power: 0.9, angle: 4, spin })
}

console.log('\nStone comparison (90% power, 6.5°, ideal spin):')
for (const stone of STONE_LIST) {
  line(stone.name, { power: 0.9, angle: 4, spin: stone.idealSpin, stoneId: stone.id })
}

console.log('\nWind (river stone, 90% power):')
for (const windX of [-0.6, -0.3, 0, 0.3, 0.6]) {
  const result = simulateThrow({ power: 0.9, angle: 4, spin: 7.5 }, { windX, targets: [] })
  console.log(`wind ${String(windX).padStart(5)}  skips ${String(result.skips).padStart(2)}  distance ${result.distance.toFixed(1)}m  drift ${result.events.at(-1)?.x.toFixed(2)}m`)
}
