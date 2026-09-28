import { useMemo, useState } from 'react'
import {
  ReedMeasure,
  healthReeds,
  summarizeHealth,
  type MeasureState,
  type Reed,
} from '../../../core/health/healthCheck'
import { localDate } from '../../../core/log/dates'
import { noteName } from '../../../core/music/noteNames'
import { AudioGate } from '../../components/AudioGate'
import { MicErrorNotice } from '../../components/MicErrorNotice'
import { Stage } from '../../components/game/Stage'
import gameStyles from '../../components/game/Game.module.css'
import { healthId, loadHealth, saveHealth } from '../../health/healthStore'
import { useHarp, useSpelling } from '../../hooks/useHarp'
import { usePitch } from '../../hooks/usePitch'
import { usePracticeTimer } from '../../hooks/usePracticeTimer'
import { Slot } from '../../hooks/useSlot'
import { A4_RANGE, browserStorage } from '../../settings/settings'
import { useSettings } from '../../settings/SettingsContext'
import { formatCents, tuneQuality } from '../tuner/tunerMath'
import styles from './HealthCheckPage.module.css'

export function HealthCheckPage() {
  usePracticeTimer('health')
  return (
    <>
      <h1>Harp health check</h1>
      <p className={gameStyles.intro}>
        Play every hole, blow and draw, one at a time. Each reed is measured once you hold it
        steadily for a second.
      </p>
      <AudioGate>
        <HealthCheck />
      </AudioGate>
    </>
  )
}

interface Props {
  /** The readings' clock (performance.now() in the app; a fake one in tests). */
  now?: () => number
  storage?: Storage | null
}

const perfNow = () => performance.now()

export function HealthCheck({ now = perfNow, storage = browserStorage() }: Props) {
  const { settings } = useSettings()
  // A new key, tuning or reference pitch makes every measurement so far meaningless.
  return (
    <HealthRun
      key={[settings.key, settings.tuning, settings.a4].join('|')}
      now={now}
      storage={storage}
    />
  )
}

const TECHNIQUES = ['blow', 'draw'] as const
const HOLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const WAITING: MeasureState = { status: 'waiting', progress: 0, cents: null, result: null }
const sameShown = (a: MeasureState, b: MeasureState) =>
  a.status === b.status && a.progress === b.progress && a.cents === b.cents

function HealthRun({ now, storage }: Required<Props>) {
  const { settings, update } = useSettings()
  const harp = useHarp()
  const reeds = useMemo(() => healthReeds(harp), [harp])
  const spelling = useSpelling()
  const id = healthId(settings.key, settings.tuning)
  const [previous] = useState(() => loadHealth(storage, id))
  const [step, setStep] = useState(0)
  const [results, setResults] = useState<(number | null)[]>(() => reeds.map(() => null))
  const [live, setLive] = useState<MeasureState>(WAITING)
  const [measure] = useState(() => {
    const slot = new Slot<ReedMeasure>()
    slot.set(new ReedMeasure(reeds[0].midi, settings.a4))
    return slot
  })
  const finished = step >= reeds.length

  /** Moves to reed `next`; the first reed may start at once, later ones after a silence. */
  const goTo = (next: number, values: (number | null)[]) => {
    setStep(next)
    setLive(WAITING)
    if (next < reeds.length) {
      measure.set(new ReedMeasure(reeds[next].midi, settings.a4, { afterSilence: next > 0 }))
      return
    }
    measure.set(null)
    if (values.some((c) => c !== null)) {
      saveHealth(storage, id, { date: localDate(Date.now()), a4: settings.a4, cents: values })
    }
  }
  const record = (value: number | null) => {
    const values = results.map((c, i) => (i === step ? value : c))
    setResults(values)
    goTo(step + 1, values)
  }

  const pitch = usePitch(!finished, (reading) => {
    const m = measure.get()
    if (!m) return
    const before = m.state
    const state = m.push(reading?.freq ?? null, now())
    // Frames arrive 60 times a second: only re-render when something shown changes.
    if (!sameShown(before, state)) setLive(state)
    if (state.status === 'done') record(state.result)
  })

  const redo = () => {
    const back = Math.max(0, step - 1)
    const values = results.map((c, i) => (i === back ? null : c))
    setResults(values)
    setLive(WAITING)
    setStep(back)
    measure.set(new ReedMeasure(reeds[back].midi, settings.a4, { afterSilence: true }))
  }
  const restart = () => {
    const values = reeds.map(() => null)
    setResults(values)
    setLive(WAITING)
    setStep(0)
    measure.set(new ReedMeasure(reeds[0].midi, settings.a4, { afterSilence: true }))
  }

  const reed: Reed | undefined = reeds[step]
  const summary = summarizeHealth(
    reeds.map((r, i) => ({ ...r, cents: results[i] })),
    settings.a4,
    A4_RANGE,
  )
  const comparable = previous !== null && previous.a4 === settings.a4
  const indexOf = (hole: number, technique: Reed['technique']) =>
    reeds.findIndex((r) => r.hole === hole && r.technique === technique)
  const reedName = (r: Reed) => `${r.hole} ${r.technique}`

  return (
    <>
      {pitch.error && <MicErrorNotice kind={pitch.error} />}
      <Stage
        controls={
          <>
            {finished ? (
              <button type="button" className={gameStyles.primary} onClick={restart}>
                ↺ Check again
              </button>
            ) : (
              <button type="button" onClick={() => record(null)}>
                ⏭ Skip reed
              </button>
            )}
            <button type="button" onClick={redo} disabled={step === 0}>
              🔁 Redo reed
            </button>
            {!finished && (
              <button type="button" onClick={restart}>
                ↺ Restart
              </button>
            )}
          </>
        }
        headline={
          reed
            ? `Play hole ${reed.hole} ${reed.technique} (${noteName(reed.midi, spelling)})`
            : '✓ Check complete'
        }
        result={finished ? 'ok' : undefined}
        progress={finished ? undefined : live.progress}
        detail={
          finished
            ? `${summary.measured} of ${reeds.length} reeds measured.`
            : pitch.status === 'starting'
              ? 'Waiting for microphone permission…'
              : live.cents !== null
                ? `${formatCents(live.cents)} — hold it steady`
                : step > 0 && live.status === 'waiting'
                  ? 'Stop, then play the next reed.'
                  : 'Reed ' + (step + 1) + ' of ' + reeds.length
        }
      />
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className={styles.caption}>
            Cents off per reed
            {comparable && ` · Δ against the previous check (${previous.date})`}
          </caption>
          <thead>
            <tr>
              <th scope="col">Hole</th>
              {HOLES.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TECHNIQUES.map((technique) => (
              <tr key={technique}>
                <th scope="row">{technique === 'blow' ? 'Blow' : 'Draw'}</th>
                {HOLES.map((hole) => {
                  const i = indexOf(hole, technique)
                  const cents = i >= 0 ? results[i] : null
                  const before = comparable && i >= 0 ? previous.cents[i] : null
                  return (
                    <td
                      key={hole}
                      className={styles.cell}
                      data-quality={cents === null ? undefined : tuneQuality(cents)}
                      data-current={i === step || undefined}
                    >
                      <span>{cents === null ? '–' : formatCents(cents)}</span>
                      <small className={styles.delta}>
                        {cents !== null && before !== null && `Δ ${formatCents(cents - before)}`}
                      </small>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.summary} aria-label="Summary">
        <p>
          {summary.averageCents === null
            ? 'Play each reed to see a summary.'
            : `Average offset ${formatCents(summary.averageCents)}.`}
          {summary.worst.length > 0 &&
            ` Most out of tune: ${summary.worst.map((r) => `${reedName(r)} (${formatCents(r.cents ?? 0)})`).join(', ')}.`}
        </p>
        <p>
          {summary.suggestedA4 !== null && (
            <>
              Your harp seems to be tuned to A4 = {summary.suggestedA4} Hz.{' '}
              <button
                type="button"
                onClick={() => update({ a4: summary.suggestedA4 ?? settings.a4 })}
              >
                Use {summary.suggestedA4} Hz
              </button>
            </>
          )}
        </p>
        <p className={gameStyles.hint}>
          ±5–10 cents is normal. Many harps use compromise tuning: the 3rds and 5ths of their chords
          are deliberately a little off, so the chords sound sweeter.
        </p>
      </div>
    </>
  )
}
