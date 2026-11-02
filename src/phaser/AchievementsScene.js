import Phaser from 'phaser'
import { CREAM, H, W, fade, iconButton, panel, text } from './common.js'
import { data } from '../save.js'
import { ACHIEVEMENTS } from '../progress.js'

export default class AchievementsScene extends Phaser.Scene {
  constructor() {
    super('achievements')
  }

  create() {
    if (this.input) this.input.enabled = true
    const background = this.add.graphics()
    background.fillGradientStyle(0x0b2433, 0x0b2433, 0x102b3c, 0x081821, 1)
    background.fillRect(0, 0, W, H)

    iconButton(this, 36, 44, '←', () => fade(this, 'menu'), { size: 48 })
    text(this, W / 2, 40, 'Badges', 24, CREAM, { fontStyle: 'bold' }).setOrigin(0.5)
    const earned = new Set(data.achievements ?? [])
    text(this, W / 2, 68, `${earned.size} of ${ACHIEVEMENTS.length} earned · ${data.records.bestSkips} best skips · ${data.records.bestDistance} m best`, 12, 'rgba(255,255,255,0.6)').setOrigin(0.5)

    ACHIEVEMENTS.forEach((badge, index) => {
      const y = 118 + index * 60
      const unlocked = earned.has(badge.id)
      panel(this, W / 2, y, W - 44, 52, { radius: 14, alpha: unlocked ? 0.82 : 0.42, fill: unlocked ? 0x14465e : 0x0b2433 })
      text(this, 52, y, unlocked ? '🏅' : '🔒', 18, CREAM).setOrigin(0.5)
      text(this, 78, y - 14, badge.name, 14, unlocked ? CREAM : 'rgba(255,255,255,0.6)', { fontStyle: 'bold' })
      text(this, 78, y + 4, badge.description, 11, 'rgba(255,255,255,0.5)', { wordWrap: { width: 470 } })
    })

    text(this, W / 2, H - 40, 'Badges unlock locally and sync to your Little Joy account.', 12, 'rgba(255,255,255,0.45)', {
      align: 'center',
    }).setOrigin(0.5)
  }
}
