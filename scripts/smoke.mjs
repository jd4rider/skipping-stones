#!/usr/bin/env node
/*
 * Browser smoke test for the built game.
 *
 *   npm run build && node scripts/smoke.mjs http://localhost:4174/
 *
 * Uses the Playwright that ships with the neighbouring mini-golf project and
 * the installed Google Chrome, so nothing heavy is added to this repo.
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('/Users/jonathanforrider/Programming/mini-golf-garden-finished/node_modules/playwright')

const url = process.argv[2] ?? 'http://localhost:4174/'
const W = 640
const H = 940

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})

await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForSelector('#game canvas')
await page.waitForTimeout(1400)
await page.screenshot({ path: '/tmp/skipping-menu.png' })

const rect = await page.evaluate(() => {
  const box = document.querySelector('#game canvas').getBoundingClientRect()
  return { left: box.left, top: box.top, width: box.width, height: box.height }
})
const toPage = (x, y) => ({ x: rect.left + (x / W) * rect.width, y: rect.top + (y / H) * rect.height })
console.log(`canvas ${Math.round(rect.width)}×${Math.round(rect.height)} at ${Math.round(rect.left)},${Math.round(rect.top)}`)

// Enter starts the current journey challenge from the menu.
await page.keyboard.press('Enter')
await page.waitForTimeout(1200)
await page.screenshot({ path: '/tmp/skipping-lake.png' })

// Drag up from the water to throw, as a player would on a phone.
const start = toPage(320, 600)
const end = toPage(352, 420)
await page.mouse.move(start.x, start.y)
await page.mouse.down()
await page.mouse.move(end.x, end.y, { steps: 12 })
await page.waitForTimeout(220)
await page.screenshot({ path: '/tmp/skipping-aim.png' })
await page.mouse.up()
await page.waitForTimeout(2300)
await page.screenshot({ path: '/tmp/skipping-flight.png' })
await page.waitForTimeout(5200)
await page.screenshot({ path: '/tmp/skipping-results.png' })

const save = await page.evaluate(() => {
  try {
    return JSON.parse(localStorage.getItem('skipping-stones-save-v1') ?? 'null')
  } catch {
    return null
  }
})

const checks = [
  ['page booted without errors', errors.length === 0],
  ['the throw was recorded', (save?.records?.throws ?? 0) >= 1],
  ['the stone skipped at least once', (save?.records?.bestSkips ?? 0) >= 1],
  ['distance was measured', (save?.records?.bestDistance ?? 0) > 0],
  ['total skips counted', (save?.records?.totalSkips ?? 0) >= 1],
]

let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`)
  if (!ok) failed += 1
}
if (errors.length > 0) {
  console.log('errors:')
  for (const error of errors.slice(0, 6)) console.log(`  ${error}`)
}
console.log(`save: ${JSON.stringify(save?.records ?? null)}`)

await browser.close()
process.exit(failed === 0 ? 0 : 1)
