#!/usr/bin/env node
/*
 * End-to-end check against production: the game itself and the arcade listing.
 *
 *   node scripts/check-live.mjs
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('/Users/jonathanforrider/Programming/mini-golf-garden-finished/node_modules/playwright')

const W = 640
const H = 940
const browser = await chromium.launch({ channel: 'chrome', headless: true })

// ---- the game -------------------------------------------------------------
const game = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const gameErrors = []
game.on('pageerror', (error) => gameErrors.push(error.message))
game.on('console', (message) => {
  if (message.type() === 'error') gameErrors.push(message.text())
})

await game.goto('https://jd4rider.github.io/skipping-stones/play/', { waitUntil: 'domcontentloaded' })
// Wait for the game's own boot signal rather than guessing at timings: the menu
// scene becoming active is the only reliable "ready for input" moment.
const booted = await game
  .waitForFunction(() => Boolean(window.skippingStones?.scene?.isActive('menu')), null, { timeout: 25000 })
  .then(() => true)
  .catch(() => false)
const rect = await game.evaluate(() => {
  const box = document.querySelector('#game canvas').getBoundingClientRect()
  return { left: box.left, top: box.top, width: box.width, height: box.height }
})
const toPage = (x, y) => ({ x: rect.left + (x / W) * rect.width, y: rect.top + (y / H) * rect.height })

// Start the current challenge through the menu button, as a player would.
const startButton = toPage(320, 292)
await game.mouse.click(startButton.x, startButton.y)
const inLake = await game
  .waitForFunction(() => Boolean(window.skippingStones?.scene?.isActive('lake')), null, { timeout: 15000 })
  .then(() => true)
  .catch(() => false)
await game.waitForTimeout(600)

// Drag from open water (below the first-run tutorial card) up and slightly right.
const start = toPage(320, 660)
const end = toPage(352, 470)
await game.mouse.move(start.x, start.y)
await game.mouse.down()
await game.mouse.move(end.x, end.y, { steps: 12 })
await game.mouse.up()
await game.waitForTimeout(1500)
await game.screenshot({ path: '/tmp/skipping-live.png' })

// Reaching the results scene is proof the throw ran to completion.
const reachedResults = await game
  .waitForFunction(() => Boolean(window.skippingStones?.scene?.isActive('results')), null, { timeout: 25000 })
  .then(() => true)
  .catch(() => false)
await game.waitForTimeout(600)

let save = null
for (let attempt = 0; attempt < 6 && !save; attempt += 1) {
  await game.waitForTimeout(800)
  save = await game.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('skipping-stones-save-v1') ?? 'null')
    } catch {
      return null
    }
  })
}
await game.screenshot({ path: '/tmp/skipping-live-results.png' })

// ---- the arcade -----------------------------------------------------------
const portal = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const portalErrors = []
portal.on('pageerror', (error) => portalErrors.push(error.message))

await portal.goto('https://littlejoyarcade.site/', { waitUntil: 'networkidle' })
await portal.waitForTimeout(3000)
const listed = await portal.getByText('Skipping Stones').count()
await portal.screenshot({ path: '/tmp/skipping-portal-home.png' })

await portal.goto('https://littlejoyarcade.site/#/game/skipping-stones', { waitUntil: 'networkidle' })
await portal.waitForTimeout(3500)
const heading = await portal.locator('h1').first().textContent().catch(() => null)
// The portal links out to the game rather than embedding it, so accept either.
const playTargets = await portal.evaluate(() => {
  const hrefs = [...document.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? '')
  const frames = [...document.querySelectorAll('iframe')].map((f) => f.getAttribute('src') ?? '')
  return [...hrefs, ...frames].filter((item) => item.includes('skipping-stones'))
})
await portal.screenshot({ path: '/tmp/skipping-portal-detail.png' })

const checks = [
  ['game boots to the menu', booted],
  ['the challenge opens', inLake],
  ['the throw reaches the results screen', reachedResults],
  ['game boots with no page errors', gameErrors.length === 0],
  ['a live throw recorded skips', (save?.records?.bestSkips ?? 0) >= 1],
  ['a live throw recorded distance', (save?.records?.bestDistance ?? 0) > 0],
  ['a live throw scored a challenge', Object.keys(save?.stars ?? {}).length >= 1],
  ['arcade home lists the game', listed > 0],
  ['arcade detail heading is right', (heading ?? '').trim() === 'Skipping Stones'],
  ['arcade offers a link to the live build', playTargets.length > 0],
  ['arcade page has no errors', portalErrors.length === 0],
]

let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`)
  if (!ok) failed += 1
}
if (gameErrors.length) console.log(`game errors: ${gameErrors.slice(0, 3).join(' | ')}`)
if (portalErrors.length) console.log(`portal errors: ${portalErrors.slice(0, 3).join(' | ')}`)
console.log(`detail heading: ${heading?.trim()} · play targets: ${playTargets.join(' ')}`)
console.log(`live records: ${JSON.stringify(save?.records ?? null)} · stars: ${JSON.stringify(save?.stars ?? null)}`)

await browser.close()
process.exit(failed === 0 ? 0 : 1)
