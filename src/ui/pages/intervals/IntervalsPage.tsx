import { useEffect, useMemo, useState } from 'react'
import {
  INTERVAL_PLAY_LIMIT_MS,
  answerPoints,
  makeIntervalQuestion,
  playPoints,
  playRoundConfig,
  type IntervalQuestion,
} from '../../../core/games/intervalQuiz'
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
import { findNotes, noteId } from '../../../core/harmonica/harp'
import { INTERVALS, type IntervalId } from '../../../core/music/intervals'
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
const ALL_INTERVALS: readonly IntervalId[] = INTERVALS.map((i) => i.id)

type Task = 'name' | 'play'

const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a')

export function IntervalsPage() {
  usePracticeTimer('intervals')
  return (
    <GameLayout
      title="Interval ear training"
      intro="Two notes, one after the other. Name the interval — or play the second note yourself."
    >
      <IntervalGame />
    </GameLayout>
  )
}

export function IntervalGame({ rng = Math.random }: { rng?: Rng }) {
  const { settings } = useSettings()
  const [mode, setMode] = useState<GameMode>('practice')
  const [task, setTask] = useState<Task>('name')
  // Owned here, not by the keyed run, so a settings change doesn't restart the mic.
  const audio = useGameAudio(task === 'play')
  const [allowed, setAllowed] = useState<readonly IntervalId[]>(ALL_INTERVALS)
  const [filter, setFilter] = useState<PoolFilter>(DEFAULT_POOL_FILTER)

  const toggleInterval = (id: IntervalId) =>
    setAllowed((a) =>
      a.includes(id)
        ? a.filter((x) => x !== id)
        : ALL_INTERVALS.filter((x) => x === id || a.includes(x)),
    )

  const runKey = [
    mode,
    task,
    allowed.join(','),
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
        <div role="group" aria-label="Task" className={styles.segmented}>
          <button type="button" aria-pressed={task === 'name'} onClick={() => setTask('name')}>
            Name it
          </button>
          <button type="button" aria-pressed={task === 'play'} onClick={() => setTask('play')}>
            Play it
          </button>
        </div>
      </div>
      <fieldset className={styles.pool}>
        <legend>Intervals</legend>
        {INTERVALS.map((i) => (
          <label key={i.id} className={styles.field}>
            <input
              type="checkbox"
              checked={allowed.includes(i.id)}
              onChange={() => toggleInterval(i.id)}
            />
            {i.name}
          </label>
        ))}
      </fieldset>
      <PoolFilterPanel filter={filter} onChange={setFilter} />
      <IntervalRun
        key={runKey}
        audio={audio}
        mode={mode}
        task={task}
        allowed={allowed}
        filter={filter}
        rng={rng}
      />
    </>
  )
}

type Phase = 'idle' | 'prompt' | 'answer' | 'listening' | 'result'

interface View {
  phase: Phase
  question: IntervalQuestion | null
  askedAt: number
  round: ListenRoundState | null
  correct: boolean
  points: number
}

const IDLE: View = {
  phase: 'idle',
  question: null,
  askedAt: 0,
  round: null,
  correct: false,
  points: 0,
}

interface RunProps {
  audio: GameAudio
  mode: GameMode
  task: Task
  allowed: readonly IntervalId[]
  filter: PoolFilter
  rng: Rng
}

function IntervalRun({ audio, mode, task, allowed, filter, rng }: RunProps) {
  const { settings } = useSettings()
  const harp = useHarp()
  const midis = useMemo(
    () => uniqueMidis(buildPool(harp, filter, settings.showAdvanced)),
    [harp, filter, settings.showAdvanced],
  )
  const spelling = useSpelling()
  const scoring = useScoring(
    mode,
    bestScoreKey('intervals', {
      key: settings.key,
      task,
      ints: allowed.join(','),
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

  const promptNotes = (q: IntervalQuestion) => (task === 'name' ? [q.low, q.high] : [q.low])

  const startRound = async () => {
    timeouts.clear()
    slot.set(null)
    const question = makeIntervalQuestion(midis, allowed, rng)
    if (!question) return
    setView({ ...IDLE, phase: 'prompt', question })
    if (!(await audio.playSequence(promptNotes(question)))) return
    if (task === 'name') {
      setView((v) => ({ ...v, phase: 'answer', askedAt: audio.now() }))
      return
    }
    const matcher = { toleranceCents: settings.toleranceCents, holdMs: settings.holdMs }
    slot.set(
      new ListenRound(question.high, playRoundConfig(mode, matcher, settings.a4), audio.now()),
    )
    setView((v) => ({ ...v, phase: 'listening' }))
  }

  const conclude = (correct: boolean, points: number) => {
    const session = scoring.record({ correct, points })
    if (!isFinished(session)) timeouts.after(ADVANCE_MS, () => void startRound())
  }

  const answer = (id: IntervalId) => {
    if (view.phase !== 'answer' || !view.question) return
    const correct = view.question.interval.id === id
    const points = answerPoints(correct, audio.now() - view.askedAt)
    setView((v) => ({ ...v, phase: 'result', correct, points }))
    conclude(correct, points)
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
    const correct = state.status === 'hit'
    const points = playPoints(state)
    setView((v) => ({ ...v, phase: 'result', round: state, correct, points }))
    conclude(correct, points)
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
    void startRound()
  }

  // A constant rng keeps this check pure; it only asks whether any question exists.
  if (makeIntervalQuestion(midis, allowed, () => 0) === null) {
    return (
      <p role="alert" className="notice">
        No enabled interval fits these notes. Enable more intervals or widen the hole range.
      </p>
    )
  }

  const q = view.question
  const highlights = new Map<string, Highlight>()
  if (audio.detectedMidi !== null) {
    for (const n of findNotes(harp, audio.detectedMidi)) highlights.set(noteId(n), 'detected')
  }
  if (q && view.phase === 'result') {
    for (const n of findNotes(harp, q.low)) highlights.set(noteId(n), 'target')
    for (const n of findNotes(harp, q.high)) {
      highlights.set(noteId(n), task === 'play' && view.correct ? 'correct' : 'target')
    }
  }
  const secondsLeft = Math.max(
    0,
    Math.ceil((INTERVAL_PLAY_LIMIT_MS - (view.round?.elapsedMs ?? 0)) / 1000),
  )
  const offered = INTERVALS.filter((i) => allowed.includes(i.id))
  const playTask = q
    ? `${article(q.interval.name)} ${q.interval.name.toLowerCase()} above ${noteName(q.low, spelling)}`
    : ''

  return (
    <>
      {task === 'play' && audio.error && <MicErrorNotice kind={audio.error} />}
      <ScorePanel scoring={scoring} />
      <Stage
        controls={
          <>
            {/* The primary action always comes first. */}
            {isFinished(scoring.session) && <PlayAgain onClick={restart} />}
            {view.phase === 'idle' &&
              !(task === 'play' && audio.error) &&
              (task === 'name' || audio.status === 'listening' ? (
                <button type="button" className={styles.primary} onClick={() => void startRound()}>
                  ▶ Start
                </button>
              ) : (
                <p className={styles.hint}>Waiting for microphone…</p>
              ))}
            {q && view.phase !== 'idle' && view.phase !== 'prompt' && (
              <button type="button" onClick={() => void audio.playSequence(promptNotes(q))}>
                🔊 Replay
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
          view.phase === 'result' && q ? (
            <>
              {task === 'name'
                ? view.correct
                  ? `✓ ${q.interval.name}`
                  : `✗ It was: ${q.interval.name}`
                : view.correct
                  ? `✓ ${noteName(q.high, spelling)} — ${q.interval.name}`
                  : `✗ It was ${noteName(q.high, spelling)} — ${q.interval.name}`}
              {mode === 'scored' && view.correct && ` · +${view.points}`}
            </>
          ) : view.phase === 'prompt' ? (
            task === 'play' ? (
              `Listen… then play ${playTask}`
            ) : (
              'Listen…'
            )
          ) : view.phase === 'answer' ? (
            'Which interval?'
          ) : (
            view.phase === 'listening' && `Play ${playTask}`
          )
        }
        result={view.phase === 'result' && q ? (view.correct ? 'ok' : 'bad') : undefined}
        progress={view.phase === 'listening' ? (view.round?.progress ?? 0) : undefined}
        detail={view.phase === 'listening' && mode === 'scored' && `${secondsLeft} s left`}
      />
      {/* Always rendered in "Name it", so the chart below doesn't move when the question comes. */}
      {task === 'name' && (
        <div role="group" aria-label="Answers" className={styles.answers}>
          {offered.map((i) => (
            <button
              key={i.id}
              type="button"
              disabled={view.phase !== 'answer'}
              onClick={() => answer(i.id)}
            >
              {i.name}
            </button>
          ))}
        </div>
      )}
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
