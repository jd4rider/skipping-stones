import Phaser from 'phaser'
import { CREAM, H, W, button, fade, iconButton, panel, text } from './common.js'
import { data, setSetting } from '../save.js'
import { COSMETIC_LIST, STONE_LIST } from '../physics/simulation.js'
import { totalStars, unlockedCosmetics, unlockedStones } from '../progress.js'
import { sfx } from '../sound.js'

export default class StonesScene extends Phaser.Scene {
  constructor() {
    super('stones')
  }

  create() {
    if (this.input) this.input.enabled = true
    const background = this.add.graphics()
    background.fillGradientStyle(0x0b2433, 0x0b2433, 0x102b3c, 0x081821, 1)
    background.fillRect(0, 0, W, H)

    iconButton(this, 36, 44, '←', () => fade(this, 'menu'), { size: 48 })
    text(this, W / 2, 40, 'Stone collection', 24, CREAM, { fontStyle: 'bold' }).setOrigin(0.5)
    text(this, W / 2, 68, `${totalStars(data)}★ · every stone is playable, none of them wins the game for you`, 12, 'rgba(255,255,255,0.6)').setOrigin(0.5)

    const owned = unlockedStones(data)
    STONE_LIST.forEach((stone, index) => {
      const y = 148 + index * 92
      const unlocked = owned.includes(stone.id)
      const active = data.settings.stone === stone.id && unlocked
      panel(this, W / 2, y, W - 44, 82, { radius: 16, alpha: active ? 0.85 : 0.5, fill: active ? 0x14465e : 0x0b2433 })

      const sprite = this.add.image(58, y, `stone-${stone.id}`).setScale(0.72).setAlpha(unlocked ? 1 : 0.35)
      if (active) this.tweens.add({ targets: sprite, y: y - 3, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' })

      text(this, 96, y - 26, stone.name, 16, CREAM, { fontStyle: 'bold' })
      text(this, 96, y - 4, stone.blurb, 11, 'rgba(255,255,255,0.55)', { wordWrap: { width: 330 } })

      const bar = (x, value, colour) => {
        const g = this.add.graphics()
        g.fillStyle(0x000000, 0.35)
        g.fillRoundedRect(x, y + 14, 96, 5, 2.5)
        g.fillStyle(colour, 0.95)
        g.fillRoundedRect(x, y + 14, 96 * value, 5, 2.5)
      }
      bar(96, (stone.flatness - 0.75) / 0.25, 0x7fe0c0)
      bar(212, (stone.skipEfficiency - 0.9) / 0.05, 0x8fd8ee)
      bar(328, (stone.spinRetention - 0.9) / 0.08, 0xffd166)
      text(this, 96, y + 24, 'FLAT', 8, 'rgba(255,255,255,0.4)')
      text(this, 212, y + 24, 'GLIDE', 8, 'rgba(255,255,255,0.4)')
      text(this, 328, y + 24, 'SPIN', 8, 'rgba(255,255,255,0.4)')

      if (unlocked) {
        const action = text(this, W - 40, y, active ? 'EQUIPPED' : 'EQUIP', 11, active ? '#8fe8c0' : 'rgba(255,255,255,0.7)', {
          fontStyle: 'bold',
        }).setOrigin(1, 0.5)
        if (!active) {
          action.setInteractive({ useHandCursor: true })
          action.on('pointerdown', () => {
            sfx.click()
            setSetting('stone', stone.id)
            this.scene.restart()
          })
        }
      } else {
        text(this, W - 40, y, `🔒 ${stone.unlockStars}★`, 11, 'rgba(255,255,255,0.55)').setOrigin(1, 0.5)
      }
    })

    text(this, W / 2, 712, 'Cosmetics', 15, CREAM, { fontStyle: 'bold' }).setOrigin(0.5)
    const cosmetics = unlockedCosmetics(data)
    COSMETIC_LIST.forEach((item, index) => {
      const x = 62 + (index % 3) * 172
      const y = 758 + Math.floor(index / 3) * 56
      const unlocked = cosmetics.includes(item.id)
      const active = data.settings.cosmetic === item.id && unlocked
      button(
        this,
        x,
        y,
        unlocked ? item.name.split(' ')[0] : `🔒 ${item.unlockStars}★`,
        () => {
          if (!unlocked) return
          sfx.click()
          setSetting('cosmetic', item.id)
          this.scene.restart()
        },
        {
          width: 164,
          height: 44,
          size: 12,
          fill: active ? 0x1f9d7a : 0x0f3a4e,
          textColour: unlocked ? CREAM : 'rgba(255,255,255,0.5)',
        },
      )
    })

    text(this, W / 2, H - 60, 'Cosmetics change the trail only. Physics never depends on what you own.', 12, 'rgba(255,255,255,0.45)', {
      align: 'center',
      wordWrap: { width: 520 },
    }).setOrigin(0.5)
    text(this, W / 2, H - 28, 'littlejoyarcade.site', 12, 'rgba(255,255,255,0.4)').setOrigin(0.5)
  }
}
