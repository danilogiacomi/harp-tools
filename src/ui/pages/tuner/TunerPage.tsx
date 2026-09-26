import { useMemo, useState } from 'react'
import { buildHarp, findNotes, noteId, tabLabel, type HarpNote } from '../../../core/harmonica/harp'
import { keySpelling } from '../../../core/harmonica/keys'
import { noteName, type Spelling } from '../../../core/music/noteNames'
import { freqToMidi } from '../../../core/music/pitch'
import { AudioGate } from '../../components/AudioGate'
import { HarmonicaDiagram, type Highlight } from '../../components/HarmonicaDiagram'
import { MicErrorNotice } from '../../components/MicErrorNotice'
import { useNotePlayer } from '../../hooks/useNotePlayer'
import { usePitch } from '../../hooks/usePitch'
import { A4_RANGE } from '../../settings/settings'
import { useSettings } from '../../settings/SettingsContext'
import { LevelMeter } from './LevelMeter'
import { TunerReadout } from './TunerReadout'
import styles from './TunerPage.module.css'

type Mode = 'listen' | 'play'

interface ModeProps {
  harp: HarpNote[]
  spelling: Spelling
}

export function TunerPage() {
  return (
    <>
      <h1>Tuner</h1>
      <AudioGate>
        <Tuner />
      </AudioGate>
    </>
  )
}

function Tuner() {
  const { settings, update } = useSettings()
  const harp = useMemo(() => buildHarp(settings.key), [settings.key])
  const spelling = keySpelling(settings.key)
  const [mode, setMode] = useState<Mode>('listen')

  return (
    <>
      <div className={styles.toolbar}>
        <div role="group" aria-label="Mode" className={styles.segmented}>
          <button type="button" aria-pressed={mode === 'listen'} onClick={() => setMode('listen')}>
            🎤 Listen
          </button>
          <button type="button" aria-pressed={mode === 'play'} onClick={() => setMode('play')}>
            🔊 Play
          </button>
        </div>
        <label className={styles.field}>
          A4
          <input
            type="range"
            min={A4_RANGE[0]}
            max={A4_RANGE[1]}
            step={1}
            value={settings.a4}
            onChange={(e) => update({ a4: Number(e.target.value) })}
          />
          <span>{settings.a4} Hz</span>
        </label>
        <label className={styles.field}>
          <input
            type="checkbox"
            checked={settings.showAdvanced}
            onChange={(e) => update({ showAdvanced: e.target.checked })}
          />
          Advanced over-notes
        </label>
        <button
          type="button"
          aria-pressed={settings.labelMode === 'tab'}
          onClick={() => update({ labelMode: settings.labelMode === 'tab' ? 'note' : 'tab' })}
        >
          Tab labels
        </button>
      </div>
      {mode === 'listen' ? (
        <ListenMode harp={harp} spelling={spelling} />
      ) : (
        <PlayMode harp={harp} spelling={spelling} />
      )}
    </>
  )
}

function ListenMode({ harp, spelling }: ModeProps) {
  const { settings, update } = useSettings()
  const { reading, rms, status, error } = usePitch(true)

  const detected = reading ? freqToMidi(reading.freq, settings.a4) : null
  const matches = detected ? findNotes(harp, detected.midi) : []
  const highlights = new Map<string, Highlight>(matches.map((n) => [noteId(n), 'detected']))

  return (
    <>
      {error && <MicErrorNotice kind={error} />}
      {status === 'starting' && <p className={styles.hint}>Waiting for microphone permission…</p>}
      <TunerReadout
        reading={
          reading && detected
            ? {
                noteLabel: noteName(detected.midi, spelling),
                cents: detected.cents,
                freq: reading.freq,
                tabs: matches.map(tabLabel),
                onHarp: matches.length > 0,
              }
            : null
        }
      />
      <LevelMeter
        rms={rms}
        noiseFloor={settings.noiseFloor}
        onNoiseFloorChange={(noiseFloor) => update({ noiseFloor })}
      />
      <HarmonicaDiagram
        harp={harp}
        spelling={spelling}
        labelMode={settings.labelMode}
        showAdvanced={settings.showAdvanced}
        highlights={highlights}
      />
    </>
  )
}

function PlayMode({ harp, spelling }: ModeProps) {
  const { settings } = useSettings()
  const player = useNotePlayer()
  const [sustain, setSustain] = useState(false)
  const [playing, setPlaying] = useState<HarpNote | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const byPitch = harp
    .filter((n) => settings.showAdvanced || n.common)
    .sort((a, b) => a.midi - b.midi || a.hole - b.hole)
  const selected = byPitch.find((n) => noteId(n) === selectedId) ?? byPitch[0]

  const startNote = (note: HarpNote) => {
    player.start(note.midi)
    setPlaying(note)
  }
  const stopNote = () => {
    player.stop()
    setPlaying(null)
  }
  const press = (note: HarpNote) => {
    if (sustain && playing && noteId(playing) === noteId(note)) stopNote()
    else startNote(note)
  }
  const release = () => {
    if (!sustain) stopNote()
  }

  const highlights = new Map<string, Highlight>(playing ? [[noteId(playing), 'target']] : [])

  return (
    <>
      <div className={styles.toolbar}>
        <label className={styles.field}>
          <input
            type="checkbox"
            checked={sustain}
            onChange={(e) => {
              setSustain(e.target.checked)
              stopNote()
            }}
          />
          Sustain
        </label>
        <label className={styles.field}>
          Note
          <select value={noteId(selected)} onChange={(e) => setSelectedId(e.target.value)}>
            {byPitch.map((n) => (
              <option key={noteId(n)} value={noteId(n)}>
                {noteName(n.midi, spelling)} — {tabLabel(n)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => (playing ? stopNote() : startNote(selected))}>
          {playing ? '■ Stop' : '▶ Play'}
        </button>
      </div>
      <p className={styles.hint}>
        {sustain ? 'Click a hole to start or stop its note.' : 'Press and hold a hole to hear it.'}
      </p>
      <HarmonicaDiagram
        harp={harp}
        spelling={spelling}
        labelMode={settings.labelMode}
        showAdvanced={settings.showAdvanced}
        highlights={highlights}
        onNoteDown={press}
        onNoteUp={release}
      />
    </>
  )
}
