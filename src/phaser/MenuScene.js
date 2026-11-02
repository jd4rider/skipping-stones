import Phaser from 'phaser'
import { CREAM, H, SHORE_Y, SKY_H, W, button, fade, ripple, shoreFor, skyFor, text, waterFor, waterGlints } from './common.js'
import { data } from '../save.js'
import { TOTAL_CHALLENGES, challengeAt, dailyChallenge, locationForNumber, todayUTC } from '../challenges/index.js'
import { totalStars } from '../progress.js'
import { sfx } from '../sound.js'

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu')
  }

  create() {
    if (this.input) this.input.enabled = true
    const location = locationForNumber(Math.min(data.unlocked, TOTAL_CHALLENGES))
    const reduced = data.settings.reducedMotion

    skyFor(this, location)
    waterFor(this, location)
    waterGlints(this, location, reduced)
    shoreFor(this, location, reduced)
    this.cameras.main.fadeIn(200, 8, 16, 26)

    // A stone making its way across the title, with a ring under each bounce.
    if (!reduced) {
      const path = [
        { x: 118, y: 214 },
        { x: 258, y: 192 },
        { x: 380, y: 206 },
        { x: 470, y: 194 },
        { x: 536, y: 214 },
      ]
      const stone = this.add.image(path[0].x, path[0].y, `stone-${this.chosenStone()}`).setScale(0.5).setDepth(6)
      path.forEach((point, index) => {
        this.time.delayedCall(150 + index * 460, () => {
          ripple(this, { x: point.x, y: point.y + 12 }, 0.5, 4)
          this.tweens.add({
            targets: stone,
            x: point.x,
            y: point.y,
            duration: 420,
            ease: 'Sine.InOut',
          })
          sfx.skip(index + 1, 0.5)
        })
      })
      this.tweens.add({ targets: stone, alpha: { from: 1, to: 0.35 }, delay: 2900, duration: 900, repeat: -1, yoyo: true })
    }

    text(this, W / 2, 112, 'SKIPPING', 54, CREAM, { fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(4)
      .setShadow(0, 5, 'rgba(3,22,34,0.6)', 10, false, true)
    text(this, W / 2, 168, 'STONES', 54, '#a8f0d2', { fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(4)
      .setShadow(0, 5, 'rgba(3,22,34,0.6)', 10, false, true)

    text(this, W / 2, 236, 'Flat stones, a long lake, and the perfect angle.', 14, 'rgba(255,255,255,0.82)')
      .setOrigin(0.5)
      .setDepth(4)

    const next = Math.min(data.unlocked, TOTAL_CHALLENGES)
    const nextChallenge = challengeAt(next)
    const nextLocation = locationForNumber(next)
    button(
      this,
      W / 2,
      292,
      `${next > 1 ? 'Continue' : 'Start'} · ${nextLocation.name} ${((next - 1) % 20) + 1}`,
      () => fade(this, 'lake', { mode: 'journey', number: next }),
      { width: 420, height: 58, size: 19, fill: 0x1f9d7a, icon: '▶', depth: 5 },
    )

    const pair = (y, items) => {
      items.forEach((item, index) => {
        button(this, W / 2 + (index === 0 ? -108 : 108), y, item.label, item.action, {
          width: 206,
          height: 50,
          size: 15,
          fill: 0x0f3a4e,
          icon: item.icon,
          depth: 5,
        })
      })
    }

    pair(360, [
      { label: 'Journey', icon: '🗺', action: () => fade(this, 'levels') },
      { label: 'Daily', icon: '📅', action: () => fade(this, 'lake', { mode: 'daily' }) },
    ])
    pair(420, [
      { label: 'Zen', icon: '🌿', action: () => fade(this, 'lake', { mode: 'zen', location: 1 }) },
      { label: 'Endless', icon: '∞', action: () => fade(this, 'lake', { mode: 'endless', step: 0 }) },
    ])
    pair(480, [
      { label: 'Precision', icon: '◎', action: () => fade(this, 'lake', { mode: 'precision' }) },
      { label: 'Trick Shot', icon: '✦', action: () => fade(this, 'lake', { mode: 'trick' }) },
    ])
    pair(540, [
      { label: 'Stones', icon: '🪨', action: () => fade(this, 'stones') },
      { label: 'Badges', icon: '🏅', action: () => fade(this, 'achievements') },
    ])

    button(this, W / 2 - 108, 600, 'Settings', () => fade(this, 'settings'), {
      width: 206,
      height: 46,
      size: 14,
      fill: 0x0f3a4e,
      icon: '⚙',
      depth: 5,
    })
    button(this, W / 2 + 108, 600, data.settings.sound ? 'Sound on' : 'Muted', () => {
      data.settings.sound = !data.settings.sound
      sfx.click()
      this.scene.restart()
    }, { width: 206, height: 46, size: 14, fill: 0x0f3a4e, icon: '🔊', depth: 5 })

    const today = dailyChallenge(todayUTC())
    const dailyDone = Boolean(data.daily[todayUTC()])
    text(
      this,
      W / 2,
      646,
      dailyDone ? "Today's daily is done — come back tomorrow." : `Today's daily: ${today.location} · 3 stars for a clean throw`,
      12,
      'rgba(255,255,255,0.62)',
    )
      .setOrigin(0.5)
      .setDepth(5)

    text(this, W / 2, 676, `${Object.keys(data.stars).length}/${TOTAL_CHALLENGES} challenges · ${totalStars(data)}★ · best ${data.records.bestSkips} skips · ${data.records.bestDistance} m`, 12, 'rgba(255,255,255,0.55)')
      .setOrigin(0.5)
      .setDepth(5)

    const arcade = text(this, W / 2, H - 22, 'littlejoyarcade.site →', 13, 'rgba(255,255,255,0.6)', { fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(5)
    arcade.setInteractive({ useHandCursor: true })
    arcade.on('pointerdown', () => {
      sfx.click()
      window.open('https://littlejoyarcade.site', '_blank', 'noopener')
    })

    this.input.keyboard?.on('keydown-ENTER', () => fade(this, 'lake', { mode: 'journey', number: next }))
    if (!reduced) {
      this.add.image(W / 2, SKY_H + 122, 'glow').setScale(6).setAlpha(0.1).setDepth(-20)
      this.add.rectangle(W / 2, SHORE_Y - 4, W, 120, 0x0b2b3a, 0.18).setDepth(-41)
    }
  }

  chosenStone() {
    const stone = data.settings.stone
    return stone ?? 'river'
  }
}
