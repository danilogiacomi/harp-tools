/**
 * Spec §12's synthesised band. Each function schedules one hit on the audio clock at `t` into
 * `out` (the instrument's mixer channel); the nodes stop and are collected on their own.
 */

/** One second of white noise, shared by the snare and the hi-hat. */
export function makeNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

/** Kick: a sine dropping from 120 to 50 Hz. */
export function playKick(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  const osc = ctx.createOscillator()
  const env = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(120, t)
  osc.frequency.exponentialRampToValueAtTime(50, t + 0.12)
  env.gain.setValueAtTime(0.9, t)
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
  osc.connect(env).connect(out)
  osc.start(t)
  osc.stop(t + 0.32)
}

/** Snare: a burst of noise over a short 180 Hz body. */
export function playSnare(
  ctx: BaseAudioContext,
  out: AudioNode,
  t: number,
  noise: AudioBuffer,
): void {
  const src = ctx.createBufferSource()
  src.buffer = noise
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 1000
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.5, t)
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
  src.connect(hp).connect(env).connect(out)
  src.start(t)
  src.stop(t + 0.2)

  const body = ctx.createOscillator()
  const bodyEnv = ctx.createGain()
  body.type = 'triangle'
  body.frequency.value = 180
  bodyEnv.gain.setValueAtTime(0.4, t)
  bodyEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
  body.connect(bodyEnv).connect(out)
  body.start(t)
  body.stop(t + 0.12)
}

/** Closed hi-hat: very short high-passed noise. */
export function playHat(
  ctx: BaseAudioContext,
  out: AudioNode,
  t: number,
  noise: AudioBuffer,
): void {
  const src = ctx.createBufferSource()
  src.buffer = noise
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 7000
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.25, t)
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
  src.connect(hp).connect(env).connect(out)
  src.start(t)
  src.stop(t + 0.06)
}

/** Bass: triangle + square through a 900 Hz low-pass. */
export function playBass(
  ctx: BaseAudioContext,
  out: AudioNode,
  t: number,
  freq: number,
  duration: number,
): void {
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 900
  const env = ctx.createGain()
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(0.5, t + 0.01)
  env.gain.setValueAtTime(0.5, t + Math.max(0.01, duration - 0.03))
  env.gain.linearRampToValueAtTime(0, t + duration)
  lp.connect(env).connect(out)
  for (const [type, level] of [
    ['triangle', 0.7],
    ['square', 0.3],
  ] as const) {
    const osc = ctx.createOscillator()
    const mix = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    mix.gain.value = level
    osc.connect(mix).connect(lp)
    osc.start(t)
    osc.stop(t + duration + 0.02)
  }
}

/** Chord stab: three slightly detuned saws per note through a 1.8 kHz low-pass. */
export function playChord(
  ctx: BaseAudioContext,
  out: AudioNode,
  t: number,
  freqs: readonly number[],
  duration: number,
): void {
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1800
  const env = ctx.createGain()
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(0.3, t + 0.005)
  env.gain.exponentialRampToValueAtTime(0.001, t + duration)
  lp.connect(env).connect(out)
  const level = 1 / (3 * freqs.length)
  for (const freq of freqs) {
    for (const detune of [-7, 0, 7]) {
      const osc = ctx.createOscillator()
      const mix = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.value = freq
      osc.detune.value = detune
      mix.gain.value = level
      osc.connect(mix).connect(lp)
      osc.start(t)
      osc.stop(t + duration + 0.02)
    }
  }
}
