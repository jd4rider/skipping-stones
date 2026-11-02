// Shared presentation: palettes, generated textures, layered scenery, and the
// UI controls every scene uses. No image or font files ship with the game.

import Phaser from 'phaser'
import { STONES, stoneOf } from '../physics/simulation.js'

export const W = 640
export const H = 940
export const SKY_H = 262
export const SHORE_Y = 806
export const FONT =
  'ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, "Apple Color Emoji", sans-serif'

export const CREAM = '#fdf7ec'
export const INK = '#0d2233'

const cache = new Set()

function canvasTexture(scene, key, width, height, draw) {
  if (scene.textures.exists(key)) return
  const texture = scene.textures.createCanvas(key, width, height)
  draw(texture.getContext(), width, height)
  texture.refresh()
  cache.add(key)
}

export function makeTextures(scene) {
  canvasTexture(scene, 'spark', 16, 16, (ctx) => {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(8, 8, 8, 0, Math.PI * 2)
    ctx.fill()
  })
  canvasTexture(scene, 'glow', 96, 96, (ctx) => {
    const gradient = ctx.createRadialGradient(48, 48, 2, 48, 48, 48)
    gradient.addColorStop(0, 'rgba(255,255,255,0.95)')
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.22)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 96, 96)
  })

  // One small stone sprite per type, drawn once and tinted by nothing.
  for (const stone of Object.values(STONES)) {
    canvasTexture(scene, `stone-${stone.id}`, 64, 64, (ctx) => {
      const body = ctx.createLinearGradient(0, 12, 0, 52)
      body.addColorStop(0, `#${stone.ring.toString(16).padStart(6, '0')}`)
      body.addColorStop(0.45, `#${stone.colour.toString(16).padStart(6, '0')}`)
      body.addColorStop(1, `#${stone.accent.toString(16).padStart(6, '0')}`)
      ctx.fillStyle = body
      ctx.beginPath()
      ctx.ellipse(32, 34, 24, 13, -0.12, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(30, 29, 17, 6.5, -0.14, Math.PI * 1.05, Math.PI * 1.85)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(0,0,0,0.16)'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.ellipse(33, 39, 19, 7, -0.1, Math.PI * 0.1, Math.PI * 0.9)
      ctx.stroke()
    })
    canvasTexture(scene, `stoneflat-${stone.id}`, 64, 64, (ctx) => {
      ctx.fillStyle = `#${stone.colour.toString(16).padStart(6, '0')}`
      ctx.beginPath()
      ctx.ellipse(32, 32, 22, 9, -0.08, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.beginPath()
      ctx.ellipse(29, 28, 12, 3.2, -0.1, 0, Math.PI * 2)
      ctx.fill()
    })
  }
}

// ---------------------------------------------------------------------------
// Scenery
// ---------------------------------------------------------------------------

/** Sky, sun/moon, ridges and treeline, cached per location. */
export function skyFor(scene, location) {
  const key = `sky-${location.id}`
  canvasTexture(scene, key, W, SKY_H + 40, (ctx) => {
    const sky = ctx.createLinearGradient(0, 0, 0, SKY_H + 40)
    sky.addColorStop(0, location.sky[0])
    sky.addColorStop(1, location.sky[1])
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, SKY_H + 40)

    const night = location.id === 'moonlit'
    const orbX = night ? 470 : 132
    const orbY = night ? 96 : 108
    const glow = ctx.createRadialGradient(orbX, orbY, 4, orbX, orbY, 120)
    glow.addColorStop(0, night ? 'rgba(232,238,255,0.55)' : 'rgba(255,252,226,0.85)')
    glow.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = glow
    ctx.fillRect(orbX - 120, orbY - 120, 240, 240)
    ctx.fillStyle = night ? '#f2f4ff' : '#fff6cf'
    ctx.beginPath()
    ctx.arc(orbX, orbY, night ? 34 : 38, 0, Math.PI * 2)
    ctx.fill()
    if (night) {
      ctx.fillStyle = location.sky[0]
      ctx.beginPath()
      ctx.arc(orbX - 16, orbY - 10, 32, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      for (let index = 0; index < 26; index += 1) {
        const x = (index * 137) % W
        const y = 18 + ((index * 71) % 210)
        ctx.globalAlpha = 0.25 + ((index * 37) % 50) / 100
        ctx.fillRect(x, y, 2, 2)
      }
      ctx.globalAlpha = 1
    }

    // Two ridges and a treeline give the lake its depth without any assets.
    const ridge = (baseY, height, colour, alpha) => {
      ctx.globalAlpha = alpha
      ctx.fillStyle = colour
      ctx.beginPath()
      ctx.moveTo(-10, baseY)
      for (let x = -10; x <= W + 10; x += 26) {
        const wave = Math.sin(x / 78 + baseY) * 0.5 + Math.sin(x / 31 + height) * 0.5
        ctx.lineTo(x, baseY - height * (0.55 + wave * 0.42))
      }
      ctx.lineTo(W + 10, SKY_H + 40)
      ctx.lineTo(-10, SKY_H + 40)
      ctx.closePath()
      ctx.fill()
      ctx.globalAlpha = 1
    }
    ridge(SKY_H - 22, 96, location.far, 0.75)
    ridge(SKY_H - 6, 58, location.hill, 0.95)

    if (location.id === 'forest' || location.id === 'mountain') {
      ctx.fillStyle = location.hill
      for (let index = 0; index < 34; index += 1) {
        const x = 8 + index * 19
        const h = 26 + ((index * 53) % 34)
        const y = SKY_H - 4
        ctx.beginPath()
        ctx.moveTo(x, y - h)
        ctx.lineTo(x + 9, y)
        ctx.lineTo(x - 9, y)
        ctx.closePath()
        ctx.fill()
      }
    }
    if (location.id === 'lagoon') {
      for (let index = 0; index < 7; index += 1) {
        const x = 40 + index * 88
        ctx.fillStyle = 'rgba(214,255,250,0.75)'
        ctx.beginPath()
        ctx.moveTo(x, SKY_H - 40)
        ctx.lineTo(x + 16, SKY_H - 4)
        ctx.lineTo(x - 16, SKY_H - 4)
        ctx.closePath()
        ctx.fill()
      }
    }
    if (location.id === 'sunset') {
      ctx.fillStyle = 'rgba(255,214,150,0.55)'
      ctx.fillRect(0, SKY_H - 10, W, 20)
    }
  })
  return scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(-60)
}

/** The water gradient, cached per location. */
export function waterFor(scene, location) {
  const key = `water-${location.id}`
  const height = H - SKY_H
  canvasTexture(scene, key, 9, height, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, location.water[0])
    gradient.addColorStop(0.45, location.water[1])
    gradient.addColorStop(1, shade(location.water[1], 0.85))
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 9, height)
  })
  const image = scene.add.image(0, SKY_H, key).setOrigin(0, 0).setDisplaySize(W, height).setDepth(-50)
  if (location.id !== 'forest') {
    const glitter = scene.add.image(location.id === 'moonlit' ? 470 : 132, SKY_H + 6, 'glow')
    glitter.setDisplaySize(150, 320).setAlpha(location.id === 'moonlit' ? 0.22 : 0.3).setDepth(-49)
    glitter.setTint(0xfff4cf)
  }
  return image
}

function shade(hex, factor) {
  const value = Phaser.Display.Color.HexStringToColor(hex)
  const mix = (channel) => Math.round(channel * factor)
  return `rgb(${mix(value.red)}, ${mix(value.green)}, ${mix(value.blue)})`
}

/** Slow horizontal glints that read as a moving surface. */
export function waterGlints(scene, location, reducedMotion = false) {
  const group = []
  const width = 30 + (location.id.length % 5) * 12
  for (let index = 0; index < 14; index += 1) {
    const y = SKY_H + 14 + index * 44 + ((index * 17) % 9)
    const depth = index / 14
    const bar = scene.add
      .rectangle(Phaser.Math.Between(0, W), y, width * (0.5 + depth), 2 + depth * 3, 0xffffff, 0.05 + (1 - depth) * 0.1)
      .setDepth(-45)
    if (!reducedMotion) {
      scene.tweens.add({
        targets: bar,
        x: bar.x + Phaser.Math.Between(40, 120),
        alpha: { from: bar.alpha, to: bar.alpha * 0.4 },
        duration: Phaser.Math.Between(4200, 9000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      })
    }
    group.push(bar)
  }
  return group
}

/** The near shore: a soft ledge with a few pebbles, so the thrower has a place. */
export function shoreFor(scene, location, reducedMotion = false) {
  const g = scene.add.graphics().setDepth(-40)
  g.fillStyle(0x000000, 0.16)
  g.fillEllipse(W / 2, SHORE_Y + 96, W * 1.35, 120)
  g.fillStyle(Phaser.Display.Color.HexStringToColor(location.shore).color, 1)
  g.beginPath()
  g.moveTo(-20, H + 10)
  g.lineTo(-20, SHORE_Y + 34)
  g.lineTo(58, SHORE_Y + 16)
  g.lineTo(150, SHORE_Y + 6)
  g.lineTo(W - 150, SHORE_Y + 6)
  g.lineTo(W - 58, SHORE_Y + 16)
  g.lineTo(W + 20, SHORE_Y + 34)
  g.lineTo(W + 20, H + 10)
  g.closePath()
  g.fillPath()

  const pebble = Phaser.Display.Color.HexStringToColor(location.shore).darken(18).color
  for (let index = 0; index < 22; index += 1) {
    const x = 16 + index * 28 + ((index * 31) % 12)
    const y = SHORE_Y + 26 + ((index * 19) % 40)
    g.fillStyle(pebble, 0.5)
    g.fillEllipse(x, y, 10 + (index % 4) * 5, 5 + (index % 3) * 2)
  }
  const foam = scene.add.graphics().setDepth(-39)
  foam.lineStyle(2, 0xffffff, 0.28)
  for (let index = 0; index < 5; index += 1) {
    const y = SHORE_Y + 2 + index * 5
    const offset = index % 2 === 0 ? 0 : 60
    foam.beginPath()
    for (let x = -20 + offset; x < W + 20; x += 24) {
      foam.moveTo(x, y + Math.sin(x / 40) * 2)
      foam.lineTo(x + 12, y + Math.sin((x + 12) / 40) * 2)
    }
    foam.strokePath()
  }
  if (!reducedMotion) {
    scene.tweens.add({ targets: foam, alpha: { from: 0.55, to: 1 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
  }
  return g
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

export function text(scene, x, y, value, size = 22, colour = CREAM, extra = {}) {
  return scene.add.text(x, y, value, { fontFamily: FONT, fontSize: `${size}px`, color: colour, ...extra })
}

export function panel(scene, x, y, width, height, { radius = 24, fill = 0x0b2434, alpha = 0.72, stroke = 0xffffff, depth } = {}) {
  const g = scene.add.graphics()
  g.fillStyle(0x000000, 0.22)
  g.fillRoundedRect(x - width / 2 + 4, y - height / 2 + 7, width, height, radius)
  g.fillStyle(fill, alpha)
  g.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius)
  g.lineStyle(1.5, stroke, 0.22)
  g.strokeRoundedRect(x - width / 2, y - height / 2, width, height, radius)
  if (depth !== undefined) g.setDepth(depth)
  return g
}

export function button(scene, x, y, caption, onClick, options = {}) {
  const { width = 220, height = 54, size = 18, fill = 0x1c6f8f, textColour = CREAM, radius = 16, icon = '', depth } = options
  const box = scene.add.container(x, y)
  const bg = scene.add.graphics()
  const draw = (lift = 0) => {
    bg.clear()
    bg.fillStyle(0x000000, 0.25)
    bg.fillRoundedRect(-width / 2, -height / 2 + lift + 5, width, height, radius)
    bg.fillStyle(fill, 1)
    bg.fillRoundedRect(-width / 2, -height / 2 + lift, width, height, radius)
    bg.lineStyle(1.5, 0xffffff, 0.2)
    bg.strokeRoundedRect(-width / 2, -height / 2 + lift, width, height, radius)
  }
  draw()
  const label = text(scene, 0, 0, `${icon ? `${icon}  ` : ''}${caption}`, size, textColour, {
    fontStyle: 'bold',
    align: 'center',
  }).setOrigin(0.5)
  box.add([bg, label])
  box.setSize(width, height).setInteractive({ useHandCursor: true })
  box.on('pointerover', () => draw(-2))
  box.on('pointerout', () => draw(0))
  box.on('pointerdown', () => {
    scene.tweens.add({ targets: box, scale: 0.96, duration: 70, yoyo: true })
    onClick()
  })
  if (depth !== undefined) box.setDepth(depth)
  box.setCaption = (value) => label.setText(value)
  box.setEnabled = (enabled) => {
    box.setAlpha(enabled ? 1 : 0.42)
    box.disableInteractive()
    if (enabled) box.setInteractive({ useHandCursor: true })
  }
  return box
}

export function iconButton(scene, x, y, glyph, onClick, { size = 46, depth } = {}) {
  const box = scene.add.container(x, y)
  const bg = scene.add.graphics()
  bg.fillStyle(0x0b2434, 0.42)
  bg.fillCircle(0, 0, size / 2)
  bg.lineStyle(1.5, 0xffffff, 0.24)
  bg.strokeCircle(0, 0, size / 2)
  const label = text(scene, 0, 0, glyph, size * 0.42, CREAM).setOrigin(0.5)
  box.add([bg, label])
  box.setSize(size, size).setInteractive({ useHandCursor: true })
  box.on('pointerover', () => box.setScale(1.08))
  box.on('pointerout', () => box.setScale(1))
  box.on('pointerdown', onClick)
  if (depth !== undefined) box.setDepth(depth)
  return box
}

export function fade(scene, target, payload) {
  if (scene.input) scene.input.enabled = false
  scene.cameras.main.fadeOut(140, 8, 16, 26)
  scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(target, payload))
}

export function starString(stars, max = 3) {
  return '★'.repeat(Math.max(0, stars)) + '☆'.repeat(Math.max(0, max - stars))
}

export function stoneSprite(scene, stoneId, scale = 1) {
  const stone = stoneOf(stoneId)
  return scene.add.image(0, 0, `stone-${stone.id}`).setScale(scale)
}

// ---------------------------------------------------------------------------
// Water effects
// ---------------------------------------------------------------------------

/** An expanding ring on the water, squashed by the same perspective as the lake. */
export function ripple(scene, point, strength = 0.6, depth = 20) {
  const ring = scene.add.ellipse(point.x, point.y, 30, 12, 0xffffff, 0.05).setDepth(depth)
  ring.setStrokeStyle(2, 0xffffff, 0.75)
  scene.tweens.add({
    targets: ring,
    scaleX: 1.6 + strength * 1.8,
    scaleY: 1.4 + strength * 1.2,
    alpha: 0,
    duration: 900 + strength * 500,
    ease: 'Quad.Out',
    onComplete: () => ring.destroy(),
  })
  const inner = scene.add.ellipse(point.x, point.y, 16, 7, 0xffffff, 0.1).setDepth(depth)
  inner.setStrokeStyle(1.5, 0xffffff, 0.5)
  scene.tweens.add({
    targets: inner,
    scaleX: 2.4,
    scaleY: 1.9,
    alpha: 0,
    duration: 620,
    ease: 'Quad.Out',
    onComplete: () => inner.destroy(),
  })
  return ring
}

/** Droplets thrown up by a skip. */
export function splash(scene, point, strength = 0.6, depth = 21) {
  const count = 3 + Math.round(strength * 5)
  for (let index = 0; index < count; index += 1) {
    const size = 1.6 + Math.random() * (1.5 + strength * 2)
    const drop = scene.add.circle(point.x + Phaser.Math.Between(-8, 8), point.y, size, 0xeaf7ff, 0.85).setDepth(depth)
    const lift = Phaser.Math.Between(10, 30) * (0.5 + strength)
    scene.tweens.add({
      targets: drop,
      x: drop.x + Phaser.Math.Between(-22, 22),
      y: drop.y - lift,
      alpha: 0,
      duration: 320 + Math.random() * 260,
      ease: 'Quad.Out',
      onComplete: () => drop.destroy(),
    })
  }
}

/** Gentle confetti of light behind the results panel. */
export function drawSparkles(scene, strength = 1, tint = '#8fe8c0') {
  const colour = Phaser.Display.Color.HexStringToColor(tint).color
  const count = Math.round(6 + strength * 14)
  for (let index = 0; index < count; index += 1) {
    const spark = scene.add
      .image(Phaser.Math.Between(40, W - 40), Phaser.Math.Between(80, H - 120), 'spark')
      .setTint(colour)
      .setScale(Phaser.Math.FloatBetween(0.1, 0.4))
      .setAlpha(0)
      .setDepth(1)
    scene.tweens.add({
      targets: spark,
      alpha: { from: 0, to: 0.7 },
      y: spark.y - Phaser.Math.Between(20, 70),
      duration: Phaser.Math.Between(1400, 2600),
      delay: index * 120,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    })
  }
}

/** A softly glowing marker for a floating target, drawn in perspective. */
export function targetMarker(scene, point, target, depth = 15) {
  const width = Math.max(10, 92 * point.visual * (target.radius / 0.9))
  const height = width * 0.4
  const group = scene.add.container(point.x, point.y).setDepth(depth)

  const colour = Phaser.Display.Color.HexStringToColor(target.colour).color
  const halo = scene.add.ellipse(0, 0, width * 1.5, height * 1.6, colour, 0.16)
  const body = scene.add.ellipse(0, 0, width, height, colour, 0.92)
  body.setStrokeStyle(2, 0xffffff, 0.7)
  const inner = scene.add.ellipse(0, 0, width * 0.62, height * 0.62, 0x0b2434, 0.45)
  const pole = scene.add.rectangle(0, -height * 0.9, Math.max(1.5, width * 0.05), height * 1.6, 0xffffff, 0.5)

  const label = scene.add
    .text(0, -height * 1.5, target.type === 'precision' ? '◎' : target.type === 'gold' ? '★' : '●', Math.max(9, width * 0.34), '#ffffff', {
      fontStyle: 'bold',
    })
    .setOrigin(0.5)

  group.add([halo, pole, body, inner, label])
  group.setData('halo', halo)
  group.setData('body', body)
  group.setData('radius', point.visual)
  return group
}
