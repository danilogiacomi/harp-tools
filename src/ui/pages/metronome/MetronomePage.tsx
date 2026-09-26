import { useEffect, useMemo, useState } from 'react'
import {
  TIME_SIGNATURES,
  accentKind,
  type Subdivision,
  type TimeSignature,
} from '../../../core/rhythm/schedule'
import { BPM_MAX, BPM_MIN, TapTempo, clampBpm } from '../../../core/rhythm/tempo'
import { AudioGate } from '../../components/AudioGate'
import { useMetronome } from '../../hooks/useMetronome'
import { useSettings } from '../../settings/SettingsContext'
import styles from './MetronomePage.module.css'

const SUBDIVISIONS: { value: Subdivision; label: string }[] = [
  { value: 1, label: 'Off' },
  { value: 2, label: '2 per beat' },
  { value: 3, label: '3 per beat (triplets)' },
  { value: 4, label: '4 per beat' },
]

export function MetronomePage() {
  return (
    <>
      <h1>Metronome</h1>
      <AudioGate>
        <MetronomePanel />
      </AudioGate>
    </>
  )
}

export function MetronomePanel() {
  const { settings, update } = useSettings()
  const [signature, setSignature] = useState<TimeSignature>(TIME_SIGNATURES[2])
  const [subdivision, setSubdivision] = useState<Subdivision>(1)
  const [tapper] = useState(() => new TapTempo())

  const config = useMemo(
    () => ({ bpm: settings.bpm, signature, subdivision }),
    [settings.bpm, signature, subdivision],
  )
  const { running, beat, toggle } = useMetronome(config)
  const setBpm = (bpm: number) => update({ bpm: clampBpm(bpm) })

  // Space toggles, unless a control has focus (buttons already treat Space as a click).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      if (e.target instanceof HTMLElement && e.target.closest('input, select, textarea, button'))
        return
      e.preventDefault()
      if (!e.repeat) toggle() // holding Space must not flip it on and off
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  return (
    <div className={styles.panel}>
      <div className={styles.tempo}>
        <button type="button" aria-label="Slower" onClick={() => setBpm(settings.bpm - 1)}>
          −
        </button>
        <output className={styles.bpm} aria-label="BPM">
          {settings.bpm}
        </output>
        <button type="button" aria-label="Faster" onClick={() => setBpm(settings.bpm + 1)}>
          +
        </button>
      </div>
      <input
        className={styles.slider}
        type="range"
        aria-label="Tempo"
        min={BPM_MIN}
        max={BPM_MAX}
        value={settings.bpm}
        onChange={(e) => setBpm(Number(e.target.value))}
      />

      <div className={styles.beats} aria-hidden>
        {Array.from({ length: signature.beats }, (_, i) => (
          <span
            key={i}
            className={styles.dot}
            data-testid="beat-dot"
            data-accent={accentKind(i, signature)}
            data-active={beat === i || undefined}
          />
        ))}
      </div>

      <div className={styles.controls}>
        <label>
          Time signature{' '}
          <select
            aria-label="Time signature"
            value={signature.label}
            onChange={(e) => setSignature(TIME_SIGNATURES.find((s) => s.label === e.target.value)!)}
          >
            {TIME_SIGNATURES.map((s) => (
              <option key={s.label} value={s.label}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Subdivision{' '}
          <select
            value={subdivision}
            onChange={(e) => setSubdivision(Number(e.target.value) as Subdivision)}
          >
            {SUBDIVISIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            const bpm = tapper.tap(performance.now())
            if (bpm !== null) setBpm(bpm)
          }}
        >
          Tap tempo
        </button>
      </div>

      <button type="button" className={styles.startStop} aria-pressed={running} onClick={toggle}>
        {running ? '■ Stop' : '▶ Start'}
      </button>
      <p className={styles.hint}>Press Space to start or stop.</p>
    </div>
  )
}
