import { useEffect, useMemo, useState } from 'react'
import {
  GRADE_POINTS,
  RHYTHM_PATTERNS,
  RhythmSession,
  averageOffset,
  bpmBucket,
  patternById,
  type Grade,
  type PatternId,
  type RhythmHit,
  type RhythmPattern,
} from '../../../core/rhythm/rhythmTrainer'
import { isFinished, type GameMode } from '../../../core/games/session'
import { TIME_SIGNATURES, type MetronomeConfig } from '../../../core/rhythm/schedule'
import { BPM_MAX, BPM_MIN, clampBpm } from '../../../core/rhythm/tempo'
import { MicErrorNotice } from '../../components/MicErrorNotice'
import { GameLayout } from '../../components/game/GameLayout'
import { ModeToggle } from '../../components/game/ModeToggle'
import { PlayAgain, ScorePanel } from '../../components/game/ScorePanel'
import { Stage } from '../../components/game/Stage'
import styles from '../../components/game/Game.module.css'
import { useGameAudio, type GameAudio, type HeardListener } from '../../hooks/useGameAudio'
import { useMetronome } from '../../hooks/useMetronome'
import { usePracticeTimer } from '../../hooks/usePracticeTimer'
import { useScoring } from '../../hooks/useScoring'
import { useSlot } from '../../hooks/useSlot'
import { bestScoreKey } from '../../scores/bestScores'
import { useSettings } from '../../settings/SettingsContext'
import rhythmStyles from './RhythmTrainerPage.module.css'

/** Spec §9: one count-in bar, then 8 scored bars. */
export const SCORED_BARS = 8
const SHOWN_HITS = 8

export function RhythmTrainerPage() {
  usePracticeTimer('rhythm')
  return (
    <GameLayout
      title="Rhythm trainer"
      intro="Play any note on every hit of the pattern, in time with the metronome. Pitch doesn't matter."
    >
      <RhythmGame />
    </GameLayout>
  )
}

export function RhythmGame() {
  const { settings, update } = useSettings()
  // Owned here, not by the keyed run, so a settings change doesn't restart the mic.
  const audio = useGameAudio(true)
  const [mode, setMode] = useState<GameMode>('practice')
  const [patternId, setPatternId] = useState<PatternId>('quarters')
  const runKey = [mode, patternId, settings.bpm, settings.a4].join('|')
  return (
    <>
      <div className={styles.toolbar}>
        <ModeToggle mode={mode} onChange={setMode} />
        <label className={styles.field}>
          Pattern
          <select
            aria-label="Pattern"
            value={patternId}
            onChange={(e) => setPatternId(e.target.value as PatternId)}
          >
            {RHYTHM_PATTERNS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Tempo
          <input
            type="range"
            min={BPM_MIN}
            max={BPM_MAX}
            step={1}
            value={settings.bpm}
            onChange={(e) => update({ bpm: clampBpm(Number(e.target.value)) })}
          />
          <span>{settings.bpm} BPM</span>
        </label>
      </div>
      <RhythmRun key={runKey} audio={audio} mode={mode} pattern={patternById(patternId)} />
    </>
  )
}

interface View {
  phase: 'idle' | 'running' | 'done'
  hits: RhythmHit[]
}

const IDLE: View = { phase: 'idle', hits: [] }

const GRADE_LABEL: Record<Grade, string> = {
  perfect: 'Perfect',
  good: 'Good',
  off: 'Off',
  miss: 'Miss',
}

const signed = (ms: number) => `${ms > 0 ? '+' : ''}${Math.round(ms)} ms`

/** "Perfect", "Good · 70 ms late", "Off · 180 ms early", "Miss". */
function describeHit(hit: RhythmHit): string {
  if (hit.offsetMs === null || hit.grade === 'perfect') return GRADE_LABEL[hit.grade]
  const ms = Math.round(Math.abs(hit.offsetMs))
  return `${GRADE_LABEL[hit.grade]} · ${ms} ms ${hit.offsetMs > 0 ? 'late' : 'early'}`
}

interface RunProps {
  audio: GameAudio
  mode: GameMode
  pattern: RhythmPattern
}

function RhythmRun({ audio, mode, pattern }: RunProps) {
  const { settings } = useSettings()
  const totalHits = SCORED_BARS * pattern.onsets.length
  const scoring = useScoring(
    mode,
    bestScoreKey('rhythm', { pattern: pattern.id, bpm: bpmBucket(settings.bpm) }),
    totalHits,
    GRADE_POINTS.perfect,
  )
  const metronomeConfig = useMemo<MetronomeConfig>(
    () => ({ bpm: settings.bpm, signature: TIME_SIGNATURES[2], subdivision: 1 }),
    [settings.bpm],
  )
  const metronome = useMetronome(metronomeConfig)
  const slot = useSlot<RhythmSession>()
  const [view, setView] = useState<View>(IDLE)

  const start = () => {
    if (mode === 'scored') scoring.restart()
    slot.set(
      new RhythmSession({
        pattern,
        bpm: settings.bpm,
        countInBars: 1,
        bars: mode === 'scored' ? SCORED_BARS : null,
        a4: settings.a4,
      }),
    )
    setView({ ...IDLE, phase: 'running' })
    if (!metronome.running) metronome.toggle()
  }
  const finish = (phase: View['phase']) => {
    slot.set(null)
    if (metronome.running) metronome.toggle()
    setView((v) => ({ ...v, phase }))
  }

  const onHeard: HeardListener = (freq, timeMs) => {
    const session = slot.get()
    if (!session) return
    if (metronome.lastBeatMs !== null) session.syncBeat(metronome.lastBeatMs)
    const hits = session.push(freq, timeMs)
    if (hits.length === 0) return
    for (const h of hits)
      scoring.record({ correct: h.grade !== 'miss', points: GRADE_POINTS[h.grade] })
    setView((v) => ({ ...v, hits: [...v.hits, ...hits] }))
    if (session.done) finish('done')
  }
  useEffect(() => audio.listen(onHeard))

  const last = view.hits.at(-1)
  const shown = view.hits.slice(-SHOWN_HITS)
  const average = averageOffset(mode === 'practice' ? shown : view.hits)
  const bar = last ? last.bar + 1 : 0

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
            {view.phase === 'running' && (
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
          view.phase === 'running' && !last
            ? 'Count-in: listen to one bar, then play'
            : last &&
              `${describeHit(last)}${mode === 'scored' ? ` · +${GRADE_POINTS[last.grade]}` : ''}`
        }
        result={last ? (last.grade === 'miss' || last.grade === 'off' ? 'bad' : 'ok') : undefined}
        detail={
          <>
            {mode === 'scored' &&
              view.phase === 'running' &&
              `Bar ${Math.max(1, bar)} of ${SCORED_BARS}`}
            {mode === 'practice' &&
              average !== null &&
              `You're ${Math.round(Math.abs(average))} ms ${average > 0 ? 'late' : 'early'} on average`}
          </>
        }
      />
      <ol className={rhythmStyles.bar} aria-label="Pattern">
        {pattern.onsets.map((beat) => (
          <li
            key={beat}
            className={rhythmStyles.onset}
            style={{ left: `${(beat / 4) * 100}%` }}
            data-accent={pattern.accents.includes(beat) || undefined}
            data-now={
              metronome.beat !== null && Math.floor(beat) === metronome.beat ? 'true' : undefined
            }
          >
            <span className="visually-hidden">Beat {Math.round(beat * 100) / 100 + 1}</span>
          </li>
        ))}
      </ol>
      <ol className={rhythmStyles.hits} aria-label="Last hits">
        {Array.from({ length: SHOWN_HITS }, (_, i) => {
          const hit = shown[i]
          return (
            <li key={i} className={rhythmStyles.hit} data-grade={hit?.grade}>
              {hit ? (hit.offsetMs === null ? '✗' : signed(hit.offsetMs)) : '·'}
            </li>
          )
        })}
      </ol>
    </>
  )
}
