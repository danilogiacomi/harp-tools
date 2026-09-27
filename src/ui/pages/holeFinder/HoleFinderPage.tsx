import { useEffect, useMemo, useState } from 'react'
import { ECHO_LIMIT_MS, echoPoints, pickTarget } from '../../../core/games/echoNote'
import { holeFinderRoundConfig } from '../../../core/games/holeFinder'
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

export function HoleFinderPage() {
  usePracticeTimer('hole-finder')
  return (
    <GameLayout
      title="Hole finder"
      intro="A note name appears: find it on your harp and play it. The site stays silent — it's all you."
    >
      <HoleFinderGame />
    </GameLayout>
  )
}

export function HoleFinderGame({ rng = Math.random }: { rng?: Rng }) {
  const { settings } = useSettings()
  // Owned here, not by the keyed run, so a settings change doesn't restart the mic.
  const audio = useGameAudio(true)
  const [mode, setMode] = useState<GameMode>('practice')
  const [filter, setFilter] = useState<PoolFilter>(DEFAULT_POOL_FILTER)
  // Any change here remounts the run: timers stop and the score resets.
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
      <HoleFinderRun key={runKey} audio={audio} mode={mode} filter={filter} rng={rng} />
    </>
  )
}

interface View {
  phase: 'idle' | 'listening' | 'result'
  target: number | null
  round: ListenRoundState | null
  revealed: boolean
  points: number
}

const IDLE: View = { phase: 'idle', target: null, round: null, revealed: false, points: 0 }

interface RunProps {
  audio: GameAudio
  mode: GameMode
  filter: PoolFilter
  rng: Rng
}

function HoleFinderRun({ audio, mode, filter, rng }: RunProps) {
  const { settings } = useSettings()
  const harp = useHarp()
  const midis = useMemo(
    () => uniqueMidis(buildPool(harp, filter, settings.showAdvanced)),
    [harp, filter, settings.showAdvanced],
  )
  const spelling = useSpelling()
  const scoring = useScoring(
    mode,
    bestScoreKey('hole-finder', {
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

  // Nothing to play first: a round starts listening straight away.
  const startRound = (previous: number | null) => {
    timeouts.clear()
    const target = pickTarget(midis, rng, previous)
    const matcher = { toleranceCents: settings.toleranceCents, holdMs: settings.holdMs }
    slot.set(
      new ListenRound(target, holeFinderRoundConfig(mode, matcher, settings.a4), audio.now()),
    )
    setView({ ...IDLE, phase: 'listening', target })
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
    setView((v) => ({ ...v, phase: 'result', round: state, revealed: true, points }))
    if (!isFinished(session)) timeouts.after(ADVANCE_MS, () => startRound(round.target))
  }
  useEffect(() => audio.listen(onHeard))

  const skip = () => {
    const round = slot.get()
    if (round) startRound(round.target)
  }
  const stop = () => {
    timeouts.clear()
    slot.set(null)
    setView(IDLE)
  }
  const restart = () => {
    scoring.restart()
    startRound(null)
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

  const target = view.target
  const hit = view.round?.status === 'hit'
  const highlights = new Map<string, Highlight>()
  if (audio.detectedMidi !== null) {
    for (const n of findNotes(harp, audio.detectedMidi)) highlights.set(noteId(n), 'detected')
  }
  if (target !== null && view.revealed) {
    for (const n of findNotes(harp, target)) {
      highlights.set(noteId(n), view.phase === 'result' && hit ? 'correct' : 'target')
    }
  }
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
                <button type="button" className={styles.primary} onClick={() => startRound(null)}>
                  ▶ Start
                </button>
              ) : (
                <p className={styles.hint}>Waiting for microphone…</p>
              ))}
            {/* Help would give the answer away in scored mode. */}
            {view.phase === 'listening' && mode === 'practice' && !view.revealed && (
              <button type="button" onClick={() => setView((v) => ({ ...v, revealed: true }))}>
                👀 Show me
              </button>
            )}
            {view.phase === 'listening' && mode === 'practice' && (
              <button type="button" onClick={skip}>
                Skip
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
          view.phase === 'result' && target !== null ? (
            <>
              {hit ? `✓ ${labelOf(target)}` : `✗ Time's up — it was ${labelOf(target)}`}
              {mode === 'scored' && hit && ` · +${view.points}`}
            </>
          ) : view.phase === 'listening' && target !== null ? (
            <span className={styles.bigNote} data-testid="target-note">
              {noteName(target, spelling)}
            </span>
          ) : null
        }
        result={view.phase === 'result' && target !== null ? (hit ? 'ok' : 'bad') : undefined}
        progress={view.phase === 'listening' ? (view.round?.progress ?? 0) : undefined}
        detail={
          <>
            {view.phase === 'listening' && mode === 'scored' && `${secondsLeft} s left`}
            {view.phase === 'listening' &&
              mode === 'practice' &&
              !view.revealed &&
              'Play it on any hole that has it, and hold it.'}
            {view.revealed &&
              target !== null &&
              `${noteName(target, spelling)}: ${visible(target).map(describeNote).join(' or ')}`}
          </>
        }
      />
      {/* Tab labels only: note names on the chart, visible or announced, would give the answer
          away (decision 6). */}
      <HarmonicaDiagram
        harp={harp}
        spelling={spelling}
        labelMode="tab"
        showAdvanced={settings.showAdvanced}
        highlights={highlights}
        concealNotes
      />
    </>
  )
}
