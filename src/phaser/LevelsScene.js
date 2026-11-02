import Phaser from 'phaser'
import { CREAM, H, W, button, fade, iconButton, panel, starString, text } from './common.js'
import { data } from '../save.js'
import { LOCATION_LIST } from '../challenges/index.js'
import { totalStars } from '../progress.js'
import { sfx } from '../sound.js'

const COLS = 4
const ROWS = 5

export default class LevelsScene extends Phaser.Scene {
  constructor() {
    super('levels')
  }

  init(payload) {
    const unlockedLocation = Math.max(
      0,
      LOCATION_LIST.findLastIndex((location) => totalStars(data) >= location.unlockStars),
    )
    this.locationIndex = payload?.location ?? unlockedLocation
  }

  create() {
    if (this.input) this.input.enabled = true
    const location = LOCATION_LIST[this.locationIndex]
    const background = this.add.graphics()
    background.fillGradientStyle(0x0b2433, 0x0b2433, 0x11374a, 0x0b1822, 1)
    background.fillRect(0, 0, W, H)

    iconButton(this, 36, 44, '←', () => fade(this, 'menu'), { size: 48 })
    text(this, W / 2, 40, 'Journey', 24, CREAM, { fontStyle: 'bold' }).setOrigin(0.5)
    text(this, W / 2, 70, `${totalStars(data)}★ earned · ${Object.keys(data.stars).length}/100 challenges`, 13, 'rgba(255,255,255,0.6)').setOrigin(0.5)

    // Lake tabs
    LOCATION_LIST.forEach((item, index) => {
      const x = 46 + index * 118
      const unlocked = totalStars(data) >= item.unlockStars
      const active = index === this.locationIndex
      panel(this, x, 122, 106, 44, { radius: 12, alpha: active ? 0.85 : 0.42, fill: active ? 0x1f9d7a : 0x0b2433 })
      const label = text(this, x, 122, unlocked ? item.emoji : '🔒', 18, CREAM).setOrigin(0.5)
      label.setInteractive({ useHandCursor: unlocked })
      if (unlocked) {
        label.on('pointerdown', () => {
          sfx.click()
          this.scene.restart({ location: index })
        })
      }
      text(this, x, 148, unlocked ? item.name.split(' ')[0] : `${item.unlockStars}★`, 9, 'rgba(255,255,255,0.6)').setOrigin(0.5)
    })

    text(this, W / 2, 176, `${location.emoji}  ${location.name}`, 20, CREAM, { fontStyle: 'bold' }).setOrigin(0.5)
    text(this, W / 2, 200, location.subtitle, 12, 'rgba(255,255,255,0.62)').setOrigin(0.5)

    const locked = totalStars(data) < location.unlockStars
    if (locked) {
      panel(this, W / 2, 470, 460, 200, { radius: 22, alpha: 0.7 })
      text(this, W / 2, 430, '🔒', 44, CREAM).setOrigin(0.5)
      text(this, W / 2, 482, `${location.name} unlocks at ${location.unlockStars}★`, 17, CREAM, { fontStyle: 'bold' }).setOrigin(0.5)
      text(this, W / 2, 512, 'Earn stars in the earlier lakes to open this one.', 13, 'rgba(255,255,255,0.65)').setOrigin(0.5)
      button(this, W / 2, 560, 'Back to the first lake', () => this.scene.restart({ location: 0 }), {
        width: 300,
        height: 44,
        size: 14,
        fill: 0x0f3a4e,
      })
      return
    }

    const tileW = 122
    const tileH = 92
    const originX = W / 2 - ((COLS - 1) * (tileW + 14)) / 2
    const originY = 254

    for (let index = 0; index < 20; index += 1) {
      const number = this.locationIndex * 20 + index + 1
      const col = index % COLS
      const row = Math.floor(index / COLS)
      const x = originX + col * (tileW + 14)
      const y = originY + row * (tileH + 14)
      const id = `${location.id}-${String(index + 1).padStart(2, '0')}`
      const stars = data.stars[id] ?? 0
      const unlocked = number <= data.unlocked
      const current = number === data.unlocked

      const g = this.add.graphics()
      g.fillStyle(0x000000, 0.22)
      g.fillRoundedRect(x - tileW / 2 + 3, y - tileH / 2 + 5, tileW, tileH, 16)
      g.fillStyle(unlocked ? (current ? 0x1f9d7a : 0x11445c) : 0x0a2230, unlocked ? 0.95 : 0.6)
      g.fillRoundedRect(x - tileW / 2, y - tileH / 2, tileW, tileH, 16)
      g.lineStyle(1.5, 0xffffff, current ? 0.5 : 0.14)
      g.strokeRoundedRect(x - tileW / 2, y - tileH / 2, tileW, tileH, 16)

      text(this, x, y - 26, unlocked ? String(number) : '🔒', unlocked ? 26 : 20, CREAM, { fontStyle: 'bold' }).setOrigin(0.5)
      text(this, x, y + 8, starString(stars), 15, stars > 0 ? '#ffd166' : 'rgba(255,255,255,0.28)').setOrigin(0.5)

      if (unlocked) {
        const hit = this.add.zone(x, y, tileW, tileH).setOrigin(0.5).setInteractive({ useHandCursor: true })
        hit.on('pointerdown', () => {
          sfx.click()
          fade(this, 'lake', { mode: 'journey', number })
        })
      }
    }

    button(this, W / 2, 824, 'Play this lake from the start', () => {
      fade(this, 'lake', { mode: 'journey', number: this.locationIndex * 20 + 1 })
    }, { width: 380, height: 46, size: 14, fill: 0x0f3a4e })
    text(this, W / 2, 872, 'Every board was generated and then verified: a stored throw proves it is beatable.', 11, 'rgba(255,255,255,0.45)', {
      align: 'center',
      wordWrap: { width: 540 },
    }).setOrigin(0.5)
  }
}
