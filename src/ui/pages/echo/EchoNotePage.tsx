import { useEffect, useMemo, useState } from 'react'
import {
  ECHO_LIMIT_MS,
  echoPoints,
  echoRoundConfig,
  pickTarget,
} from '../../../core/games/echoNote'
import { ListenRound, type ListenRoundState } from '../../../core/games/listenRound'
import {
  DEFAULT_POOL_FILTER,
  buildPool,
  poolLabel,
  uniqueMidis,
  type PoolFilter,
} from '../../../core/games/notePool'
import type { Rng } from '../../../core/games/random'
import { isFinished, type GameMode } from '../../../core/games/session'
import { describeNote, findNotes, noteId, tabLabel } from '../../../core/harmonica/harp'
import { keySpelling } from '../../../core/harmonica/keys'
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
import { useHarp } from '../../hooks/useHarp'
import { useScoring } from '../../hooks/useScoring'
import { useSlot } from '../../hooks/useSlot'
import { useTimeouts } from '../../hooks/useTimeouts'
import { bestScoreKey, tuningPart } from '../../scores/bestScores'
import { useSettings } from '../../settings/SettingsContext'

const ADVANCE_MS = 1500

export function EchoNotePage() {
  return (
    <GameLayout
      title="Echo the note"
      intro="Listen to a note, then play it back on your harp and hold it."
    >
      <EchoGame />
    </GameLayout>
  )
}

export function EchoGame({ rng = Math.random }: { rng?: Rng }) {
  const { settings } = useSettings()
  // Owned here, not by the keyed run, so a settings change doesn't restart the mic.
  const audio = useGameAudio(true)
  const [mode, setMode] = useState<GameMode>('practice')
  const [filter, setFilter] = useState<PoolFilter>(DEFAULT_POOL_FILTER)
  // Any change here remounts the run: timers stop, the prompt is cancelled, the score resets.
  const runKey = [
    mode,
    poolLabel(filter),
    settings.key,
    settings.tuning,
    settings.a4,
    settings.showAdvanced,
    settings.toleranceCents,
    settings.holdMs,
  ].join('|')
  return (
    <>
      <div className={styles.toolbar}>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>
      <PoolFilterPanel filter={filter} onChange={setFilter} />
      <EchoRun key={runKey} audio={audio} mode={mode} filter={filter} rng={rng} />
    </>
  )
}

type Phase = 'idle' | 'prompt' | 'listening' | 'result'

interface View {
  phase: Phase
  target: number | null
  round: ListenRoundState | null
  showTarget: boolean
  points: number
}

const IDLE: View = { phase: 'idle', target: null, round: null, showTarget: false, points: 0 }

interface RunProps {
  audio: GameAudio
  mode: GameMode
  filter: PoolFilter
  rng: Rng
}

function EchoRun({ audio, mode, filter, rng }: RunProps) {
  const { settings } = useSettings()
  const harp = useHarp()
  const midis = useMemo(
    () => uniqueMidis(buildPool(harp, filter, settings.showAdvanced)),
    [harp, filter, settings.showAdvanced],
  )
  const spelling = keySpelling(settings.key)
  const scoring = useScoring(
    mode,
    bestScoreKey('echo', {
      key: settings.key,
      pool: poolLabel(filter),
      adv: settings.showAdvanced,
      tol: settings.toleranceCents,
      hold: settings.holdMs,
      ...tuningPart(settings.tuning),
    }),
  )
  const slot = useSlot<ListenRound>()
  const timeouts = useTimeouts()
  const [view, setView] = useState<View>(IDLE)

  const startRound = async (previous: number | null) => {
    timeouts.clear()
    slot.set(null)
    const target = pickTarget(midis, rng, previous)
    setView({ ...IDLE, phase: 'prompt', target })
    if (!(await audio.playSequence([target]))) return
    const matcher = { toleranceCents: settings.toleranceCents, holdMs: settings.holdMs }
    slot.set(new ListenRound(target, echoRoundConfig(mode, matcher, settings.a4), audio.now()))
    setView((v) => ({ ...v, phase: 'listening' }))
  }

  const onHeard: HeardListener = (freq, timeMs) => {
    const round = slot.get()
    if (!round) return
    const state = round.push(freq, timeMs)
    if (state.status === 'listening') {
      setView((v) => ({ ...v, round: state }))
      return
    }
    slot.set(null)
    const points = echoPoints(state)
    const session = scoring.record({ correct: state.status === 'hit', points })
    setView((v) => ({ ...v, phase: 'result', round: state, showTarget: true, points }))
    if (!isFinished(session)) timeouts.after(ADVANCE_MS, () => void startRound(round.target))
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
    void startRound(null)
  }

  if (midis.length === 0) {
    return (
      <p role="alert" className="notice">
        No notes match these filters. Choose more holes or techniques.
      </p>
    )
  }

  const visible = (midi: number) =>
    findNotes(harp, midi).filter((n) => settings.showAdvanced || n.common)
  const labelOf = (midi: number) =>
    `${noteName(midi, spelling)} (${visible(midi).map(tabLabel).join(' or ')})`

  const highlights = new Map<string, Highlight>()
  if (audio.detectedMidi !== null) {
    for (const n of findNotes(harp, audio.detectedMidi)) highlights.set(noteId(n), 'detected')
  }
  if (view.target !== null && view.showTarget) {
    const hit = view.phase === 'result' && view.round?.status === 'hit'
    for (const n of findNotes(harp, view.target))
      highlights.set(noteId(n), hit ? 'correct' : 'target')
  }

  const hit = view.round?.status === 'hit'
  const secondsLeft = Math.max(0, Math.ceil((ECHO_LIMIT_MS - (view.round?.elapsedMs ?? 0)) / 1000))

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
                <button
                  type="button"
                  className={styles.primary}
                  onClick={() => void startRound(null)}
                >
                  ▶ Start
                </button>
              ) : (
                <p className={styles.hint}>Waiting for microphone…</p>
              ))}
            {view.phase === 'listening' && (
              <button
                type="button"
                onClick={() => view.target !== null && void audio.playSequence([view.target])}
              >
                🔊 Hear again
              </button>
            )}
            {/* Revealing the hole would give the answer away in scored mode. */}
            {view.phase === 'listening' && mode === 'practice' && !view.showTarget && (
              <button type="button" onClick={() => setView((v) => ({ ...v, showTarget: true }))}>
                👀 Show me
              </button>
            )}
            {view.phase !== 'idle' && !isFinished(scoring.session) && (
              <button type="button" onClick={stop}>
                ■ Stop
              </button>
            )}
          </>
        }
        headline={
          view.phase === 'result' && view.target !== null ? (
            <>
              {hit
                ? `✓ Correct — ${labelOf(view.target)}`
                : `✗ Time's up — it was ${labelOf(view.target)}`}
              {mode === 'scored' && hit && ` · +${view.points}`}
            </>
          ) : view.phase === 'prompt' ? (
            'Listen…'
          ) : view.phase === 'listening' ? (
            'Play it back and hold it'
          ) : null
        }
        result={view.phase === 'result' && view.target !== null ? (hit ? 'ok' : 'bad') : undefined}
        progress={view.phase === 'listening' ? (view.round?.progress ?? 0) : undefined}
        detail={
          <>
            {view.phase === 'listening' && mode === 'scored' && `${secondsLeft} s left`}
            {view.phase === 'listening' &&
              view.showTarget &&
              view.target !== null &&
              `${noteName(view.target, spelling)}: ${visible(view.target).map(describeNote).join(' or ')}`}
          </>
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
