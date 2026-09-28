import { useEffect, useMemo, useRef, useState } from 'react'
import { ScaleRun } from '../../../core/games/scaleRunner'
import { isFinished, type GameMode } from '../../../core/games/session'
import { findNotes, noteId } from '../../../core/harmonica/harp'
import { noteName } from '../../../core/music/noteNames'
import { BeatAnchor } from '../../../core/rhythm/beatAnchor'
import { TIME_SIGNATURES, type MetronomeConfig } from '../../../core/rhythm/schedule'
import {
  beatMs,
  parseTab,
  tabTimeline,
  textHash,
  type TabTimeline,
} from '../../../core/tab/parseTab'
import { SONGS } from '../../../core/tab/songs'
import { TAB_HOLD_MS, TabJudge, WaitClock, type JudgedNote } from '../../../core/tab/tabJudge'
import { HarmonicaDiagram, type Highlight } from '../../components/HarmonicaDiagram'
import { MicErrorNotice } from '../../components/MicErrorNotice'
import { TabText } from '../../components/TabText'
import { GameLayout } from '../../components/game/GameLayout'
import { ModeToggle } from '../../components/game/ModeToggle'
import { NoteSlots, type NoteSlot } from '../../components/game/NoteSlots'
import { PlayAgain, ScorePanel } from '../../components/game/ScorePanel'
import { Stage } from '../../components/game/Stage'
import styles from '../../components/game/Game.module.css'
import { useAnimationFrame } from '../../hooks/useAnimationFrame'
import { useGameAudio, type GameAudio, type HeardListener } from '../../hooks/useGameAudio'
import { useHarp, useSpelling } from '../../hooks/useHarp'
import { useMetronome } from '../../hooks/useMetronome'
import { usePracticeTimer } from '../../hooks/usePracticeTimer'
import { useScoring } from '../../hooks/useScoring'
import { useSlot } from '../../hooks/useSlot'
import { bestScoreKey, tuningPart } from '../../scores/bestScores'
import { browserStorage } from '../../settings/settings'
import { useSettings } from '../../settings/SettingsContext'
import { loadYourTab, saveYourTab } from '../../tab/yourTab'
import laneStyles from './TabReaderPage.module.css'

const CUSTOM = 'custom'
/** Lane scale and where the playhead sits. */
export const PX_PER_BEAT = 64
export const PLAYHEAD_PX = 96
/** How many upcoming notes the slot row shows (the last one played, then the next ones). */
const WINDOW = 6

export function TabReaderPage() {
  usePracticeTimer('tab-reader')
  return (
    <GameLayout
      title="Tab reader"
      intro="The tab scrolls towards the line: play each note as it reaches it."
    >
      <TabReaderGame />
    </GameLayout>
  )
}

export function TabReaderGame({ storage = browserStorage() }: { storage?: Storage | null }) {
  const { settings } = useSettings()
  const harp = useHarp()
  // Owned here, not by the keyed run, so a settings change doesn't restart the mic.
  const audio = useGameAudio(true)
  const [mode, setMode] = useState<GameMode>('practice')
  const [songId, setSongId] = useState(SONGS[0].id)
  const [waitForMe, setWaitForMe] = useState(true)
  const [yourTab, setYourTab] = useState(() => loadYourTab(storage))

  const song = SONGS.find((s) => s.id === songId)
  const { parsed, timeline } = useMemo(() => {
    const text = SONGS.find((s) => s.id === songId)?.tab ?? yourTab
    const parsed = parseTab(text, harp)
    return { parsed, timeline: tabTimeline(parsed.items) }
  }, [songId, yourTab, harp])
  const wait = mode === 'practice' && waitForMe
  const songKey = song ? song.id : `${CUSTOM}-${textHash(yourTab)}`

  const runKey = [
    mode,
    wait,
    songKey,
    settings.key,
    settings.tuning,
    settings.a4,
    settings.bpm,
    settings.toleranceCents,
  ].join('|')
  const bestKey = bestScoreKey('tab-reader', {
    song: songKey,
    ...tuningPart(settings.tuning),
  })

  return (
    <>
      <div className={styles.toolbar}>
        <ModeToggle mode={mode} onChange={setMode} />
        <label className={styles.field}>
          Song
          <select aria-label="Song" value={songId} onChange={(e) => setSongId(e.target.value)}>
            {SONGS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
            <option value={CUSTOM}>Your tab</option>
          </select>
        </label>
        {mode === 'practice' && (
          <label className={styles.field}>
            <input
              type="checkbox"
              checked={waitForMe}
              onChange={(e) => setWaitForMe(e.target.checked)}
            />
            Wait for me
          </label>
        )}
        <span className={styles.hint}>{settings.bpm} BPM (set it on the metronome)</span>
      </div>
      {!song && (
        <label className={laneStyles.yourTab}>
          Your tab
          <textarea
            rows={3}
            spellCheck={false}
            value={yourTab}
            onChange={(e) => {
              setYourTab(e.target.value)
              saveYourTab(storage, e.target.value)
            }}
          />
          <span className={styles.hint}>
            Notes like 4 -4 -3&apos; 6o, _ for a rest, | for a bar line, :2 for two beats.
          </span>
        </label>
      )}
      {parsed.errors.length > 0 ? (
        <div role="alert" className="notice">
          <strong>This tab can&apos;t be played on this harp:</strong>
          <ul>
            {parsed.errors.map((e) => (
              <li key={e.position}>
                Token {e.position} “{e.token}” {e.message}.
              </li>
            ))}
          </ul>
        </div>
      ) : timeline.notes.length === 0 ? (
        <p role="alert" className="notice">
          This tab has no notes yet.
        </p>
      ) : (
        <TabRun
          key={runKey}
          audio={audio}
          mode={mode}
          wait={wait}
          timeline={timeline}
          beatsPerBar={song?.beatsPerBar ?? 4}
          bestKey={bestKey}
        />
      )}
    </>
  )
}

type Runtime =
  | { kind: 'wait'; follower: ScaleRun; clock: WaitClock }
  | { kind: 'tempo'; judge: TabJudge; anchor: BeatAnchor }

interface View {
  phase: 'idle' | 'running' | 'done'
  /** The note being waited for / judged next. */
  index: number
  results: (JudgedNote | null)[]
}

interface RunProps {
  audio: GameAudio
  mode: GameMode
  wait: boolean
  timeline: TabTimeline
  beatsPerBar: 3 | 4
  bestKey: string
}

function TabRun({ audio, mode, wait, timeline, beatsPerBar, bestKey }: RunProps) {
  const { settings } = useSettings()
  const harp = useHarp()
  const spelling = useSpelling()
  const { notes } = timeline
  const scoring = useScoring(mode, bestKey, notes.length, 100)
  const metronomeConfig = useMemo<MetronomeConfig>(
    () => ({
      bpm: settings.bpm,
      signature: TIME_SIGNATURES[beatsPerBar === 3 ? 1 : 2],
      subdivision: 1,
    }),
    [settings.bpm, beatsPerBar],
  )
  const metronome = useMetronome(metronomeConfig)
  const runtime = useSlot<Runtime>()
  const track = useRef<HTMLDivElement>(null)
  const idle = (): View => ({ phase: 'idle', index: 0, results: notes.map(() => null) })
  const [view, setView] = useState<View>(idle)
  const beat = beatMs(settings.bpm)
  const countIn = beatsPerBar
  /** Lane position (in beats, count-in included) where note `i` starts. */
  const laneBeat = (i: number) => countIn + notes[i].startBeat

  const start = () => {
    if (mode === 'scored') scoring.restart()
    setView({ ...idle(), phase: 'running' })
    if (wait) {
      const matcher = { toleranceCents: settings.toleranceCents, holdMs: TAB_HOLD_MS }
      const follower = new ScaleRun(
        notes.map((n) => n.note.midi),
        { matcher, a4: settings.a4, rearticulate: true },
        audio.now(),
      )
      runtime.set({ kind: 'wait', follower, clock: new WaitClock(audio.now(), beat) })
      return
    }
    const judge = new TabJudge(
      notes.map((n) => ({
        midi: n.note.midi,
        startMs: n.startBeat * beat,
        durationMs: n.beats * beat,
      })),
      { toleranceCents: settings.toleranceCents, a4: settings.a4 },
    )
    runtime.set({ kind: 'tempo', judge, anchor: new BeatAnchor(beat) })
    if (!metronome.running) metronome.toggle()
  }
  const finish = (phase: View['phase']) => {
    runtime.set(null)
    if (metronome.running) metronome.toggle()
    setView((v) => ({ ...v, phase }))
  }

  const onHeard: HeardListener = (freq, timeMs) => {
    const rt = runtime.get()
    if (!rt) return
    if (rt.kind === 'wait') {
      const state = rt.follower.push(freq, timeMs)
      if (!state.completed) return
      const i = state.completed.index
      rt.clock.release(timeMs, laneBeat(i))
      const result: JudgedNote = { index: i, hit: true, offsetMs: 0, points: 0 }
      scoring.record({ correct: true, points: 0 })
      setView((v) => ({
        ...v,
        index: i + 1,
        results: v.results.map((r, k) => (k === i ? result : r)),
      }))
      if (state.done) finish('done')
      return
    }
    if (metronome.lastBeatMs !== null) rt.anchor.sync(metronome.lastBeatMs)
    const origin = rt.anchor.originMs
    if (origin === null) return
    const judged = rt.judge.push(freq, timeMs - (origin + countIn * beat))
    if (judged.length === 0) return
    for (const j of judged) scoring.record({ correct: j.hit, points: j.points })
    setView((v) => ({
      ...v,
      index: rt.judge.current,
      results: v.results.map((r, k) => judged.find((j) => j.index === k) ?? r),
    }))
    if (rt.judge.done) finish('done')
  }
  useEffect(() => audio.listen(onHeard))

  // The lane scrolls through a ref on animation frames: no re-render per frame.
  useAnimationFrame(() => {
    const rt = runtime.get()
    let position = 0
    if (rt?.kind === 'wait') {
      const i = rt.follower.state.index
      position = rt.clock.position(
        audio.now(),
        i < notes.length ? laneBeat(i) : countIn + timeline.totalBeats,
      )
    } else if (rt?.kind === 'tempo' && rt.anchor.originMs !== null) {
      position = (audio.now() - rt.anchor.originMs) / beat
    }
    if (track.current) {
      track.current.style.transform = `translateX(${PLAYHEAD_PX - position * PX_PER_BEAT}px)`
    }
  })

  const current = view.phase === 'running' ? notes[view.index] : undefined
  const highlights = new Map<string, Highlight>()
  if (audio.detectedMidi !== null) {
    for (const n of findNotes(harp, audio.detectedMidi)) highlights.set(noteId(n), 'detected')
  }
  if (current) highlights.set(noteId(current.note), 'target')

  const slotState = (i: number): NoteSlot['state'] => {
    const r = view.results[i]
    if (r) return r.hit ? 'done' : 'wrong'
    return i === view.index && view.phase === 'running' ? 'current' : 'todo'
  }
  const first = Math.max(0, Math.min(view.index - 1, notes.length - WINDOW))
  const slots: NoteSlot[] = Array.from({ length: WINDOW }, (_, k) => {
    const i = first + k
    return i < notes.length
      ? { label: <TabText tab={notes[i].tab} />, state: slotState(i) }
      : { label: '', state: 'todo' }
  })
  const hits = view.results.filter((r) => r?.hit).length
  const lastPoints = mode === 'scored' ? view.results[view.index - 1]?.points : undefined

  return (
    <>
      {audio.error && <MicErrorNotice kind={audio.error} />}
      <ScorePanel scoring={scoring} />
      <Stage
        controls={
          <>
            {/* The primary action always comes first. */}
            {isFinished(scoring.session) && <PlayAgain onClick={start} />}
            {view.phase !== 'running' &&
              !isFinished(scoring.session) &&
              !audio.error &&
              (audio.status === 'listening' ? (
                <button type="button" className={styles.primary} onClick={start}>
                  ▶ {view.phase === 'done' ? 'Again' : 'Start'}
                </button>
              ) : (
                <p className={styles.hint}>Waiting for microphone…</p>
              ))}
            {view.phase === 'running' && (
              <button type="button" onClick={() => finish('idle')}>
                ■ Stop
              </button>
            )}
          </>
        }
        headline={
          current
            ? `Next: ${current.tab} (${noteName(current.note.midi, spelling)})`
            : view.phase === 'done' &&
              mode === 'practice' &&
              `✓ Done — ${hits} of ${notes.length} notes`
        }
        result={view.phase === 'done' && mode === 'practice' ? 'ok' : undefined}
        detail={
          current && (
            <>
              Note {view.index + 1} of {notes.length}
              {wait ? ' · the tab waits for you' : ` · ${settings.bpm} BPM, one bar of count-in`}
              {lastPoints !== undefined && ` · last +${lastPoints}`}
            </>
          )
        }
      />
      <div className={laneStyles.lane} aria-hidden>
        <div className={laneStyles.playhead} style={{ left: PLAYHEAD_PX }} />
        <div
          ref={track}
          className={laneStyles.track}
          style={{ transform: `translateX(${PLAYHEAD_PX}px)` }}
        >
          <div className={laneStyles.countIn} style={{ width: countIn * PX_PER_BEAT }}>
            count-in
          </div>
          {timeline.bars.map((b, i) => (
            <div key={i} className={laneStyles.bar} style={{ left: (countIn + b) * PX_PER_BEAT }} />
          ))}
          {notes.map((n, i) => (
            <div
              key={i}
              className={laneStyles.note}
              data-color={n.note.technique}
              data-state={slotState(i)}
              style={{ left: laneBeat(i) * PX_PER_BEAT, width: n.beats * PX_PER_BEAT - 4 }}
            >
              <TabText tab={n.tab} />
            </div>
          ))}
        </div>
      </div>
      <NoteSlots label="Next notes" slots={slots} />
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
