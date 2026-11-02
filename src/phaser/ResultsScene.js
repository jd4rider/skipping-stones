import Phaser from 'phaser'
import { CREAM, H, W, button, drawSparkles, fade, panel, starString, text } from './common.js'
import { data } from '../save.js'
import { LOCATION_LIST } from '../challenges/index.js'
import { newlyUnlocked } from '../progress.js'
import { sfx } from '../sound.js'

export default class ResultsScene extends Phaser.Scene {
  constructor() {
    super('results')
  }

  init(payload) {
    this.payload = payload ?? {}
  }

  create() {
    if (this.input) this.input.enabled = true
    const { result = {}, judged, mode = 'journey', number = 0, challenge, location } = this.payload
    const lake = LOCATION_LIST.find((item) => item.id === location) ?? LOCATION_LIST[0]

    const background = this.add.graphics()
    background.fillGradientStyle(0x0b2433, 0x0b2433, 0x102b3c, 0x081821, 1)
    background.fillRect(0, 0, W, H)
    this.cameras.main.fadeIn(160, 8, 16, 26)

    if (!data.settings.reducedMotion) drawSparkles(this, judged?.passed ? 1 : 0.2, lake.accent)

    panel(this, W / 2, 430, 540, 620, { radius: 26, alpha: 0.9, fill: 0x0a2331, depth: 2 })

    const title = judged?.passed
      ? mode === 'daily'
        ? 'Daily done'
        : 'Challenge cleared'
      : result.skips >= 5
        ? 'A good throw'
        : result.skips > 0
          ? 'It skipped!'
          : 'Straight in'
    text(this, W / 2, 156, title, 30, CREAM, { fontStyle: 'bold' }).setOrigin(0.5).setDepth(3)
    text(this, W / 2, 190, `${lake.emoji}  ${lake.name}${number ? ` · ${number}/100` : ''}`, 13, 'rgba(255,255,255,0.6)')
      .setOrigin(0.5)
      .setDepth(3)

    const stars = judged?.passed ? judged.stars : 0
    text(this, W / 2, 240, starString(stars), 42, stars > 0 ? '#ffd166' : 'rgba(255,255,255,0.25)', { fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(3)

    const rows = [
      ['Skips', String(result.skips ?? 0)],
      ['Distance', `${(result.distance ?? 0).toFixed(1)} m`],
      ['Longest skip', `${(result.longestSkip ?? 0).toFixed(1)} m`],
      ['Targets hit', `${(result.hits ?? []).length}`],
      ['Score', String(result.score ?? 0)],
    ]
    rows.forEach(([label, value], index) => {
      const y = 300 + index * 40
      text(this, W / 2 - 200, y, label, 15, 'rgba(255,255,255,0.58)').setDepth(3)
      text(this, W / 2 + 200, y, value, 17, CREAM, { fontStyle: 'bold' }).setOrigin(1, 0).setDepth(3)
    })

    const unit = challenge?.objective?.type === 'distance' ? 'm' : challenge?.objective?.type === 'score' ? 'pts' : ''
    const objectiveLine = judged
      ? judged.passed
        ? `Objective met · ${judged.metric} ${unit}`.trim()
        : `Objective missed · ${judged.metric} of ${judged.target} ${unit}`.trim()
      : 'Practice throw — nothing at stake'
    text(this, W / 2, 512, objectiveLine, 14, judged?.passed ? '#8fe8c0' : judged ? 'rgba(255,180,150,0.95)' : 'rgba(255,255,255,0.6)', {
      fontStyle: 'bold',
    })
      .setOrigin(0.5)
      .setDepth(3)

    if (!judged?.passed && result.skips > 0) {
      text(this, W / 2, 538, this.tip(result), 12, 'rgba(255,255,255,0.55)', {
        align: 'center',
        wordWrap: { width: 440 },
      })
        .setOrigin(0.5)
        .setDepth(3)
    } else if (!judged?.passed && result.skips === 0) {
      text(this, W / 2, 538, 'Spin keeps a stone flat. Drag further for more power, and keep the launch shallow.', 12, 'rgba(255,255,255,0.55)', {
        align: 'center',
        wordWrap: { width: 440 },
      })
        .setOrigin(0.5)
        .setDepth(3)
    }

    const unlocked = newlyUnlocked({ achievements: this.payload.achievementsBefore ?? [] }, data)
    if (unlocked.length > 0) {
      text(this, W / 2, 588, `🏅 ${unlocked.map((badge) => badge.name).join(' · ')}`, 13, '#ffd166', {
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 460 },
      })
        .setOrigin(0.5)
        .setDepth(3)
      sfx.unlock()
    }

    const canAdvance = judged?.passed && mode === 'journey' && number > 0 && number < 100
    const nextNumber = number + 1
    const primaryLabel =
      mode === 'zen' || mode === 'endless' || mode === 'precision' || mode === 'trick'
        ? 'Throw again'
        : judged?.passed && canAdvance
          ? 'Next challenge'
          : judged?.passed && mode === 'daily'
            ? 'Back to the menu'
            : 'Try again'

    const primaryAction = () => {
      if (mode === 'zen' || mode === 'precision' || mode === 'trick') {
        fade(this, 'lake', { mode, seed: Math.floor(Math.random() * 1e9) })
      } else if (mode === 'endless') {
        fade(this, 'lake', { mode, step: (this.payload.step ?? 0) + 1 })
      } else if (judged?.passed && mode === 'daily') {
        fade(this, 'menu')
      } else if (judged?.passed && canAdvance) {
        fade(this, 'lake', { mode: 'journey', number: nextNumber })
      } else {
        fade(this, 'lake', { mode, number })
      }
    }

    button(this, W / 2, 646, primaryLabel, primaryAction, { width: 400, height: 56, size: 17, fill: 0x1f9d7a, depth: 4 })
    button(this, W / 2 - 104, 714, 'Replay', () => fade(this, 'lake', { mode, number }), {
      width: 194,
      height: 46,
      size: 14,
      fill: 0x0f3a4e,
      depth: 4,
    })
    button(this, W / 2 + 104, 714, 'Menu', () => fade(this, 'menu'), { width: 194, height: 46, size: 14, fill: 0x0f3a4e, depth: 4 })

    if (challenge?.proof) {
      text(this, W / 2, 768, `Best known throw on this board: ${challenge.proof.skips} skips · ${challenge.proof.distance} m`, 11, 'rgba(255,255,255,0.4)')
        .setOrigin(0.5)
        .setDepth(3)
    }
    text(this, W / 2, H - 26, 'littlejoyarcade.site', 12, 'rgba(255,255,255,0.45)').setOrigin(0.5).setDepth(3)

    if (judged?.passed) sfx.complete()
  }

  tip(result) {
    if ((result.hits ?? []).length === 0 && this.payload.challenge?.targets?.length > 0) {
      return 'The buoys sit on the line the stone takes. Aim through them rather than at the far shore.'
    }
    if (result.skips < 4) return 'A flatter launch and a firmer drag keep the stone on the surface. Spin matters too.'
    return 'Small changes in heading move the whole chain. Try nudging your aim a few degrees.'
  }
}
