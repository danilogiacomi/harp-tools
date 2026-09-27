import { useEffect, useMemo, useState } from 'react'
import {
  MAX_PHRASE,
  MELODY_NOTE_LIMIT_MS,
  MIN_PHRASE,
  MelodyRound,
  generatePhrase,
  melodyPoints,
  nextPhraseLength,
  type MelodyState,
} from '../../../core/games/melodyEcho'
import {
  DEFAULT_POOL_FILTER,
  buildPool,
  poolLabel,
  uniqueMidis,
  type PoolFilter,
} from '../../../core/games/notePool'
import type { Rng } from '../../../core/games/random'
import { isFinished, type GameMode } from '../../../core/games/session'
import { findNotes, noteId, tabLabel } from '../../../core/harmonica/harp'
import { pickNote } from '../../../core/harmonica/positions'
import { noteName } from '../../../core/music/noteNames'
import { HarmonicaDiagram, type Highlight } from '../../components/HarmonicaDiagram'
import { MicErrorNotice } from '../../components/MicErrorNotice'
import { GameLayout } from '../../components/game/GameLayout'
import { ModeToggle } from '../../components/game/ModeToggle'
import { PoolFilterPanel } from '../../components/game/PoolFilterPanel'
import { PlayAgain, ScorePanel } from '../../components/game/ScorePanel'
import { Stage } from '../../components/game/Stage'
import styles from '../../components/game/Game.module.css'
import { useGameAudio, type GameAudio, type HeardListener } from '../../hooks/useGameAudio'
import { useHarp, useSpelling } from '../../hooks/useHarp'
import { usePracticeTimer } from '../../hooks/usePracticeTimer'
import { useScoring } from '../../hooks/useScoring'
import { useSlot } from '../../hooks/useSlot'
import { useTimeouts } from '../../hooks/useTimeouts'
import { bestScoreKey, tuningPart } from '../../scores/bestScores'
import { useSettings } from '../../settings/SettingsContext'

const ADVANCE_MS = 1500
const NOTE_MS = 600
const GAP_MS = 150
const LENGTHS = Array.from({ length: MAX_PHRASE - MIN_PHRASE + 1 }, (_, i) => MIN_PHRASE + i)

export function MelodyEchoPage() {
  usePracticeTimer('melody')
  return (
    <GameLayout
      title="Melody echo"
      intro="Listen to a short phrase, then play it back note by note."
      melodyHold
    >
      <MelodyGame />
    </GameLayout>
  )
}

export function MelodyGame({ rng = Math.random }: { rng?: Rng }) {
  const { settings } = useSettings()
  // Owned here, not by the keyed run, so a settings change doesn't restart the mic.
  const audio = useGameAudio(true)
  const [mode, setMode] = useState<GameMode>('practice')
  const [filter, setFilter] = useState<PoolFilter>(DEFAULT_POOL_FILTER)
  const [practiceLength, setPracticeLength] = useState(3)
  const runKey = [
    mode,
    mode === 'practice' ? practiceLength : 'grow',
    poolLabel(filter),
    settings.key,
    settings.tuning,
    settings.a4,
    settings.showAdvanced,
    settings.toleranceCents,
    settings.melodyHoldMs,
  ].join('|')
  return (
    <>
      <div className={styles.toolbar}>
        <ModeToggle mode={mode} onChange={setMode} />
        {mode === 'practice' && (
          <label className={styles.field}>
            Phrase length
            <select
              aria-label="Phrase length"
              value={practiceLength}
              onChange={(e) => setPracticeLength(Number(e.target.value))}
            >
              {LENGTHS.map((n) => (
                <option key={n} value={n}>
                  {n} notes
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <PoolFilterPanel filter={filter} onChange={setFilter} />
      <MelodyRun
        key={runKey}
        audio={audio}
        mode={mode}
        filter={filter}
        practiceLength={practiceLength}
        rng={rng}
      />
    </>
  )
}

interface View {
  phase: 'idle' | 'prompt' | 'listening' | 'result'
  phrase: number[]
  state: MelodyState | null
  points: number
  /** Practice help: the phrase slots show which hole to play. */
  showHoles: boolean
}

const IDLE: View = { phase: 'idle', phrase: [], state: null, points: 0, showHoles: false }

interface RunProps {
  audio: GameAudio
  mode: GameMode
  filter: PoolFilter
  practiceLength: number
  rng: Rng
}

function MelodyRun({ audio, mode, filter, practiceLength, rng }: RunProps) {
  const { settings } = useSettings()
  const harp = useHarp()
  const midis = useMemo(
    () => uniqueMidis(buildPool(harp, filter, settings.showAdvanced)),
    [harp, filter, settings.showAdvanced],
  )
  const spelling = useSpelling()
  const scoring = useScoring(
    mode,
    bestScoreKey('melody', {
      key: settings.key,
      pool: poolLabel(filter),
      adv: settings.showAdvanced,
      tol: settings.toleranceCents,
      hold: settings.melodyHoldMs,
      ...tuningPart(settings.tuning),
    }),
  )
  const slot = useSlot<MelodyRound>()
  const timeouts = useTimeouts()
  const [length, setLength] = useState(mode === 'scored' ? MIN_PHRASE : practiceLength)
  const [view, setView] = useState<View>(IDLE)

  const playPhrase = async (phrase: number[], showHoles = false) => {
    timeouts.clear()
    slot.set(null)
    setView({ ...IDLE, phase: 'prompt', phrase, showHoles })
    if (!(await audio.playSequence(phrase, NOTE_MS, GAP_MS))) return
    const matcher = { toleranceCents: settings.toleranceCents, holdMs: settings.melodyHoldMs }
    const limitMs = mode === 'scored' ? MELODY_NOTE_LIMIT_MS * phrase.length : null
    slot.set(new MelodyRound(phrase, { matcher, a4: settings.a4 }, audio.now(), limitMs))
    setView((v) => ({ ...v, phase: 'listening' }))
  }
  const newPhrase = (len: number) => void playPhrase(generatePhrase(midis, len, rng))

  const onHeard: HeardListener = (freq, timeMs) => {
    const round = slot.get()
    if (!round) return
    const state = round.push(freq, timeMs)
    if (state.status === 'listening') {
      setView((v) => ({ ...v, state }))
      return
    }
    slot.set(null)
    const phraseLength = view.phrase.length
    const success = state.status === 'success'
    const points = melodyPoints(state, phraseLength)
    const session = scoring.record({ correct: success, points })
    setView((v) => ({ ...v, phase: 'result', state, points }))
    if (mode === 'scored') {
      const next = nextPhraseLength(phraseLength, success)
      setLength(next)
      if (!isFinished(session)) timeouts.after(ADVANCE_MS, () => newPhrase(next))
    } else if (success) {
      timeouts.after(ADVANCE_MS, () => newPhrase(length))
    }
  }
  useEffect(() => audio.listen(onHeard))
  // The prompt player outlives this run; a remount must not leave its prompt sounding.
  const { cancelPlayback } = audio
  useEffect(() => cancelPlayback, [cancelPlayback])

  const stop = () => {
    timeouts.clear()
    slot.set(null)
    audio.cancelPlayback()
    setView(IDLE)
  }
  const restart = () => {
    scoring.restart()
    setLength(MIN_PHRASE)
    newPhrase(MIN_PHRASE)
  }

  if (midis.length === 0) {
    return (
      <p role="alert" className="notice">
        No notes match these filters. Choose more holes or techniques.
      </p>
    )
  }

  const { phrase, state } = view
  const reveal = view.phase === 'result'
  const slotState = (i: number) => {
    if (state?.wrongIndex === i) return 'wrong'
    if (i < (state?.index ?? 0)) return 'done'
    if (view.phase === 'listening' && i === (state?.index ?? 0)) return 'current'
    return 'todo'
  }

  const holeFor = (midi: number) =>
    pickNote(harp, midi, { includeOver: true, showAdvanced: settings.showAdvanced })
  const slotLabel = (m: number, i: number) => {
    const hole = view.showHoles ? holeFor(m) : null
    if (hole) return tabLabel(hole)
    return reveal || slotState(i) === 'done' ? noteName(m, spelling) : i + 1
  }

  const highlights = new Map<string, Highlight>()
  if (audio.detectedMidi !== null) {
    for (const n of findNotes(harp, audio.detectedMidi)) highlights.set(noteId(n), 'detected')
  }
  const mark = (midi: number, h: Highlight) =>
    findNotes(harp, midi).forEach((n) => highlights.set(noteId(n), h))
  if (view.showHoles) {
    phrase.slice(state?.index ?? 0).forEach((m) => {
      const hole = holeFor(m)
      if (hole) highlights.set(noteId(hole), 'target')
    })
  }
  phrase.slice(0, state?.index ?? 0).forEach((m) => mark(m, 'correct'))
  if (reveal && state?.wrongIndex != null) {
    mark(phrase[state.wrongIndex], 'target')
    if (state.wrongMidi !== null) mark(state.wrongMidi, 'wrong')
  }

  return (
    <>
      {audio.error && <MicErrorNotice kind={audio.error} />}
      <ScorePanel scoring={scoring} />
      <Stage
        controls={
          <>
            {/* The primary action always comes first. */}
            {isFinished(scoring.session) && <PlayAgain onClick={restart} />}
            {view.phase === 'idle' &&
              !audio.error &&
              (audio.status === 'listening' ? (
                <button type="button" className={styles.primary} onClick={() => newPhrase(length)}>
                  ▶ Start
                </button>
              ) : (
                <p className={styles.hint}>Waiting for microphone…</p>
              ))}
            {view.phase === 'listening' && (
              <button
                type="button"
                onClick={() => void audio.playSequence(phrase, NOTE_MS, GAP_MS)}
              >
                🔊 Hear again
              </button>
            )}
            {/* Revealing the holes would give the answer away in scored mode. */}
            {view.phase === 'listening' && mode === 'practice' && !view.showHoles && (
              <button type="button" onClick={() => setView((v) => ({ ...v, showHoles: true }))}>
                👀 Show holes
              </button>
            )}
            {mode === 'practice' && reveal && state?.status !== 'success' && (
              <>
                <button type="button" onClick={() => void playPhrase(phrase, view.showHoles)}>
                  🔁 Try again
                </button>
                <button type="button" onClick={() => newPhrase(length)}>
                  ▶ New phrase
                </button>
              </>
            )}
            {view.phase !== 'idle' && !isFinished(scoring.session) && (
              <button type="button" onClick={stop}>
                ■ Stop
              </button>
            )}
          </>
        }
        headline={
          reveal && state ? (
            <>
              {state.status === 'success' && '✓ Well done!'}
              {state.status === 'wrong' &&
                state.wrongIndex !== null &&
                state.wrongMidi !== null &&
                `✗ Note ${state.wrongIndex + 1}: you played ${noteName(state.wrongMidi, spelling)}, it was ${noteName(phrase[state.wrongIndex], spelling)}`}
              {state.status === 'timeout' && "✗ Time's up"}
              {mode === 'scored' && ` · +${view.points}`}
            </>
          ) : view.phase === 'prompt' ? (
            'Listen…'
          ) : (
            view.phase === 'listening' && 'Your turn — play it back'
          )
        }
        result={reveal && state ? (state.status === 'success' ? 'ok' : 'bad') : undefined}
        progress={view.phase === 'listening' ? (state?.progress ?? 0) : undefined}
        detail={mode === 'scored' && !isFinished(scoring.session) && `Phrase length: ${length}`}
      />
      {/* Always rendered: before the first phrase, numbered slots show how long it will be. */}
      <ol className={styles.slots} aria-label="Phrase">
        {phrase.length > 0
          ? phrase.map((m, i) => (
              <li key={i} className={styles.slot} data-state={slotState(i)}>
                {slotLabel(m, i)}
              </li>
            ))
          : Array.from({ length }, (_, i) => (
              <li key={i} className={styles.slot} data-state="todo">
                {i + 1}
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
    </>
  )
}
