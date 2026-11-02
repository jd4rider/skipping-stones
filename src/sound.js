/*
 * Synthesised audio: no files to license and nothing loads until the first
 * gesture. Water is filtered noise, skips are short pitched plips, and the rest
 * is a small mallet synth so the whole thing stays quiet and warm.
 */

let ctx = null
export const audioState = { muted: false, musicOn: true }

function audio() {
  if (!ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return null
    ctx = new AudioContext()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(freq, { type = 'sine', dur = 0.16, gain = 0.06, delay = 0, slide = 0, attack = 0.012 } = {}) {
  if (audioState.muted || !Number.isFinite(freq)) return
  const a = audio()
  if (!a) return
  const start = a.currentTime + delay
  const osc = a.createOscillator()
  const amp = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), start + dur)
  amp.gain.setValueAtTime(0.0001, start)
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + attack)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(amp).connect(a.destination)
  osc.start(start)
  osc.stop(start + dur + 0.04)
}

function noise({ dur = 0.4, gain = 0.05, delay = 0, from = 1200, to = 220, type = 'bandpass', q = 0.8 } = {}) {
  if (audioState.muted) return
  const a = audio()
  if (!a) return
  const start = a.currentTime + delay
  const buffer = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate)
  const channel = buffer.getChannelData(0)
  for (let index = 0; index < channel.length; index += 1) channel[index] = Math.random() * 2 - 1
  const source = a.createBufferSource()
  source.buffer = buffer
  const filter = a.createBiquadFilter()
  filter.type = type
  filter.Q.value = q
  filter.frequency.setValueAtTime(from, start)
  filter.frequency.exponentialRampToValueAtTime(Math.max(60, to), start + dur)
  const amp = a.createGain()
  amp.gain.setValueAtTime(0.0001, start)
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + 0.02)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  source.connect(filter).connect(amp).connect(a.destination)
  source.start(start)
}

const SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24]

export const sfx = {
  click: () => tone(600, { type: 'triangle', dur: 0.05, gain: 0.035 }),
  charge: () => tone(220, { type: 'sine', dur: 0.09, gain: 0.02 }),
  release: () => {
    noise({ dur: 0.26, gain: 0.045, from: 900, to: 2600, type: 'highpass' })
    tone(240, { type: 'triangle', dur: 0.12, gain: 0.03, slide: 120 })
  },
  /** Each skip rises a step up the scale so a long chain feels like a phrase. */
  skip: (index = 1, quality = 0.5) => {
    const step = SCALE[Math.min(SCALE.length - 1, index - 1)] ?? 24
    const freq = 523.25 * 2 ** (step / 12)
    tone(freq, { type: 'sine', dur: 0.14 + quality * 0.08, gain: 0.05 + quality * 0.03 })
    noise({ dur: 0.16, gain: 0.02 + quality * 0.02, from: 2400, to: 700, q: 1.2 })
  },
  splash: (size = 1) => {
    noise({ dur: 0.32 + size * 0.2, gain: 0.05 + size * 0.03, from: 1800, to: 180, q: 0.6 })
    tone(160, { type: 'sine', dur: 0.2, gain: 0.03, slide: -60 })
  },
  hit: () => {
    tone(880, { type: 'triangle', dur: 0.12, gain: 0.06 })
    tone(1318, { type: 'sine', dur: 0.18, gain: 0.04, delay: 0.06 })
  },
  combo: (size = 2) => {
    for (let index = 0; index < Math.min(4, size); index += 1) {
      tone(659.25 * 2 ** (index * 2 / 12), { type: 'triangle', dur: 0.14, gain: 0.05, delay: index * 0.07 })
    }
  },
  fail: () => {
    tone(300, { type: 'sine', dur: 0.22, gain: 0.04, slide: -120 })
    noise({ dur: 0.4, gain: 0.04, from: 900, to: 140 })
  },
  complete: () => {
    ;[0, 4, 7, 12, 16].forEach((step, index) => {
      tone(523.25 * 2 ** (step / 12), { type: 'triangle', dur: 0.4, gain: 0.055, delay: index * 0.1 })
    })
  },
  unlock: () => {
    tone(740, { type: 'sine', dur: 0.16, gain: 0.05 })
    tone(988, { type: 'sine', dur: 0.22, gain: 0.04, delay: 0.09 })
  },
  wind: () => noise({ dur: 1.6, gain: 0.018, from: 500, to: 900, type: 'bandpass', q: 0.4 }),
}
