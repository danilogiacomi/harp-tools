import { useMemo, useState } from 'react'
import { DEFAULT_MIX, type Mix } from '../../../audio/backing/BackingScheduler'
import type { PitchListener } from '../../../audio/pitch/PitchDetector'
import { findNotes, noteId } from '../../../core/harmonica/harp'
import {
  positionLabel,
  positionTonicPc,
  POSITIONS,
  type Position,
} from '../../../core/harmonica/positions'
import { INSTRUMENTS, type Feel, type Instrument } from '../../../core/jam/backingSchedule'
import { bluesForm, chordName, chordRootPc, jamMarks } from '../../../core/jam/blues'
import { pitchClassName } from '../../../core/music/noteNames'
import { freqToMidi } from '../../../core/music/pitch'
import { AudioGate } from '../../components/AudioGate'
import { HarmonicaDiagram, type Highlight } from '../../components/HarmonicaDiagram'
import { MicFeed } from '../../components/MicFeed'
import gameStyles from '../../components/game/Game.module.css'
import { TempoField } from '../../components/game/TempoField'
import { useBacking } from '../../hooks/useBacking'
import { useHarp, useSpelling } from '../../hooks/useHarp'
import { usePracticeTimer } from '../../hooks/usePracticeTimer'
import { Slot } from '../../hooks/useSlot'
import { useSettings } from '../../settings/SettingsContext'
import styles from './JamPage.module.css'

/** Spec §12: the backing plays between 60 and 160 BPM. */
export const JAM_BPM = [60, 160] as const

const INSTRUMENT_NAMES: Record<Instrument, string> = {
  kick: 'Kick',
  snare: 'Snare',
  hat: 'Hi-hat',
  bass: 'Bass',
  chords: 'Chords',
}

export function JamPage() {
  usePracticeTimer('jam')
  return (
    <>
      <h1>Blues play-along</h1>
      <p className={gameStyles.intro}>
        A 12-bar blues band in your harp's key. The chart lights up the notes that fit each bar.
      </p>
      <AudioGate>
        <Jam />
      </AudioGate>
    </>
  )
}

export function Jam() {
  const { settings } = useSettings()
  const harp = useHarp()
  const spelling = useSpelling()
  const [position, setPosition] = useState<Position>(2)
  const [feel, setFeel] = useState<Feel>('shuffle')
  const [quickChange, setQuickChange] = useState(false)
  const [mix, setMix] = useState<Mix>(DEFAULT_MIX)
  const [showMine, setShowMine] = useState(false)
  const [detected, setDetected] = useState<number | null>(null)
  const [lastMidi] = useState(() => new Slot<number>())

  const bpm = Math.min(JAM_BPM[1], Math.max(JAM_BPM[0], settings.bpm))
  const tonicPc = positionTonicPc(settings.key, position)
  const form = useMemo(() => bluesForm(quickChange), [quickChange])
  const config = useMemo(() => ({ bpm, feel, form, tonicPc }), [bpm, feel, form, tonicPc])
  const backing = useBacking(config, mix)

  const bar = backing.bar ?? 0
  const rootPc = chordRootPc(tonicPc, form[bar])
  const highlights = new Map<string, Highlight>()
  for (const [id, mark] of jamMarks(harp, tonicPc, rootPc)) {
    highlights.set(id, mark === 'chord' ? 'target' : 'hint')
  }
  if (showMine && detected !== null) {
    for (const n of findNotes(harp, detected)) highlights.set(noteId(n), 'detected')
  }

  // Mic frames arrive 60 times a second; the page only re-renders when the note changes.
  const onReading: PitchListener = (reading) => {
    const midi = reading ? freqToMidi(reading.freq, settings.a4).midi : null
    if (midi === lastMidi.get()) return
    lastMidi.set(midi)
    setDetected(midi)
  }
  const setLevel = (i: Instrument, patch: Partial<Mix[Instrument]>) =>
    setMix((m) => ({ ...m, [i]: { ...m[i], ...patch } }))
  const tonicName = (p: Position) => pitchClassName(positionTonicPc(settings.key, p), spelling)

  return (
    <>
      <div className={gameStyles.toolbar}>
        <button type="button" className={gameStyles.primary} onClick={backing.toggle}>
          {backing.running ? '■ Stop' : '▶ Play'}
        </button>
        <label className={gameStyles.field}>
          Position
          <select
            aria-label="Position"
            value={position}
            onChange={(e) => setPosition(Number(e.target.value) as Position)}
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {positionLabel(p)} ({tonicName(p)} blues)
              </option>
            ))}
          </select>
        </label>
        <div role="group" aria-label="Feel" className={gameStyles.segmented}>
          <button
            type="button"
            aria-pressed={feel === 'shuffle'}
            onClick={() => setFeel('shuffle')}
          >
            Shuffle
          </button>
          <button
            type="button"
            aria-pressed={feel === 'straight'}
            onClick={() => setFeel('straight')}
          >
            Straight
          </button>
        </div>
        <label className={gameStyles.field}>
          <input
            type="checkbox"
            checked={quickChange}
            onChange={(e) => setQuickChange(e.target.checked)}
          />
          Quick change
        </label>
        <TempoField min={JAM_BPM[0]} max={JAM_BPM[1]} />
      </div>

      <div className={styles.now}>
        <output className={styles.chord} aria-label="Current chord">
          {chordName(rootPc, spelling)}
        </output>
        <p className={styles.bar}>{backing.running ? `Bar ${bar + 1}/12` : 'Stopped'}</p>
      </div>
      <ol className={styles.form} aria-label="12-bar form">
        {form.map((degree, i) => (
          <li key={i} data-current={backing.running && i === bar ? 'true' : undefined}>
            {chordName(chordRootPc(tonicPc, degree), spelling)}
          </li>
        ))}
      </ol>

      <HarmonicaDiagram
        harp={harp}
        spelling={spelling}
        labelMode={settings.labelMode}
        showAdvanced={settings.showAdvanced}
        highlights={highlights}
      />
      <ul className={styles.legend} aria-label="Chart legend">
        <li>
          <span className={styles.swatch} data-kind="chord" /> Chord tones
        </li>
        <li>
          <span className={styles.swatch} data-kind="scale" /> Blues scale
        </li>
      </ul>

      <fieldset className={styles.mixer}>
        <legend>Mixer</legend>
        {INSTRUMENTS.map((i) => (
          <div key={i} className={gameStyles.field}>
            <label className={gameStyles.field}>
              {INSTRUMENT_NAMES[i]}
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={mix[i].volume}
                onChange={(e) => setLevel(i, { volume: Number(e.target.value) })}
              />
            </label>
            <label className={gameStyles.field}>
              <input
                type="checkbox"
                checked={mix[i].muted}
                onChange={(e) => setLevel(i, { muted: e.target.checked })}
              />
              Mute {INSTRUMENT_NAMES[i].toLowerCase()}
            </label>
          </div>
        ))}
      </fieldset>

      <label className={gameStyles.field}>
        <input type="checkbox" checked={showMine} onChange={(e) => setShowMine(e.target.checked)} />
        Show what I play
      </label>
      {showMine ? (
        <>
          <p className={gameStyles.hint}>
            Use headphones, so the mic hears your harp and not the backing track.
          </p>
          <MicFeed onReading={onReading} />
        </>
      ) : (
        <p className={gameStyles.hint}>The mic is off. Nothing is scored here: just play.</p>
      )}
    </>
  )
}
