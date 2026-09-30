import { useEffect, useMemo, useReducer, useState } from 'react'
import {
  maxScore,
  meterLevel,
  multiplier,
  scoreNote,
  starText,
  stars,
  startArcade,
  type ArcadeState,
  type Grade,
} from '../../../core/arcade/arcadeScore'
import {
  bandConfig,
  BARS_PER_CHORUS,
  COUNT_IN_BARS,
  noteCount,
  songBars,
  TRACK_BEATS_PER_BAR,
  TRACKS,
  type Track,
} from '../../../core/arcade/tracks'
import type { GameMode } from '../../../core/games/session'
import { findNotes, noteId } from '../../../core/harmonica/harp'
import { noteName } from '../../../core/music/noteNames'
import { BeatAnchor } from '../../../core/rhythm/beatAnchor'
import { beatMs, parseTab, tabTimeline, type TabTimeline } from '../../../core/tab/parseTab'
import { TabJudge } from '../../../core/tab/tabJudge'
import { HarmonicaDiagram, type Highlight } from '../../components/HarmonicaDiagram'
import { MicErrorNotice } from '../../components/MicErrorNotice'
import { GameLayout } from '../../components/game/GameLayout'
import { ModeToggle } from '../../components/game/ModeToggle'
import { Stage } from '../../components/game/Stage'
import { WrittenForRichter } from '../../components/game/WrittenForRichter'
import gameStyles from '../../components/game/Game.module.css'
import { useGameAudio, type GameAudio, type HeardListener } from '../../hooks/useGameAudio'
import { useHarp, useSpelling } from '../../hooks/useHarp'
import { usePracticeTimer } from '../../hooks/usePracticeTimer'
import { useScoring } from '../../hooks/useScoring'
import { useSlot } from '../../hooks/useSlot'
import { bestScoreKey, loadBest, tuningPart } from '../../scores/bestScores'
import { browserStorage } from '../../settings/settings'
import { useSettings } from '../../settings/SettingsContext'
import { Highway, type NoteState } from './Highway'
import { useSongBand } from './useSongBand'
import styles from './HarpHeroPage.module.css'

/** Spec §1.2: practice can slow a track down; a scored run is always at full speed. */
export const SPEEDS = [1, 0.75] as const
/** The most one note can earn: a Perfect at ×4. */
const NOTE_MAX = 400
const GRADE_WORDS: Record<Grade, string> = { perfect: 'Perfect', good: 'Good', miss: 'Miss' }
const fmt = (n: number) => n.toLocaleString('en-US')
const ratingText = (r: number) => '●'.repeat(r) + '○'.repeat(5 - r)

export function HarpHeroPage() {
  usePracticeTimer('hero')
  return (
    <GameLayout
      title="Harp Hero"
      intro="The band plays and the notes fall towards your harp: play each one as it reaches the line."
    >
      <HeroGame />
    </GameLayout>
  )
}

export function HeroGame({ storage = browserStorage() }: { storage?: Storage | null }) {
  const { settings } = useSettings()
  const harp = useHarp()
  // Owned here, not by the keyed run, so a settings change doesn't restart the mic.
  const audio = useGameAudio(true)
  const [mode, setMode] = useState<GameMode>('practice')
  const [trackId, setTrackId] = useState(TRACKS[0].id)
  const [speed, setSpeed] = useState<number>(SPEEDS[0])
  // Bumped when a run finishes, so the track picker re-reads the saved bests for its stars.
  const [, runFinished] = useReducer((n: number) => n + 1, 0)

  const track = TRACKS.find((t) => t.id === trackId) ?? TRACKS[0]
  const { parsed, timeline } = useMemo(() => {
    const parsed = parseTab(track.part, harp)
    return { parsed, timeline: tabTimeline(parsed.items) }
  }, [track, harp])
  const runSpeed = mode === 'practice' ? speed : 1
  const bestKey = (t: Track) =>
    bestScoreKey('hero', { track: t.id, ...tuningPart(settings.tuning) })
  const trackStars = (t: Track) => stars(loadBest(storage, bestKey(t)), maxScore(noteCount(t)))
  const runKey = [
    mode,
    track.id,
    runSpeed,
    settings.key,
    settings.tuning,
    settings.a4,
    settings.toleranceCents,
  ].join('|')

  return (
    <>
      <div className={gameStyles.toolbar}>
        <ModeToggle mode={mode} onChange={setMode} />
        <label className={`${gameStyles.field} ${styles.trackField}`}>
          Track
          <select aria-label="Track" value={track.id} onChange={(e) => setTrackId(e.target.value)}>
            {TRACKS.map((t) => (
              <option key={t.id} value={t.id}>
                {`${t.title} · ${ratingText(t.rating)} · ${starText(trackStars(t))}`}
              </option>
            ))}
          </select>
        </label>
        {mode === 'practice' && (
          <label className={gameStyles.field}>
            Speed
            <select
              aria-label="Speed"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s * 100}%
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <WrittenForRichter />
      <p className={gameStyles.hint}>
        Headphones help: the band's chords can sound like harp notes to the mic.
      </p>
      {parsed.errors.length > 0 ? (
        <div role="alert" className="notice">
          <strong>This track can&apos;t be played on this harp:</strong>
          <ul>
            {parsed.errors.map((e) => (
              <li key={e.position}>
                Token {e.position} “{e.token}” {e.message}.
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <HeroRun
          key={runKey}
          audio={audio}
          mode={mode}
          track={track}
          speed={runSpeed}
          timeline={timeline}
          bestKey={bestKey(track)}
          onFinished={runFinished}
        />
      )}
    </>
  )
}

type Phase = 'idle' | 'running' | 'done' | 'failed'

interface View {
  phase: Phase
  /** The next note to be judged. */
  index: number
  states: NoteState[]
  arcade: ArcadeState
  /** Notes judged so far: restarts the grade word's fade for each one. */
  judged: number
  grade: Grade | null
  failedBar: number | null
}

interface Runtime {
  judge: TabJudge
  /** The band's bars as they are heard. Its origin is the start of the count-in: lane beat 0. */
  anchor: BeatAnchor
  arcade: ArcadeState
  /** Where the highway stopped when the song failed; null while it moves. */
  frozenAt: number | null
}

interface RunProps {
  audio: GameAudio
  mode: GameMode
  track: Track
  speed: number
  timeline: TabTimeline
  bestKey: string
  onFinished: () => void
}

function HeroRun({ audio, mode, track, speed, timeline, bestKey, onFinished }: RunProps) {
  const { settings } = useSettings()
  const harp = useHarp()
  const spelling = useSpelling()
  const { notes } = timeline
  const bpm = track.bpm * speed
  const beat = beatMs(bpm)
  const barMs = beat * TRACK_BEATS_PER_BAR
  const countInBeats = COUNT_IN_BARS * TRACK_BEATS_PER_BAR
  const bars = songBars(track)
  const max = maxScore(notes.length)
  const scoring = useScoring(mode, bestKey, notes.length, NOTE_MAX, max)
  const config = useMemo(() => bandConfig(track, settings.key, speed), [track, settings.key, speed])
  const runtime = useSlot<Runtime>()
  const idle = (): View => ({
    phase: 'idle',
    index: 0,
    states: notes.map(() => 'todo'),
    arcade: startArcade(),
    judged: 0,
    grade: null,
    failedBar: null,
  })
  const [view, setView] = useState<View>(idle)

  // Spec §1.3: the band is the clock. Each bar is anchored when it is heard; at the song's end
  // (bar === bars) the band stops itself.
  const band = useSongBand(config, (bar) => {
    if (bar < bars) runtime.get()?.anchor.sync(audio.now())
  })

  const start = () => {
    scoring.restart()
    const judge = new TabJudge(
      notes.map((n) => ({
        midi: n.note.midi,
        startMs: n.startBeat * beat,
        durationMs: n.beats * beat,
      })),
      { toleranceCents: settings.toleranceCents, a4: settings.a4 },
    )
    runtime.set({ judge, anchor: new BeatAnchor(barMs), arcade: startArcade(), frozenAt: null })
    setView({ ...idle(), phase: 'running' })
    band.start()
  }
  const stop = () => {
    runtime.set(null)
    band.stop()
    setView(idle())
  }

  const onHeard: HeardListener = (freq, timeMs) => {
    const rt = runtime.get()
    if (!rt || rt.frozenAt !== null || rt.judge.done) return
    const origin = rt.anchor.originMs
    // Nothing to judge against until the band's first bar has been heard.
    if (origin === null) return
    const judged = rt.judge.push(freq, timeMs - (origin + countInBeats * beat))
    if (judged.length === 0) return

    let arcade = rt.arcade
    const grades = new Map<number, Grade>()
    for (const j of judged) {
      const step = scoreNote(arcade, j, mode)
      arcade = step.state
      grades.set(j.index, step.grade)
      scoring.record({ correct: step.grade !== 'miss', points: step.points })
    }
    rt.arcade = arcade

    let phase: Phase = 'running'
    let failedBar: number | null = null
    if (arcade.failed) {
      phase = 'failed'
      rt.frozenAt = (timeMs - origin) / beat
      const heardBar = Math.floor((timeMs - origin) / barMs) - COUNT_IN_BARS + 1
      failedBar = Math.min(bars, Math.max(1, heardBar))
      band.stop()
    } else if (rt.judge.done) {
      // The results show now; the band plays out its last bar and stops itself.
      phase = 'done'
      onFinished()
    }
    const last = judged[judged.length - 1].index
    setView((v) => ({
      phase,
      failedBar,
      arcade,
      index: rt.judge.current,
      judged: v.judged + judged.length,
      grade: grades.get(last) ?? null,
      states: v.states.map((s, k) => grades.get(k) ?? s),
    }))
  }
  useEffect(() => audio.listen(onHeard))

  /** Beats since the count-in started; the highway reads it on every frame. */
  const position = () => {
    const rt = runtime.get()
    if (!rt) return 0
    if (rt.frozenAt !== null) return rt.frozenAt
    const origin = rt.anchor.originMs
    return origin === null ? 0 : (audio.now() - origin) / beat
  }

  const { arcade } = view
  const current = view.phase === 'running' ? notes[view.index] : undefined
  const currentName = current && `${current.tab} (${noteName(current.note.midi, spelling)})`
  const over = view.phase === 'done' || view.phase === 'failed'
  const highlights = new Map<string, Highlight>()
  if (audio.detectedMidi !== null) {
    for (const n of findNotes(harp, audio.detectedMidi)) highlights.set(noteId(n), 'detected')
  }
  if (current) highlights.set(noteId(current.note), 'target')

  const headline = currentName
    ? `Next: ${currentName}`
    : view.phase === 'done'
      ? `${starText(stars(arcade.score, max))} Score ${fmt(arcade.score)}${
          scoring.newBest ? ' · 🏆 New best!' : ''
        }`
      : view.phase === 'failed'
        ? `Song failed at bar ${view.failedBar} of ${bars}`
        : `${track.title} · ${Math.round(bpm)} BPM · ${bars} bars`
  const { perfect, good, miss } = arcade.counts
  const detail = over
    ? `Perfect ${perfect} · Good ${good} · Miss ${miss} · Longest streak ${arcade.longest}`
    : current && `Note ${view.index + 1} of ${notes.length}`
  const spoken = [view.grade && GRADE_WORDS[view.grade], currentName && `Next: ${currentName}`]
    .filter(Boolean)
    .join('. ')

  return (
    <>
      {audio.error && <MicErrorNotice kind={audio.error} />}
      <div className={styles.scoreRow} role="group" aria-label="Score">
        <span>
          Score <strong>{fmt(arcade.score)}</strong>
        </span>
        <span>×{multiplier(arcade.combo)}</span>
        <span>Combo {arcade.combo}</span>
        {mode === 'scored' && <span>Best {scoring.best === null ? '—' : fmt(scoring.best)}</span>}
        <span className={styles.meterBox}>
          <span className={styles.meterLabel}>Rock meter {arcade.meter}%</span>
          <span
            role="meter"
            aria-label="Rock meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={arcade.meter}
            className={styles.meter}
            data-level={meterLevel(arcade.meter)}
          >
            <span className={styles.meterFill} style={{ width: `${arcade.meter}%` }} />
          </span>
        </span>
      </div>
      <Stage
        controls={
          <>
            {/* The primary action always comes first. */}
            {view.phase !== 'running' &&
              !audio.error &&
              (audio.status === 'listening' ? (
                <button type="button" className={gameStyles.primary} onClick={start}>
                  {view.phase === 'failed'
                    ? '↻ Retry'
                    : view.phase === 'done'
                      ? '▶ Again'
                      : '▶ Start'}
                </button>
              ) : (
                <p className={gameStyles.hint}>Waiting for microphone…</p>
              ))}
            {view.phase === 'running' && (
              <button type="button" onClick={stop}>
                ■ Stop
              </button>
            )}
          </>
        }
        headline={headline}
        result={view.phase === 'done' ? 'ok' : view.phase === 'failed' ? 'bad' : undefined}
        detail={detail}
      />
      <p className={styles.grade} aria-hidden>
        {view.grade && (
          <span key={view.judged} data-grade={view.grade}>
            {GRADE_WORDS[view.grade]}
          </span>
        )}
      </p>
      <p className="visually-hidden" aria-live="polite">
        {view.phase === 'running' ? spoken : ''}
      </p>
      <HarmonicaDiagram
        harp={harp}
        spelling={spelling}
        labelMode={settings.labelMode}
        showAdvanced={settings.showAdvanced}
        highlights={highlights}
        header={
          <Highway
            notes={notes}
            countInBeats={countInBeats}
            totalBars={bars}
            beatsPerBar={TRACK_BEATS_PER_BAR}
            barsPerChorus={BARS_PER_CHORUS}
            states={view.states}
            position={position}
          />
        }
      />
    </>
  )
}
