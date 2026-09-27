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
import { buildHarp, findNotes, noteId } from '../../../core/harmonica/harp'
import { keySpelling } from '../../../core/harmonica/keys'
import { INTERVALS, type IntervalId } from '../../../core/music/intervals'
import { noteName } from '../../../core/music/noteNames'
import { HarmonicaDiagram, type Highlight } from '../../components/HarmonicaDiagram'
import { MicErrorNotice } from '../../components/MicErrorNotice'
import { GameLayout } from '../../components/game/GameLayout'
import { HoldMeter } from '../../components/game/HoldMeter'
import { ModeToggle } from '../../components/game/ModeToggle'
import { PoolFilterPanel } from '../../components/game/PoolFilterPanel'
import { ScorePanel } from '../../components/game/ScorePanel'
import styles from '../../components/game/Game.module.css'
import { useGameAudio, type HeardListener } from '../../hooks/useGameAudio'
import { useScoring } from '../../hooks/useScoring'
import { useSlot } from '../../hooks/useSlot'
import { useTimeouts } from '../../hooks/useTimeouts'
import { bestScoreKey } from '../../scores/bestScores'
import { useSettings } from '../../settings/SettingsContext'

const ADVANCE_MS = 1500
const ALL_INTERVALS: readonly IntervalId[] = INTERVALS.map((i) => i.id)

type Task = 'name' | 'play'

const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a')

export function IntervalsPage() {
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
  mode: GameMode
  task: Task
  allowed: readonly IntervalId[]
  filter: PoolFilter
  rng: Rng
}

function IntervalRun({ mode, task, allowed, filter, rng }: RunProps) {
  const { settings } = useSettings()
  const harp = useMemo(() => buildHarp(settings.key), [settings.key])
  const midis = useMemo(
    () => uniqueMidis(buildPool(harp, filter, settings.showAdvanced)),
    [harp, filter, settings.showAdvanced],
  )
  const spelling = keySpelling(settings.key)
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
    }),
  )
  const slot = useSlot<ListenRound>()
  const timeouts = useTimeouts()
  const audio = useGameAudio(task === 'play')
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
      <ScorePanel scoring={scoring} onRestart={restart} />
      <div className={styles.stage}>
        {view.phase === 'idle' && !(task === 'play' && audio.error) && (
          <button type="button" className={styles.primary} onClick={() => void startRound()}>
            ▶ Start
          </button>
        )}
        {view.phase === 'prompt' && (
          <p className={styles.prompt}>
            {task === 'play' ? `Listen… then play ${playTask}` : 'Listen…'}
          </p>
        )}
        {view.phase === 'answer' && (
          <>
            <p className={styles.prompt}>Which interval?</p>
            <div className={styles.answers}>
              {offered.map((i) => (
                <button key={i.id} type="button" onClick={() => answer(i.id)}>
                  {i.name}
                </button>
              ))}
            </div>
          </>
        )}
        {view.phase === 'listening' && (
          <>
            <p className={styles.prompt}>Play {playTask}</p>
            <HoldMeter progress={view.round?.progress ?? 0} />
            {mode === 'scored' && <p className={styles.hint}>{secondsLeft} s left</p>}
          </>
        )}
        {view.phase === 'result' && q && (
          <p className={styles.feedback} data-result={view.correct ? 'ok' : 'bad'}>
            {task === 'name'
              ? view.correct
                ? `✓ ${q.interval.name}`
                : `✗ It was: ${q.interval.name}`
              : view.correct
                ? `✓ ${noteName(q.high, spelling)} — ${q.interval.name}`
                : `✗ It was ${noteName(q.high, spelling)} — ${q.interval.name}`}
            {mode === 'scored' && view.correct && ` · +${view.points}`}
          </p>
        )}
        {view.phase !== 'idle' && (
          <div className={styles.actions}>
            {q && view.phase !== 'prompt' && (
              <button type="button" onClick={() => void audio.playSequence(promptNotes(q))}>
                🔊 Replay
              </button>
            )}
            {!isFinished(scoring.session) && (
              <button type="button" onClick={stop}>
                ■ Stop
              </button>
            )}
          </div>
        )}
      </div>
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
