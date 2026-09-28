import { useEffect, useState } from 'react'
import {
  MELODY_NOTE_LIMIT_MS,
  MelodyRound,
  melodyPoints,
  type MelodyState,
} from '../../../core/games/melodyEcho'
import type { Rng } from '../../../core/games/random'
import { isFinished, type GameMode } from '../../../core/games/session'
import { findNotes, noteId } from '../../../core/harmonica/harp'
import { noteName } from '../../../core/music/noteNames'
import { LICKS, LICK_STYLES, type Lick, type LickStyle } from '../../../core/tab/licks'
import { lickNotes, pickLick, playableLicks, promptNotes } from '../../../core/tab/lickTrainer'
import { parseTab, type TimedNote } from '../../../core/tab/parseTab'
import { HarmonicaDiagram, type Highlight } from '../../components/HarmonicaDiagram'
import { MicErrorNotice } from '../../components/MicErrorNotice'
import { TabLine } from '../../components/TabText'
import { GameLayout } from '../../components/game/GameLayout'
import { ModeToggle } from '../../components/game/ModeToggle'
import { NoteSlots, type SlotState } from '../../components/game/NoteSlots'
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
const RANDOM = 'random'

export function LickTrainerPage() {
  usePracticeTimer('licks')
  return (
    <GameLayout
      title="Lick trainer"
      intro="Hear a short lick at your tempo, then play it back note by note."
      melodyHold
    >
      <LickGame />
    </GameLayout>
  )
}

export function LickGame({ rng = Math.random }: { rng?: Rng }) {
  const { settings } = useSettings()
  const harp = useHarp()
  // Owned here, not by the keyed run, so a settings change doesn't restart the mic.
  const audio = useGameAudio(true)
  const [mode, setMode] = useState<GameMode>('practice')
  const [style, setStyle] = useState<LickStyle>('blues2')
  const [choice, setChoice] = useState(RANDOM)
  const inStyle = LICKS.filter((l) => l.style === style)
  const playable = playableLicks(inStyle, harp)
  const runKey = [
    mode,
    style,
    mode === 'practice' ? choice : RANDOM,
    settings.key,
    settings.tuning,
    settings.a4,
    settings.bpm,
    settings.toleranceCents,
    settings.melodyHoldMs,
  ].join('|')

  return (
    <>
      <div className={styles.toolbar}>
        <ModeToggle mode={mode} onChange={setMode} />
        <label className={styles.field}>
          Style
          <select
            aria-label="Style"
            value={style}
            onChange={(e) => {
              setStyle(e.target.value as LickStyle)
              setChoice(RANDOM)
            }}
          >
            {LICK_STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {mode === 'practice' && (
          <label className={styles.field}>
            Lick
            <select aria-label="Lick" value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value={RANDOM}>Random</option>
              {inStyle.map((l) => (
                <option key={l.id} value={l.id} disabled={!playable.includes(l)}>
                  {l.name}
                  {!playable.includes(l) && ' (not on this harp)'}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className={styles.hint}>{settings.bpm} BPM</span>
      </div>
      {playable.length === 0 ? (
        <p role="alert" className="notice">
          None of these licks can be played in this tuning. Choose another style or tuning.
        </p>
      ) : (
        <LickRun
          key={runKey}
          audio={audio}
          mode={mode}
          style={style}
          licks={playable}
          chosen={mode === 'practice' ? (playable.find((l) => l.id === choice) ?? null) : null}
          rng={rng}
        />
      )}
    </>
  )
}

interface View {
  phase: 'idle' | 'prompt' | 'listening' | 'result'
  lick: Lick | null
  notes: TimedNote[]
  state: MelodyState | null
  points: number
  showTab: boolean
}

const IDLE: View = {
  phase: 'idle',
  lick: null,
  notes: [],
  state: null,
  points: 0,
  showTab: false,
}

interface RunProps {
  audio: GameAudio
  mode: GameMode
  style: LickStyle
  licks: Lick[]
  /** Practice: the lick picked in the toolbar; null = random. */
  chosen: Lick | null
  rng: Rng
}

function LickRun({ audio, mode, style, licks, chosen, rng }: RunProps) {
  const { settings } = useSettings()
  const harp = useHarp()
  const spelling = useSpelling()
  const scoring = useScoring(
    mode,
    bestScoreKey('licks', {
      style,
      key: settings.key,
      bpm: settings.bpm,
      tol: settings.toleranceCents,
      hold: settings.melodyHoldMs,
      ...tuningPart(settings.tuning),
    }),
  )
  const slot = useSlot<MelodyRound>()
  const timeouts = useTimeouts()
  const [view, setView] = useState<View>(IDLE)

  const playLick = async (lick: Lick, showTab = false) => {
    timeouts.clear()
    slot.set(null)
    const notes = lickNotes(lick, harp) ?? []
    setView({ ...IDLE, phase: 'prompt', lick, notes, showTab })
    const { items } = parseTab(lick.tab, harp)
    if (!(await audio.playTimed(promptNotes(items, settings.bpm)))) return
    const matcher = { toleranceCents: settings.toleranceCents, holdMs: settings.melodyHoldMs }
    const midis = notes.map((n) => n.note.midi)
    const limitMs = mode === 'scored' ? MELODY_NOTE_LIMIT_MS * midis.length : null
    slot.set(new MelodyRound(midis, { matcher, a4: settings.a4 }, audio.now(), limitMs))
    setView((v) => ({ ...v, phase: 'listening' }))
  }
  const nextLick = (previous: Lick | null) =>
    void playLick(chosen ?? pickLick(licks, rng, previous?.id ?? null))

  const onHeard: HeardListener = (freq, timeMs) => {
    const round = slot.get()
    if (!round) return
    const state = round.push(freq, timeMs)
    if (state.status === 'listening') {
      setView((v) => ({ ...v, state }))
      return
    }
    slot.set(null)
    const points = melodyPoints(state, view.notes.length)
    const session = scoring.record({ correct: state.status === 'success', points })
    setView((v) => ({ ...v, phase: 'result', state, points }))
    if (mode === 'scored' && !isFinished(session)) {
      timeouts.after(ADVANCE_MS, () => nextLick(view.lick))
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
    nextLick(null)
  }

  const { lick, notes, state } = view
  const reveal = view.phase === 'result'
  const slotState = (i: number): SlotState => {
    if (state?.wrongIndex === i) return 'wrong'
    if (i < (state?.index ?? 0)) return 'done'
    if (view.phase === 'listening' && i === (state?.index ?? 0)) return 'current'
    return 'todo'
  }

  const highlights = new Map<string, Highlight>()
  if (audio.detectedMidi !== null) {
    for (const n of findNotes(harp, audio.detectedMidi)) highlights.set(noteId(n), 'detected')
  }
  if (view.showTab) {
    notes.slice(state?.index ?? 0).forEach((n) => highlights.set(noteId(n.note), 'target'))
  }
  notes.slice(0, state?.index ?? 0).forEach((n) => highlights.set(noteId(n.note), 'correct'))
  if (reveal && state?.wrongIndex != null) {
    highlights.set(noteId(notes[state.wrongIndex].note), 'target')
    if (state.wrongMidi !== null) {
      findNotes(harp, state.wrongMidi).forEach((n) => highlights.set(noteId(n), 'wrong'))
    }
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
                <button type="button" className={styles.primary} onClick={() => nextLick(null)}>
                  ▶ Start
                </button>
              ) : (
                <p className={styles.hint}>Waiting for microphone…</p>
              ))}
            {view.phase === 'listening' && lick && (
              <button
                type="button"
                onClick={() => {
                  const { items } = parseTab(lick.tab, harp)
                  void audio.playTimed(promptNotes(items, settings.bpm))
                }}
              >
                🔊 Hear again
              </button>
            )}
            {/* The tab would give the answer away in scored mode. */}
            {view.phase === 'listening' && mode === 'practice' && !view.showTab && (
              <button type="button" onClick={() => setView((v) => ({ ...v, showTab: true }))}>
                👀 Show tab
              </button>
            )}
            {mode === 'practice' && reveal && lick && (
              <>
                <button type="button" onClick={() => void playLick(lick, view.showTab)}>
                  🔁 Try again
                </button>
                <button type="button" onClick={() => nextLick(lick)}>
                  ▶ Next lick
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
                `✗ Note ${state.wrongIndex + 1}: you played ${noteName(state.wrongMidi, spelling)}, it was ${noteName(notes[state.wrongIndex].note.midi, spelling)}`}
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
        detail={lick && `${lick.name} · ${notes.length} notes`}
      />
      {/* Always rendered; numbered slots until notes are played. */}
      <NoteSlots
        label="Lick notes"
        slots={notes.map((n, i) => ({
          label: reveal || slotState(i) === 'done' ? noteName(n.note.midi, spelling) : i + 1,
          state: slotState(i),
        }))}
      />
      <p className={styles.tabLine} aria-label="Lick tab">
        {(view.showTab || reveal) && <TabLine tabs={notes.map((n) => n.tab)} />}
      </p>
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
