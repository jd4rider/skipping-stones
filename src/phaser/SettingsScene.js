import Phaser from 'phaser'
import { CREAM, H, W, button, fade, iconButton, panel, text } from './common.js'
import { data, resetAll, setSetting } from '../save.js'
import { sfx } from '../sound.js'

const ASSISTANCE = ['full', 'first', 'direction', 'none']
const ASSISTANCE_LABEL = {
  full: 'Full path',
  first: 'First skip',
  direction: 'Direction only',
  none: 'Off',
}

export default class SettingsScene extends Phaser.Scene {
  constructor() {
    super('settings')
  }

  init() {
    this.confirmingReset = false
  }

  create() {
    if (this.input) this.input.enabled = true
    const background = this.add.graphics()
    background.fillGradientStyle(0x0b2433, 0x0b2433, 0x102b3c, 0x081821, 1)
    background.fillRect(0, 0, W, H)

    iconButton(this, 36, 44, '←', () => fade(this, 'menu'), { size: 48 })
    text(this, W / 2, 40, 'Settings', 24, CREAM, { fontStyle: 'bold' }).setOrigin(0.5)

    const row = (y, label, detail, value, action) => {
      panel(this, W / 2, y, W - 48, 62, { radius: 14, alpha: 0.5 })
      text(this, 56, y - 20, label, 16, CREAM, { fontStyle: 'bold' })
      text(this, 56, y + 2, detail, 11, 'rgba(255,255,255,0.5)', { wordWrap: { width: 380 } })
      button(this, W - 132, y, value, action, { width: 150, height: 40, size: 12, fill: 0x0f3a4e })
    }

    row(120, 'Sound', 'Skips, splashes and menus.', data.settings.sound ? 'On' : 'Off', () => {
      setSetting('sound', !data.settings.sound)
      this.scene.restart()
    })
    row(192, 'Aim guide', 'How much of the flight is drawn before you throw.', ASSISTANCE_LABEL[data.settings.assistance], () => {
      const index = ASSISTANCE.indexOf(data.settings.assistance)
      setSetting('assistance', ASSISTANCE[(index + 1) % ASSISTANCE.length])
      this.scene.restart()
    })
    row(264, 'Advanced controls', 'Adds launch angle and spin steppers in the lake.', data.settings.advanced ? 'Shown' : 'Hidden', () => {
      setSetting('advanced', !data.settings.advanced)
      this.scene.restart()
    })
    row(336, 'Reduced motion', 'Turns off drifting scenery and extra sparkle.', data.settings.reducedMotion ? 'On' : 'Off', () => {
      setSetting('reducedMotion', !data.settings.reducedMotion)
      this.scene.restart()
    })

    text(this, W / 2, 400, 'Controls', 15, CREAM, { fontStyle: 'bold' }).setOrigin(0.5)
    const lines = [
      ['Drag up from the lake', 'power, then release to throw'],
      ['Slide left / right', 'aim across the lake'],
      ['Arrow keys + Space', 'keyboard throwing'],
      ['R', 'restart this challenge'],
      ['Esc', 'back to the menu'],
    ]
    lines.forEach(([key, meaning], index) => {
      const y = 432 + index * 30
      text(this, 64, y, key, 13, 'rgba(255,255,255,0.8)', { fontStyle: 'bold' })
      text(this, W - 64, y, meaning, 12, 'rgba(255,255,255,0.5)').setOrigin(1, 0)
    })

    text(this, W / 2, 610, 'Saved on this device and in your Little Joy account.', 12, 'rgba(255,255,255,0.5)').setOrigin(0.5)

    button(
      this,
      W / 2,
      668,
      this.confirmingReset ? 'Tap again to erase everything' : 'Reset all progress',
      () => {
        if (!this.confirmingReset) {
          this.confirmingReset = true
          this.scene.restart()
          return
        }
        resetAll()
        sfx.undo?.()
        fade(this, 'menu')
      },
      { width: 380, height: 48, size: 14, fill: 0xb4534b },
    )

    text(this, W / 2, H - 40, 'Skipping Stones · v0.1.0 · littlejoyarcade.site', 12, 'rgba(255,255,255,0.4)').setOrigin(0.5)
  }
}
