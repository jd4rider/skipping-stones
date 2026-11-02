import Phaser from 'phaser'
import {
  CREAM,
  FONT,
  H,
  SHORE_Y,
  SKY_H,
  W,
  button,
  fade,
  iconButton,
  panel,
  ripple,
  shoreFor,
  skyFor,
  splash,
  stoneSprite,
  targetMarker,
  text,
  waterFor,
  waterGlints,
} from './common.js'
import { data, record, recordLevel, setSetting } from '../save.js'
import {
  challengeAt,
  dailyChallenge,
  describeObjective,
  endlessChallenge,
  evaluateChallenge,
  generatedChallenge,
  locationForChallenge,
  seedFor,
} from '../challenges/index.js'
import { STEP, clamp, createState, previewPath, scoreThrow, stoneOf, stepState, targetPositionAt } from '../physics/simulation.js'
import { project } from '../physics/projection.js'
import { sfx } from '../sound.js'

/** Drawing offset so the stone rests inside the frame instead of at the lens. */
const RENDER_Z = 5
/** Flight is played back slower than real time so each skip can be seen. */
const TIME_SCALE = 0.62
const AIM_DEFAULTS = { power: 0.62, heading: 0, angle: 4, spin: 7.5 }

const toScreen = (point) => project({ x: point.x ?? 0, y: point.y ?? 0, z: (point.z ?? 0) + RENDER_Z })

export default class LakeScene extends Phaser.Scene {
  constructor() {
    super('lake')
  }

  init(payload) {
    this.payload = payload ?? {}
    this.mode = this.payload.mode ?? 'journey'
    this.number = this.payload.number ?? data.unlocked
    this.paused = false
    this.throwing = false
    this.finished = false
    this.state = null
    this.events = []
    this.hits = []
    this.combo = 0
    this.bestCombo = 0
    this.lastContactZ = 0
    this.acc = 0
    this.dragging = false
    this.aim = { ...AIM_DEFAULTS }
    this.spawned = 0
  }

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------

  resolveChallenge() {
    const seed = Number(this.payload.seed ?? 0)
    switch (this.mode) {
      case 'daily':
        return dailyChallenge()
      case 'zen':
        return generatedChallenge({ seed: seed || seedFor(`zen-${data.records.throws}`), locationIndex: this.payload.location ?? 0, localIndex: 7 })
      case 'precision':
        return generatedChallenge({
          seed: seed || seedFor(`precision-${data.records.throws}`),
          locationIndex: this.payload.location ?? 2,
          localIndex: 11,
          plan: 'targets',
        })
      case 'trick':
        return generatedChallenge({
          seed: seed || seedFor(`trick-${data.records.throws}`),
          locationIndex: this.payload.location ?? 3,
          localIndex: 13,
          plan: 'combo',
        })
      case 'endless':
        return endlessChallenge({ seed: seed || seedFor(`endless-${this.payload.step ?? 0}`), step: this.payload.step ?? 0 })
      default:
        return challengeAt(this.number)
    }
  }

  create() {
    if (this.input) this.input.enabled = true
    this.finished = false
    this.challenge = this.resolveChallenge()
    this.location = locationForChallenge(this.challenge)
    this.world = {
      windX: this.challenge.windX ?? 0,
      chop: this.challenge.chop ?? this.location.chop,
      targets: this.challenge.targets ?? [],
    }
    this.scored = this.mode === 'journey' || this.mode === 'daily'
    this.aim.angle = 4
    this.aim.spin = stoneOf(this.challenge.stoneId).idealSpin

    const reduced = data.settings.reducedMotion
    skyFor(this, this.location)
    waterFor(this, this.location)
    this.add.rectangle(W / 2, SHORE_Y, W, 6, 0xffffff, 0.08).setDepth(-42)
    waterGlints(this, this.location, reduced)
    shoreFor(this, this.location, reduced)

    this.targets = new Map()
    for (const target of this.world.targets) this.spawnTarget(target, 0)

    this.buildHud()
    this.buildControls()

    this.previewG = this.add.graphics().setDepth(30)
    this.landingG = this.add.graphics().setDepth(29)

    this.shadow = this.add.ellipse(0, 0, 54, 18, 0x001018, 0.35).setDepth(18)
    this.stone = this.add.container(0, 0).setDepth(22)
    this.stoneImage = stoneSprite(this, this.challenge.stoneId, 0.95)
    this.stone.add(this.stoneImage)
    this.stoneGlow = this.add.image(0, 0, 'glow').setDepth(21).setScale(0.5).setAlpha(0.35)
    this.restState = createState(this.throwSpec(), this.world)
    this.paintStone({ ...this.restState, time: 0 })

    this.bindInput()

    if (data.records.throws === 0 && this.mode === 'journey') this.showTutorial()
  }

  spawnTarget(target, time) {
    const position = targetPositionAt(target, time)
    const point = toScreen({ x: position.x, y: 0, z: position.z })
    const marker = targetMarker(this, point, target, 14)
    marker.setData('target', target)
    this.targets.set(target.id, marker)
    return marker
  }

  buildHud() {
    // A soft scrim keeps the readouts legible over sky, hills and water.
    const scrim = this.add.graphics().setDepth(38)
    scrim.fillGradientStyle(0x05161f, 0x05161f, 0x05161f, 0x05161f, 0.62, 0.62, 0, 0)
    scrim.fillRect(0, 0, W, 244)

    const modeLabel =
      this.mode === 'journey'
        ? `Journey ${this.number}/100`
        : this.mode === 'daily'
          ? 'Daily Challenge'
          : this.mode === 'zen'
            ? 'Zen'
            : this.mode === 'endless'
              ? `Endless · throw ${(this.payload.step ?? 0) + 1}`
              : this.mode === 'precision'
                ? 'Precision'
                : 'Trick Shot'

    panel(this, W / 2, 52, W - 24, 74, { radius: 20, alpha: 0.5, depth: 39 })
    this.add
      .text(64, 26, this.location.name, { fontFamily: FONT, fontSize: '19px', color: CREAM, fontStyle: 'bold' })
      .setDepth(41)
    text(this, 64, 50, `${modeLabel} · ${stoneOf(this.challenge.stoneId).name}`, 12, 'rgba(255,255,255,0.66)').setDepth(41)
    iconButton(this, 32, 52, '←', () => fade(this, 'menu'), { size: 42, depth: 42 })
    iconButton(this, W - 32, 52, data.settings.sound ? '🔊' : '🔇', () => {
      setSetting('sound', !data.settings.sound)
      this.scene.restart({ ...this.payload })
    }, { size: 42, depth: 42 })
    this.add
      .text(W - 64, 34, '↺', { fontFamily: FONT, fontSize: '20px', color: CREAM })
      .setOrigin(0.5)
      .setDepth(41)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.restart({ ...this.payload }))

    if (this.challenge.objective) {
      panel(this, W / 2, 118, W - 88, 46, { radius: 14, alpha: 0.42, depth: 39 })
      this.objectiveText = text(this, W / 2, 112, describeObjective(this.challenge), 15, CREAM, {
        fontStyle: 'bold',
      })
        .setOrigin(0.5)
        .setDepth(41)
      this.progressG = this.add.graphics().setDepth(40)
    }

    panel(this, W / 2, 178, 470, 70, { radius: 16, alpha: 0.3, depth: 39 })
    this.skipText = text(this, 116, 156, '0', 30, CREAM, { fontStyle: 'bold' }).setOrigin(0.5, 0).setDepth(41)
    text(this, 116, 190, 'SKIPS', 11, 'rgba(255,255,255,0.5)').setOrigin(0.5, 0).setDepth(41)
    this.distanceText = text(this, W / 2, 156, '0.0', 30, CREAM, { fontStyle: 'bold' }).setOrigin(0.5, 0).setDepth(41)
    text(this, W / 2, 190, 'METRES', 11, 'rgba(255,255,255,0.5)').setOrigin(0.5, 0).setDepth(41)
    this.scoreText = text(this, W - 116, 156, '0', 30, CREAM, { fontStyle: 'bold' }).setOrigin(0.5, 0).setDepth(41)
    text(this, W - 116, 190, 'SCORE', 11, 'rgba(255,255,255,0.5)').setOrigin(0.5, 0).setDepth(41)

    this.windText = text(this, W / 2, 232, this.windLabel(), 12, 'rgba(255,255,255,0.62)').setOrigin(0.5, 0).setDepth(41)

    this.hintText = text(this, W / 2, SHORE_Y - 26, 'Drag up from the stone to throw', 14, 'rgba(255,255,255,0.8)')
      .setOrigin(0.5)
      .setDepth(41)
  }

  windLabel() {
    const wind = this.world.windX
    if (Math.abs(wind) < 0.05) return 'Still air'
    return `Wind ${wind > 0 ? '→' : '←'} ${Math.abs(wind).toFixed(2)}`
  }

  buildControls() {
    // Advanced players get explicit launch angle and spin; beginners never see
    // them, and the assisted defaults already throw well.
    if (!data.settings.advanced) return
    const stepper = (x, label, get, set, stepSize, format) => {
      panel(this, x, 250, 150, 54, { radius: 12, alpha: 0.42, depth: 41 })
      text(this, x, 226, label, 10, 'rgba(255,255,255,0.55)').setOrigin(0.5).setDepth(42)
      const value = text(this, x, 246, format(get()), 13, CREAM, { fontStyle: 'bold' }).setOrigin(0.5).setDepth(42)
      button(this, x - 52, 266, '−', () => set(get() - stepSize, value, format), {
        width: 34,
        height: 26,
        size: 15,
        fill: 0x11455c,
        depth: 42,
      })
      button(this, x + 52, 266, '+', () => set(get() + stepSize, value, format), {
        width: 34,
        height: 26,
        size: 15,
        fill: 0x11455c,
        depth: 42,
      })
    }
    stepper(W / 2 - 88, 'LAUNCH ANGLE', () => this.aim.angle, (next, label, format) => {
      this.aim.angle = clamp(next, 0, 12)
      label.setText(format(this.aim.angle))
      this.drawAim()
    }, 0.5, (value) => `${value.toFixed(1)}°`)
    stepper(W / 2 + 88, 'SPIN', () => this.aim.spin, (next, label, format) => {
      this.aim.spin = clamp(next, 0, 14)
      label.setText(format(this.aim.spin))
      this.drawAim()
    }, 0.5, (value) => value.toFixed(1))
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  bindInput() {
    this.aimZone = this.add
      .zone(W / 2, (SKY_H + SHORE_Y) / 2, W, SHORE_Y - SKY_H - 12)
      .setDepth(35)
      .setInteractive({ useHandCursor: true })

    this.aimZone.on('pointerdown', (pointer) => {
      if (this.throwing || this.finished) return
      this.dragging = true
      this.dragStart = { x: pointer.x, y: pointer.y }
      this.aim.power = 0
      this.aim.heading = 0
      this.hintText.setVisible(false)
      this.drawAim()
    })
    this.input.on('pointermove', (pointer) => {
      if (!this.dragging) return
      const dx = pointer.x - this.dragStart.x
      const dy = this.dragStart.y - pointer.y
      this.aim.power = clamp(dy / 210, 0, 1)
      this.aim.heading = clamp(dx / 190, -1, 1) * 0.22
      if (!data.settings.reducedMotion && Math.random() < 0.04) sfx.charge()
      this.drawAim()
    })
    this.input.on('pointerup', () => {
      if (!this.dragging) return
      this.dragging = false
      if (this.aim.power > 0.08) this.throwNow()
      else this.drawAim()
    })

    const keyboard = this.input.keyboard
    if (!keyboard) return
    keyboard.on('keydown-LEFT', () => {
      this.aim.heading = clamp(this.aim.heading - 0.02, -0.24, 0.24)
      this.drawAim()
    })
    keyboard.on('keydown-RIGHT', () => {
      this.aim.heading = clamp(this.aim.heading + 0.02, -0.24, 0.24)
      this.drawAim()
    })
    keyboard.on('keydown-UP', () => {
      this.aim.power = clamp(this.aim.power + 0.06, 0, 1)
      this.drawAim()
    })
    keyboard.on('keydown-DOWN', () => {
      this.aim.power = clamp(this.aim.power - 0.06, 0, 1)
      this.drawAim()
    })
    keyboard.on('keydown-SPACE', () => {
      if (!this.throwing && !this.finished) {
        if (this.aim.power < 0.1) this.aim.power = AIM_DEFAULTS.power
        this.throwNow()
      }
    })
    keyboard.on('keydown-ENTER', () => {
      if (!this.throwing && !this.finished) {
        if (this.aim.power < 0.1) this.aim.power = AIM_DEFAULTS.power
        this.throwNow()
      }
    })
    keyboard.on('keydown-R', () => this.scene.restart({ ...this.payload }))
    keyboard.on('keydown-ESCAPE', () => fade(this, 'menu'))
  }

  showTutorial() {
    {
      const box = this.add.container(W / 2, SHORE_Y - 250).setDepth(45)
      const g = this.add.graphics()
      g.fillStyle(0x061420, 0.78)
      g.fillRoundedRect(-212, -50, 424, 100, 18)
      g.lineStyle(1.5, 0xffffff, 0.2)
      g.strokeRoundedRect(-212, -50, 424, 100, 18)
      box.add(g)
      box.add(
        text(this, 0, -24, 'Drag up from the water to throw', 16, CREAM, { fontStyle: 'bold' }).setOrigin(0.5),
      )
      box.add(
        text(this, 0, 4, 'Longer drag = more power. Slide left or right to aim.', 12, 'rgba(255,255,255,0.72)', {
          align: 'center',
          wordWrap: { width: 420 },
        }).setOrigin(0.5),
      )
      box.add(text(this, 0, 30, 'Release to let it fly', 12, 'rgba(120,220,190,0.95)').setOrigin(0.5))
      this.tweens.add({ targets: box, alpha: 0, delay: 4200, duration: 700, onComplete: () => box.destroy() })
    }
  }

  // -------------------------------------------------------------------------
  // Throw
  // -------------------------------------------------------------------------

  throwSpec() {
    return {
      power: Number(this.aim.power.toFixed(3)),
      heading: Number(this.aim.heading.toFixed(4)),
      angle: this.aim.angle,
      spin: this.aim.spin,
      stoneId: this.challenge.stoneId,
    }
  }

  drawAim() {
    if (!this.previewG) return
    this.previewG.clear()
    this.landingG.clear()
    if (this.throwing || this.finished) return

    const spec = this.throwSpec()
    const assistance = data.settings.assistance
    const power = this.aim.power

    // Power meter down the left edge.
    const top = 380
    const height = 210
    const base = top + height
    this.previewG.fillStyle(0x04121c, 0.45)
    this.previewG.fillRoundedRect(24, top, 12, height, 6)
    const fill = Math.max(2, height * power)
    const colour = power > 0.85 ? 0xffd166 : power > 0.45 ? 0x7fe0c0 : 0x9fd8ee
    this.previewG.fillStyle(colour, 0.95)
    this.previewG.fillRoundedRect(24, base - fill, 12, fill, 6)

    if (assistance === 'none') return

    if (assistance === 'direction') {
      const from = toScreen({ x: 0, y: 0.26, z: 0 })
      const ahead = toScreen({ x: Math.sin(this.aim.heading) * 14, y: 0.26, z: Math.cos(this.aim.heading) * 14 })
      this.previewG.lineStyle(2, 0xffffff, 0.4)
      this.previewG.lineBetween(from.x, from.y, ahead.x, ahead.y)
      return
    }

    const points = previewPath(spec, this.world, { points: 26 })
    const screen = points.map(toScreen)
    for (let index = 1; index < screen.length; index += 1) {
      const a = screen[index - 1]
      const b = screen[index]
      const alpha = 0.3 + (index / screen.length) * 0.6
      this.previewG.lineStyle(Math.max(1.6, 4 * b.visual), 0xffffff, alpha)
      this.previewG.lineBetween(a.x, a.y, b.x, b.y)
    }
    const landing = screen.at(-1)
    if (landing) {
      this.previewG.lineStyle(2, 0xffffff, 0.6)
      this.previewG.strokeEllipse(landing.x, landing.y, 34 * landing.visual + 12, 15 * landing.visual + 5)
    }
  }

  throwNow() {
    if (this.throwing || this.finished) return
    this.throwing = true
    this.dragging = false
    this.state = createState(this.throwSpec(), this.world)
    this.events = []
    this.hits = []
    this.combo = 0
    this.bestCombo = 0
    this.lastContactZ = 0
    this.acc = 0
    this.trailClock = 0
    this.previewG.clear()
    this.hintText.setVisible(false)
    sfx.release()
    this.updateHud()
  }

  onEvent(event) {
    if (event.type === 'skip') {
      this.events.push(event)
      this.lastContactZ = event.z
      const point = toScreen({ x: event.x, y: 0, z: event.z })
      ripple(this, point, clamp(event.quality + 0.3, 0.2, 1), 24)
      splash(this, point, event.quality, 25)
      sfx.skip(event.index, clamp(event.quality, 0, 1))
      this.popLabel(point, `${event.index}`)
      this.combo = event.hit ? this.combo + 1 : 0
      if (this.combo > this.bestCombo) this.bestCombo = this.combo
      if (event.hit) {
        this.hits.push(event.hit.id)
        const marker = this.targets.get(event.hit.id)
        if (marker) this.burstTarget(marker)
        if (event.hit.type === 'precision') sfx.hit()
        else if (this.combo >= 2) sfx.combo(this.combo)
        else sfx.hit()
        this.popLabel({ x: point.x, y: point.y - 30 }, 'TARGET', '#ffd166')
      }
      this.updateHud()
    } else if (event.type === 'sink') {
      const point = toScreen({ x: event.x, y: 0, z: event.z })
      ripple(this, point, 1.2, 24)
      splash(this, point, 1.6, 25)
      sfx.splash(1.4)
      this.finish()
    }
  }

  popLabel(point, label, colour = '#ffffff') {
    if (data.settings.reducedMotion) return
    const item = text(this, point.x, point.y - 12, label, 15, colour, { fontStyle: 'bold' }).setOrigin(0.5).setDepth(28)
    this.tweens.add({
      targets: item,
      y: item.y - 34,
      alpha: 0,
      duration: 900,
      ease: 'Quad.Out',
      onComplete: () => item.destroy(),
    })
  }

  burstTarget(marker) {
    marker.setData('hit', true)
    const halo = marker.getData('halo')
    if (halo) {
      this.tweens.add({ targets: halo, scale: 2.2, alpha: 0, duration: 600, ease: 'Quad.Out' })
    }
    for (let index = 0; index < 8; index += 1) {
      const spark = this.add.image(marker.x, marker.y, 'spark').setDepth(26).setScale(0.3).setAlpha(0.9)
      this.tweens.add({
        targets: spark,
        x: marker.x + Phaser.Math.Between(-40, 40),
        y: marker.y + Phaser.Math.Between(-34, 14),
        alpha: 0,
        scale: 0.05,
        duration: 560 + index * 40,
        onComplete: () => spark.destroy(),
      })
    }
  }

  paintStone(state) {
    if (!state) {
      this.stone.setVisible(false)
      this.shadow.setVisible(false)
      this.stoneGlow.setVisible(false)
      return
    }
    const point = toScreen(state)
    const ground = toScreen({ x: state.x, y: 0, z: state.z })
    const visual = point.visual
    this.stone.setVisible(true)
    this.stone.setPosition(point.x, point.y)
    this.stone.setScale(0.95 * Math.max(0.55, visual))
    this.stone.setRotation(state.spin * state.time * 0.55 + state.time * 0.6)
    this.shadow.setVisible(true)
    this.shadow.setPosition(ground.x, ground.y)
    this.shadow.setScale(Math.max(0.35, visual) * (1 - Math.min(0.4, state.y * 0.12)))
    this.shadow.setAlpha(0.32 - Math.min(0.2, state.y * 0.05))
    this.stoneGlow.setVisible(true)
    this.stoneGlow.setPosition(point.x, point.y)
    this.stoneGlow.setScale(1.1 * Math.max(0.4, visual))
    this.stoneGlow.setAlpha(0.12 + (state.vz > 0 ? 0.06 : 0))
  }

  paintTrail(state) {
    const cosmetic = data.settings.cosmetic
    if (cosmetic === 'plain' || data.settings.reducedMotion || !state) return
    this.trailClock += 1
    if (this.trailClock % 4 !== 0) return
    const point = toScreen(state)
    const colours = { rainbow: 0xff9ecb, firefly: 0xd6ff8a, crystal: 0x9fe8ff, golden: 0xffd166, moonlight: 0xb9c4ff }
    const dot = this.add.circle(point.x, point.y, Math.max(1.5, 3.4 * point.visual), colours[cosmetic] ?? 0xffffff, 0.7).setDepth(20)
    this.tweens.add({ targets: dot, alpha: 0, scale: 0.2, duration: 420, onComplete: () => dot.destroy() })
  }

  updateHud() {
    const partial = {
      skips: this.events.filter((event) => event.type === 'skip').length,
      distance: this.lastContactZ,
      hits: this.hits,
      bestCombo: this.bestCombo,
      score: 0,
    }
    partial.score = scoreThrow(partial)
    this.skipText?.setText(String(partial.skips))
    this.distanceText?.setText(partial.distance.toFixed(1))
    this.scoreText?.setText(String(partial.score))

    if (this.challenge?.objective && this.progressG) {
      const judged = evaluateChallenge(this.challenge, partial)
      const width = W - 148
      this.progressG.clear()
      this.progressG.fillStyle(0x000000, 0.3)
      this.progressG.fillRoundedRect(W / 2 - width / 2, 128, width, 7, 3.5)
      const fill = Math.max(0, Math.min(1, judged.progress))
      if (fill > 0) {
        this.progressG.fillStyle(judged.passed ? 0x7fe0b0 : 0x8fd8ee, 0.95)
        this.progressG.fillRoundedRect(W / 2 - width / 2, 128, Math.max(7, width * fill), 7, 3.5)
      }
      this.objectiveText.setText(`${describeObjective(this.challenge)}  ·  ${Math.floor(judged.metric)}/${judged.target}`)
    }
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  update(time, delta) {
    if (!this.state) return

    // Buoys drift with simulation time so the aim preview, the proof and the
    // throw all describe the same water.
    if (!this.throwing) return

    this.acc += (Math.min(delta, 48) / 1000) * TIME_SCALE
    let guard = 0
    while (this.acc >= STEP && guard < 600) {
      const event = stepState(this.state, this.world)
      this.acc -= STEP
      guard += 1
      if (event) this.onEvent(event)
      if (this.state.lost || this.finished) break
    }

    this.paintStone(this.state)
    this.paintTrail(this.state)
    this.paintTargets(this.state.time)

    if (!this.state.lost && this.state.z > 90) this.finish()
  }

  paintTargets(time) {
    for (const [id, marker] of this.targets) {
      const target = marker.getData('target')
      if (!target) continue
      const position = targetPositionAt(target, time)
      const point = toScreen({ x: position.x, y: 0, z: position.z })
      marker.setPosition(point.x, point.y)
      const hit = marker.getData('hit')
      marker.setAlpha(hit ? 0.45 : 1)
    }
  }

  finish() {
    if (this.finished) return
    this.finished = true
    this.throwing = false
    const result = {
      throw: this.state.launch,
      skips: this.state.skips,
      distance: Math.round(this.lastContactZ * 10) / 10,
      flight: Math.round(this.state.finalZ * 10) / 10,
      longestSkip: Math.round(this.state.longestSkip * 10) / 10,
      hits: this.hits.slice(),
      bestCombo: this.bestCombo,
      score: 0,
      sunk: true,
      time: Math.round(this.state.time * 100) / 100,
      targets: this.world.targets,
    }
    result.score = scoreThrow(result)

    const before = (data.achievements ?? []).slice()
    record(result)

    let judged = null
    if (this.challenge?.objective) judged = evaluateChallenge(this.challenge, result)
    if (this.scored && judged?.passed) {
      recordLevel({
        challengeId: this.challenge.id,
        number: this.mode === 'journey' ? this.number : 0,
        stars: judged.stars,
        mode: this.mode,
      })
    }
    if (judged?.passed && this.mode === 'journey') sfx.complete()

    this.paintTargets(this.state.time)
    this.hintText?.setVisible(false)

    this.time.delayedCall(data.settings.reducedMotion ? 120 : 520, () => {
      this.scene.start('results', {
        result,
        judged,
        mode: this.mode,
        number: this.number,
        challenge: this.challenge,
        location: this.location.id,
        achievementsBefore: before,
        step: this.payload.step ?? 0,
      })
    })
  }
}
