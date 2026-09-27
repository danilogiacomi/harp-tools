import { useMemo, useState } from 'react'
import { pickTarget } from '../../../core/games/echoNote'
import {
  PITCH_CLASSES,
  isRightHole,
  isRightName,
  pickQuizNote,
  quizPoints,
} from '../../../core/games/noteQuiz'
import {
  DEFAULT_POOL_FILTER,
  buildPool,
  poolLabel,
  uniqueMidis,
  type PoolFilter,
} from '../../../core/games/notePool'
import type { Rng } from '../../../core/games/random'
import { isFinished, type GameMode } from '../../../core/games/session'
import { findNotes, noteId, tabLabel, type HarpNote } from '../../../core/harmonica/harp'
import { keySpelling } from '../../../core/harmonica/keys'
import { noteName, pitchClassName } from '../../../core/music/noteNames'
import { HarmonicaDiagram, type Highlight } from '../../components/HarmonicaDiagram'
import { ModeToggle } from '../../components/game/ModeToggle'
import { PoolFilterPanel } from '../../components/game/PoolFilterPanel'
import { PlayAgain, ScorePanel } from '../../components/game/ScorePanel'
import { Stage } from '../../components/game/Stage'
import styles from '../../components/game/Game.module.css'
import { useHarp } from '../../hooks/useHarp'
import { usePracticeTimer } from '../../hooks/usePracticeTimer'
import { useScoring } from '../../hooks/useScoring'
import { useSlot } from '../../hooks/useSlot'
import { useTimeouts } from '../../hooks/useTimeouts'
import { bestScoreKey, tuningPart } from '../../scores/bestScores'
import { useSettings } from '../../settings/SettingsContext'

const ADVANCE_MS = 1500

type Task = 'name' | 'find'

export function NoteQuizPage() {
  usePracticeTimer('quiz', { requireAudio: false })
  return (
    <>
      <h1>Note quiz</h1>
      <p className={styles.intro}>
        Learn where every note lives: name the highlighted hole, or find the hole for a note. No
        sound and no microphone — just you and the chart.
      </p>
      <QuizGame />
    </>
  )
}

interface GameProps {
  rng?: Rng
  /** Milliseconds, for the speed bonus; only called from handlers. */
  now?: () => number
}

export function QuizGame({ rng = Math.random, now = () => performance.now() }: GameProps) {
  const { settings } = useSettings()
  const [mode, setMode] = useState<GameMode>('practice')
  const [task, setTask] = useState<Task>('name')
  const [filter, setFilter] = useState<PoolFilter>(DEFAULT_POOL_FILTER)
  // Any change here remounts the run: timers stop and the score resets.
  const runKey = [
    mode,
    task,
    poolLabel(filter),
    settings.key,
    settings.tuning,
    settings.showAdvanced,
  ].join('|')
  return (
    <>
      <div className={styles.toolbar}>
        <ModeToggle mode={mode} onChange={setMode} />
        <div role="group" aria-label="Task" className={styles.segmented}>
          <button type="button" aria-pressed={task === 'name'} onClick={() => setTask('name')}>
            Name the note
          </button>
          <button type="button" aria-pressed={task === 'find'} onClick={() => setTask('find')}>
            Find the hole
          </button>
        </div>
      </div>
      <PoolFilterPanel filter={filter} onChange={setFilter} />
      <QuizRun key={runKey} mode={mode} task={task} filter={filter} rng={rng} now={now} />
    </>
  )
}

interface View {
  phase: 'idle' | 'answer' | 'result'
  /** "Name": the highlighted box. "Find": a box with the asked pitch. */
  note: HarpNote | null
  askedAt: number
  correct: boolean
  points: number
  /** "Find": the box the player clicked. */
  picked: HarpNote | null
}

const IDLE: View = {
  phase: 'idle',
  note: null,
  askedAt: 0,
  correct: false,
  points: 0,
  picked: null,
}

interface RunProps {
  mode: GameMode
  task: Task
  filter: PoolFilter
  rng: Rng
  now: () => number
}

function QuizRun({ mode, task, filter, rng, now }: RunProps) {
  const { settings } = useSettings()
  const harp = useHarp()
  const pool = useMemo(
    () => buildPool(harp, filter, settings.showAdvanced),
    [harp, filter, settings.showAdvanced],
  )
  const midis = useMemo(() => uniqueMidis(pool), [pool])
  const spelling = keySpelling(settings.key)
  const scoring = useScoring(
    mode,
    bestScoreKey('quiz', {
      key: settings.key,
      task,
      pool: poolLabel(filter),
      adv: settings.showAdvanced,
      ...tuningPart(settings.tuning),
    }),
  )
  // The open question; cleared by the first answer, so a second one in the same frame is ignored.
  const open = useSlot<HarpNote>()
  const timeouts = useTimeouts()
  const [view, setView] = useState<View>(IDLE)

  const nextNote = (previous: HarpNote | null): HarpNote => {
    if (task === 'name') return pickQuizNote(pool, rng, previous)
    const midi = pickTarget(midis, rng, previous?.midi ?? null)
    return pool.find((n) => n.midi === midi)!
  }

  const startRound = (previous: HarpNote | null) => {
    timeouts.clear()
    const note = nextNote(previous)
    open.set(note)
    setView({ ...IDLE, phase: 'answer', note, askedAt: now() })
  }

  const conclude = (note: HarpNote, correct: boolean, picked: HarpNote | null) => {
    open.set(null)
    const points = quizPoints(correct, now() - view.askedAt)
    setView((v) => ({ ...v, phase: 'result', correct, points, picked }))
    const session = scoring.record({ correct, points })
    if (!isFinished(session)) timeouts.after(ADVANCE_MS, () => startRound(note))
  }

  const answerName = (pc: number) => {
    const note = open.get()
    if (note) conclude(note, isRightName(note, pc), null)
  }
  const answerHole = (clicked: HarpNote) => {
    const note = open.get()
    if (note) conclude(note, isRightHole(note.midi, clicked), clicked)
  }

  const stop = () => {
    timeouts.clear()
    open.set(null)
    setView(IDLE)
  }
  const restart = () => {
    scoring.restart()
    startRound(null)
  }

  if (pool.length === 0) {
    return (
      <p role="alert" className="notice">
        No notes match these filters. Choose more holes or techniques.
      </p>
    )
  }

  const visible = (midi: number) =>
    findNotes(harp, midi).filter((n) => settings.showAdvanced || n.common)
  const note = view.note
  const highlights = new Map<string, Highlight>()
  if (note && task === 'name') {
    highlights.set(
      noteId(note),
      view.phase === 'result' ? (view.correct ? 'correct' : 'wrong') : 'target',
    )
  }
  if (note && task === 'find' && view.phase === 'result') {
    for (const n of visible(note.midi)) highlights.set(noteId(n), 'target')
    if (view.picked) highlights.set(noteId(view.picked), view.correct ? 'correct' : 'wrong')
  }

  const resultText = (n: HarpNote) => {
    if (task === 'name') {
      const name = pitchClassName(n.midi, spelling)
      return view.correct ? `✓ ${name}` : `✗ It was ${name}`
    }
    const name = noteName(n.midi, spelling)
    return view.correct && view.picked
      ? `✓ ${name} — ${tabLabel(view.picked)}`
      : `✗ ${name} is ${visible(n.midi).map(tabLabel).join(' or ')}`
  }

  return (
    <>
      <ScorePanel scoring={scoring} />
      <Stage
        controls={
          <>
            {/* The primary action always comes first. */}
            {isFinished(scoring.session) && <PlayAgain onClick={restart} />}
            {view.phase === 'idle' && (
              <button type="button" className={styles.primary} onClick={() => startRound(null)}>
                ▶ Start
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
          view.phase === 'result' && note ? (
            <>
              {resultText(note)}
              {mode === 'scored' && view.correct && ` · +${view.points}`}
            </>
          ) : view.phase === 'answer' && note ? (
            task === 'name' ? (
              'Which note is this?'
            ) : (
              <span className={styles.bigNote} data-testid="target-note">
                {noteName(note.midi, spelling)}
              </span>
            )
          ) : null
        }
        result={view.phase === 'result' && note ? (view.correct ? 'ok' : 'bad') : undefined}
        detail={
          view.phase === 'answer' &&
          `${task === 'name' ? 'Pick its name below.' : 'Click a hole that plays it.'}${
            mode === 'scored' ? ' Faster answers score more.' : ''
          }`
        }
      />
      {/* Always rendered in "Name the note", so the chart doesn't move when a question comes. */}
      {task === 'name' && (
        <div
          role="group"
          aria-label="Answers"
          className={`${styles.answers} ${styles.noteAnswers}`}
        >
          {PITCH_CLASSES.map((pc) => (
            <button
              key={pc}
              type="button"
              disabled={view.phase !== 'answer'}
              onClick={() => answerName(pc)}
            >
              {pitchClassName(pc, spelling)}
            </button>
          ))}
        </div>
      )}
      {/* Tab labels only, and concealed from screen readers too: note names, visible or
          announced, would give the answer away. The chart never plays sound. */}
      <HarmonicaDiagram
        harp={harp}
        spelling={spelling}
        labelMode="tab"
        showAdvanced={settings.showAdvanced}
        highlights={highlights}
        onNoteDown={task === 'find' ? answerHole : undefined}
        concealNotes
      />
    </>
  )
}
