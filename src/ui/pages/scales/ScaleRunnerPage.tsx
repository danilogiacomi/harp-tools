import { useEffect, useMemo, useState } from 'react'
import { ScaleRun, runStepPoints } from '../../../core/games/scaleRunner'
import { isFinished, type GameMode } from '../../../core/games/session'
import { buildHarp, findNotes, noteId, tabLabel, type HarpNote } from '../../../core/harmonica/harp'
import { keySpelling } from '../../../core/harmonica/keys'
import {
  POSITIONS,
  easiestOctave,
  positionRootPc,
  runSequence,
  scaleOctaves,
  type Direction,
  type Position,
} from '../../../core/harmonica/positions'
import { noteName } from '../../../core/music/noteNames'
import { SCALES, scaleById, type ScaleId } from '../../../core/music/scales'
import { TIME_SIGNATURES, type MetronomeConfig } from '../../../core/rhythm/schedule'
import { HarmonicaDiagram, type Highlight } from '../../components/HarmonicaDiagram'
import { MicErrorNotice } from '../../components/MicErrorNotice'
import { GameLayout } from '../../components/game/GameLayout'
import { ModeToggle } from '../../components/game/ModeToggle'
import { PlayAgain, ScorePanel } from '../../components/game/ScorePanel'
import { Stage } from '../../components/game/Stage'
import styles from '../../components/game/Game.module.css'
import { useGameAudio, type GameAudio, type HeardListener } from '../../hooks/useGameAudio'
import { useMetronome } from '../../hooks/useMetronome'
import { useScoring } from '../../hooks/useScoring'
import { useSlot } from '../../hooks/useSlot'
import { bestScoreKey } from '../../scores/bestScores'
import { useSettings } from '../../settings/SettingsContext'

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: 'up', label: 'Up' },
  { value: 'down', label: 'Down' },
  { value: 'upDown', label: 'Up & down' },
]
const ORDINAL: Record<Position, string> = { 1: '1st', 2: '2nd', 3: '3rd' }

export function ScaleRunnerPage() {
  return (
    <GameLayout
      title="Scale runner"
      intro="Play the scale one note at a time — the next hole lights up. Bends are used where the scale needs them."
    >
      <ScaleGame />
    </GameLayout>
  )
}

export function ScaleGame() {
  const { settings } = useSettings()
  // Owned here, not by the keyed run, so a settings change doesn't restart the mic.
  const audio = useGameAudio(true)
  const [mode, setMode] = useState<GameMode>('practice')
  const [scaleId, setScaleId] = useState<ScaleId>('major')
  const [position, setPosition] = useState<Position>(1)
  const [direction, setDirection] = useState<Direction>('up')
  const [includeOver, setIncludeOver] = useState(false)
  const [octaveChoice, setOctaveChoice] = useState<number | null>(null)
  const [withMetronome, setWithMetronome] = useState(false)

  const harp = useMemo(() => buildHarp(settings.key), [settings.key])
  const spelling = keySpelling(settings.key)
  const octaves = useMemo(
    () =>
      scaleOctaves(harp, settings.key, scaleById(scaleId), position, {
        includeOver,
        showAdvanced: settings.showAdvanced,
      }),
    [harp, settings.key, scaleId, position, includeOver, settings.showAdvanced],
  )
  const octave =
    octaveChoice !== null && octaveChoice < octaves.length ? octaveChoice : easiestOctave(octaves)
  const path = octaves[octave]
  // noteName of the tonic in octave 4, without the octave digit: 'G4' → 'G'.
  const tonic = (p: Position) =>
    noteName(60 + positionRootPc(settings.key, p), spelling).slice(0, -1)

  // Changing the scale's shape invalidates the octave choice.
  const reshape = (fn: () => void) => {
    fn()
    setOctaveChoice(null)
  }

  const runKey = [
    mode,
    scaleId,
    position,
    direction,
    includeOver,
    octave,
    withMetronome,
    settings.key,
    settings.a4,
    settings.showAdvanced,
    settings.toleranceCents,
    settings.holdMs,
    settings.bpm,
  ].join('|')
  const bestKey = bestScoreKey('scales', {
    key: settings.key,
    scale: scaleId,
    pos: position,
    dir: direction,
    octave,
    over: includeOver,
    adv: settings.showAdvanced,
    bpm: withMetronome ? settings.bpm : 0,
    tol: settings.toleranceCents,
    hold: settings.holdMs,
  })

  return (
    <>
      <div className={styles.toolbar}>
        <ModeToggle mode={mode} onChange={setMode} />
        <label className={styles.field}>
          Scale
          <select
            aria-label="Scale"
            value={scaleId}
            onChange={(e) => reshape(() => setScaleId(e.target.value as ScaleId))}
          >
            {SCALES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Position
          <select
            aria-label="Position"
            value={position}
            onChange={(e) => reshape(() => setPosition(Number(e.target.value) as Position))}
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {ORDINAL[p]} ({tonic(p)})
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Direction
          <select
            aria-label="Direction"
            value={direction}
            onChange={(e) => setDirection(e.target.value as Direction)}
          >
            {DIRECTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        {octaves.length > 0 && (
          <label className={styles.field}>
            Octave
            <select
              aria-label="Octave"
              value={octave}
              onChange={(e) => setOctaveChoice(Number(e.target.value))}
            >
              {octaves.map((o, i) => (
                <option key={i} value={i}>
                  {tabLabel(o[0])} → {tabLabel(o[o.length - 1])}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className={styles.toolbar}>
        <label className={styles.field}>
          <input
            type="checkbox"
            checked={includeOver}
            onChange={(e) => reshape(() => setIncludeOver(e.target.checked))}
          />
          Include overblows/overdraws
        </label>
        <label className={styles.field}>
          <input
            type="checkbox"
            checked={withMetronome}
            onChange={(e) => setWithMetronome(e.target.checked)}
          />
          Play with metronome ({settings.bpm} BPM)
        </label>
      </div>
      {path ? (
        <ScaleSession
          key={runKey}
          audio={audio}
          mode={mode}
          harp={harp}
          path={path}
          direction={direction}
          withMetronome={withMetronome}
          bestKey={bestKey}
        />
      ) : (
        <p role="alert" className="notice">
          No full octave of this scale is playable in this position with these techniques. Try
          “Include overblows/overdraws”.
        </p>
      )}
    </>
  )
}

interface SessionProps {
  audio: GameAudio
  mode: GameMode
  harp: HarpNote[]
  path: HarpNote[]
  direction: Direction
  withMetronome: boolean
  bestKey: string
}

interface View {
  phase: 'idle' | 'running' | 'done'
  index: number
  progress: number
  lastPoints: number | null
}

const IDLE: View = { phase: 'idle', index: 0, progress: 0, lastPoints: null }

function ScaleSession({
  audio,
  mode,
  harp,
  path,
  direction,
  withMetronome,
  bestKey,
}: SessionProps) {
  const { settings } = useSettings()
  const spelling = keySpelling(settings.key)
  const sequence = useMemo(() => runSequence(path, direction), [path, direction])
  const scoring = useScoring(mode, bestKey, sequence.length)
  const slot = useSlot<ScaleRun>()
  const metronomeConfig = useMemo<MetronomeConfig>(
    () => ({ bpm: settings.bpm, signature: TIME_SIGNATURES[2], subdivision: 1 }),
    [settings.bpm],
  )
  const metronome = useMetronome(metronomeConfig)
  const [view, setView] = useState<View>(IDLE)

  // One run is one scored session: a stopped run starts over rather than resuming.
  const start = () => {
    if (mode === 'scored') scoring.restart()
    const matcher = { toleranceCents: settings.toleranceCents, holdMs: settings.holdMs }
    slot.set(
      new ScaleRun(
        sequence.map((n) => n.midi),
        { matcher, a4: settings.a4 },
        audio.now(),
      ),
    )
    setView({ ...IDLE, phase: 'running' })
    if (withMetronome && !metronome.running) metronome.toggle()
  }

  const finish = (phase: View['phase']) => {
    slot.set(null)
    if (metronome.running) metronome.toggle()
    setView((v) => ({ ...v, phase }))
  }

  const onHeard: HeardListener = (freq, timeMs) => {
    const run = slot.get()
    if (!run) return
    const state = run.push(freq, timeMs)
    let lastPoints: number | null = null
    if (state.completed) {
      const beat =
        withMetronome && metronome.lastBeatMs !== null
          ? { bpm: settings.bpm, lastBeatMs: metronome.lastBeatMs }
          : null
      lastPoints = runStepPoints(state.completed, beat)
      scoring.record({ correct: true, points: lastPoints })
    }
    setView((v) => ({
      ...v,
      index: state.index,
      progress: state.progress,
      lastPoints: lastPoints ?? v.lastPoints,
    }))
    if (state.done) finish('done')
  }
  useEffect(() => audio.listen(onHeard))

  const highlights = new Map<string, Highlight>()
  if (audio.detectedMidi !== null) {
    for (const n of findNotes(harp, audio.detectedMidi)) highlights.set(noteId(n), 'detected')
  }
  if (view.phase !== 'idle') {
    sequence.slice(0, view.index).forEach((n) => highlights.set(noteId(n), 'correct'))
  }
  const next = view.phase === 'running' ? sequence[view.index] : undefined
  if (next) highlights.set(noteId(next), 'target')

  return (
    <>
      {audio.error && <MicErrorNotice kind={audio.error} />}
      <ScorePanel scoring={scoring} />
      <Stage
        controls={
          <>
            {/* The primary action always comes first. */}
            {isFinished(scoring.session) && <PlayAgain onClick={start} />}
            {view.phase === 'idle' &&
              !audio.error &&
              (audio.status === 'listening' ? (
                <button type="button" className={styles.primary} onClick={start}>
                  ▶ Start
                </button>
              ) : (
                <p className={styles.hint}>Waiting for microphone…</p>
              ))}
            {next && (
              <button type="button" onClick={() => finish('idle')}>
                ■ Stop
              </button>
            )}
            {view.phase === 'done' && mode === 'practice' && (
              <button type="button" className={styles.primary} onClick={start}>
                ▶ Again
              </button>
            )}
          </>
        }
        headline={
          next
            ? `Next: ${tabLabel(next)} (${noteName(next.midi, spelling)})`
            : view.phase === 'done' && mode === 'practice' && '✓ Run complete!'
        }
        result={view.phase === 'done' && mode === 'practice' ? 'ok' : undefined}
        progress={next ? view.progress : undefined}
        detail={
          next && (
            <>
              Note {view.index + 1} of {sequence.length}
              {mode === 'scored' && view.lastPoints !== null && ` · last +${view.lastPoints}`}
            </>
          )
        }
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
