import { useEffect, useMemo, useState } from 'react'
import {
  BEND_LIMIT_MS,
  bendDepth,
  bendPoints,
  bendRoundConfig,
  maxBendSteps,
  unbentNote,
} from '../../../core/games/bendTrainer'
import { ListenRound, type ListenRoundState } from '../../../core/games/listenRound'
import {
  DEFAULT_POOL_FILTER,
  buildPool,
  poolLabel,
  type PoolFilter,
} from '../../../core/games/notePool'
import { pickOne, type Rng } from '../../../core/games/random'
import { isFinished, type GameMode } from '../../../core/games/session'
import { buildHarp, findNotes, noteId, tabLabel, type HarpNote } from '../../../core/harmonica/harp'
import { keySpelling } from '../../../core/harmonica/keys'
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
import { BendMeter } from './BendMeter'

const ADVANCE_MS = 1500
const BEND_FILTER: PoolFilter = { ...DEFAULT_POOL_FILTER, groups: ['bends'] }

export function BendTrainerPage() {
  return (
    <GameLayout
      title="Bend trainer"
      intro="Bend down to the target note and hold it steady. The meter shows where your pitch is."
    >
      <BendGame />
    </GameLayout>
  )
}

export function BendGame({ rng = Math.random }: { rng?: Rng }) {
  const { settings } = useSettings()
  const [mode, setMode] = useState<GameMode>('practice')
  const [filter, setFilter] = useState<PoolFilter>(BEND_FILTER)
  const runKey = [
    mode,
    poolLabel(filter),
    settings.key,
    settings.a4,
    settings.toleranceCents,
    settings.holdMs,
  ].join('|')
  return (
    <>
      <div className={styles.toolbar}>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>
      <PoolFilterPanel filter={filter} onChange={setFilter} groups={[]} advancedToggle={false} />
      <BendRun key={runKey} mode={mode} filter={filter} rng={rng} />
    </>
  )
}

interface View {
  phase: 'idle' | 'listening' | 'result'
  target: HarpNote | null
  round: ListenRoundState | null
  points: number
}

const IDLE: View = { phase: 'idle', target: null, round: null, points: 0 }

interface RunProps {
  mode: GameMode
  filter: PoolFilter
  rng: Rng
}

function BendRun({ mode, filter, rng }: RunProps) {
  const { settings } = useSettings()
  const harp = useMemo(() => buildHarp(settings.key), [settings.key])
  const bends = useMemo(() => buildPool(harp, filter, false), [harp, filter])
  const spelling = keySpelling(settings.key)
  const scoring = useScoring(
    mode,
    bestScoreKey('bend', {
      key: settings.key,
      pool: poolLabel(filter),
      tol: settings.toleranceCents,
      hold: settings.holdMs,
    }),
  )
  const slot = useSlot<ListenRound>()
  const timeouts = useTimeouts()
  const audio = useGameAudio(true)
  const [choice, setChoice] = useState('random')
  const [view, setView] = useState<View>(IDLE)
  const [depth, setDepth] = useState<number | null>(null)

  const nextTarget = (previous: HarpNote | null): HarpNote => {
    const picked = mode === 'practice' ? bends.find((b) => noteId(b) === choice) : undefined
    if (picked) return picked
    const others =
      previous && bends.length > 1 ? bends.filter((b) => noteId(b) !== noteId(previous)) : bends
    return pickOne(others, rng)
  }

  const startRound = (previous: HarpNote | null) => {
    timeouts.clear()
    const target = nextTarget(previous)
    const matcher = { toleranceCents: settings.toleranceCents, holdMs: settings.holdMs }
    slot.set(new ListenRound(target.midi, bendRoundConfig(mode, matcher, settings.a4), audio.now()))
    setView({ ...IDLE, phase: 'listening', target })
  }

  const onHeard: HeardListener = (freq, timeMs) => {
    const target = view.target
    setDepth(
      freq === null || !target ? null : bendDepth(freq, unbentNote(harp, target).midi, settings.a4),
    )
    const round = slot.get()
    if (!round) return
    const state = round.push(freq, timeMs)
    if (state.status === 'listening') {
      setView((v) => ({ ...v, round: state }))
      return
    }
    slot.set(null)
    const points = bendPoints(state)
    const session = scoring.record({ correct: state.status === 'hit', points })
    setView((v) => ({ ...v, phase: 'result', round: state, points }))
    if (!isFinished(session)) timeouts.after(ADVANCE_MS, () => startRound(target))
  }
  useEffect(() => audio.listen(onHeard))

  const stop = () => {
    timeouts.clear()
    slot.set(null)
    setView(IDLE)
  }
  const restart = () => {
    scoring.restart()
    startRound(null)
  }

  if (bends.length === 0) {
    return (
      <p role="alert" className="notice">
        These holes have no bends. Draw bends are on holes 1–4 and 6, blow bends on 8–10.
      </p>
    )
  }

  const label = (n: HarpNote) => `${tabLabel(n)} ${noteName(n.midi, spelling)}`
  const target = view.target
  const meterNotes = target
    ? [
        unbentNote(harp, target),
        ...Array.from({ length: maxBendSteps(harp, target) }, (_, i) =>
          harp.find(
            (n) =>
              n.hole === target.hole && n.technique === target.technique && n.bendSteps === i + 1,
          )!,
        ),
      ]
    : []

  const highlights = new Map<string, Highlight>()
  if (audio.detectedMidi !== null) {
    for (const n of findNotes(harp, audio.detectedMidi)) highlights.set(noteId(n), 'detected')
  }
  const hit = view.round?.status === 'hit'
  if (target) highlights.set(noteId(target), view.phase === 'result' && hit ? 'correct' : 'target')
  const secondsLeft = Math.max(0, Math.ceil((BEND_LIMIT_MS - (view.round?.elapsedMs ?? 0)) / 1000))

  return (
    <>
      {audio.error && <MicErrorNotice kind={audio.error} />}
      <ScorePanel scoring={scoring} onRestart={restart} />
      {mode === 'practice' && (
        <div className={styles.toolbar}>
          <label className={styles.field}>
            Target
            <select aria-label="Target" value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value="random">Random</option>
              {bends.map((b) => (
                <option key={noteId(b)} value={noteId(b)}>
                  {tabLabel(b)} — {noteName(b.midi, spelling)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className={styles.stage}>
        {view.phase === 'idle' && !audio.error && (
          <button type="button" className={styles.primary} onClick={() => startRound(null)}>
            ▶ Start
          </button>
        )}
        {target && view.phase !== 'idle' && (
          <>
            <p className={styles.prompt}>
              Bend to {tabLabel(target)} ({noteName(target.midi, spelling)})
            </p>
            <div className={styles.actions}>
              <button type="button" onClick={() => void audio.playSequence([target.midi])}>
                🔊 Hear target
              </button>
              {!isFinished(scoring.session) && (
                <button type="button" onClick={stop}>
                  ■ Stop
                </button>
              )}
            </div>
            <BendMeter labels={meterNotes.map(label)} target={target.bendSteps} depth={depth} />
          </>
        )}
        {view.phase === 'listening' && (
          <>
            <HoldMeter progress={view.round?.progress ?? 0} />
            {mode === 'scored' && <p className={styles.hint}>{secondsLeft} s left</p>}
          </>
        )}
        {view.phase === 'result' && (
          <p className={styles.feedback} data-result={hit ? 'ok' : 'bad'}>
            {hit
              ? `✓ Got it — stability ${Math.round((view.round?.stability ?? 0) * 100)}%`
              : "✗ Time's up"}
            {mode === 'scored' && hit && ` · +${view.points}`}
          </p>
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
