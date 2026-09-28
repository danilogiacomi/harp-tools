import { Fragment, useEffect, useState } from 'react'
import type { PitchListener } from '../../../audio/pitch/PitchDetector'
import { findNotes, tabLabel } from '../../../core/harmonica/harp'
import { noteName } from '../../../core/music/noteNames'
import { freqToMidi } from '../../../core/music/pitch'
import { HoldTracker, analyzeHold, type HoldStats } from '../../../core/tone/analysis'
import { ToneHistory } from '../../../core/tone/history'
import { AudioGate } from '../../components/AudioGate'
import { MicFeed } from '../../components/MicFeed'
import { TabText } from '../../components/TabText'
import gameStyles from '../../components/game/Game.module.css'
import { useHarp, useSpelling } from '../../hooks/useHarp'
import { usePracticeTimer } from '../../hooks/usePracticeTimer'
import { useSettings } from '../../settings/SettingsContext'
import { ToneChart } from './ToneChart'
import styles from './ToneMeterPage.module.css'

/** How often the stats panel refreshes: a readable rate, far below the mic's 60 per second. */
export const STATS_REFRESH_MS = 250

export function ToneMeterPage() {
  usePracticeTimer('tone')
  return (
    <>
      <h1>Tone &amp; breath meter</h1>
      <p className={gameStyles.intro}>
        Hold a note and watch how steady your pitch and breath are. Vibrato shows up after a second.
      </p>
      <AudioGate>
        <ToneMeter />
      </AudioGate>
    </>
  )
}

interface View {
  stats: HoldStats | null
  /** The note is still sounding (not just the last one heard). */
  active: boolean
}

const perfNow = () => performance.now()

export function ToneMeter({ now = perfNow }: { now?: () => number }) {
  const { settings } = useSettings()
  const harp = useHarp()
  const spelling = useSpelling()
  const [history] = useState(() => new ToneHistory())
  const [tracker] = useState(() => new HoldTracker())
  const [view, setView] = useState<View>({ stats: null, active: false })

  // Every mic frame lands here, outside render, and only updates the buffers.
  const onReading: PitchListener = (reading) => {
    const tMs = now()
    if (!reading) {
      history.push({ tMs, cents: null, db: null })
      return
    }
    const { midi, cents } = freqToMidi(reading.freq, settings.a4)
    const db = 20 * Math.log10(Math.max(reading.rms, 1e-6))
    history.push({ tMs, cents, db })
    tracker.push({ tMs, cents, midi, db })
  }

  useEffect(() => {
    const id = setInterval(
      () => setView({ stats: analyzeHold(tracker.hold), active: tracker.isActive(now()) }),
      STATS_REFRESH_MS,
    )
    return () => clearInterval(id)
  }, [tracker, now])

  const { stats } = view
  const tabs = stats ? findNotes(harp, stats.midi).map(tabLabel) : []
  const dash = '–'
  const vibrato = !stats
    ? dash
    : !stats.vibratoReady
      ? 'Hold for 1 s…'
      : stats.vibrato
        ? `${stats.vibrato.rateHz.toFixed(1)} Hz · ${Math.round(stats.vibrato.depthCents)}¢`
        : 'None'

  return (
    <>
      <MicFeed onReading={onReading} />
      <ToneChart history={history} now={now} />
      <dl className={styles.stats} aria-label="Held note" data-active={view.active || undefined}>
        <dt>Note</dt>
        <dd>
          {stats ? (
            <>
              {noteName(stats.midi, spelling)}{' '}
              {tabs.length > 0 ? (
                <span>
                  (
                  {tabs.map((t, i) => (
                    <Fragment key={t}>
                      {i > 0 && ' or '}
                      <TabText tab={t} />
                    </Fragment>
                  ))}
                  )
                </span>
              ) : (
                '(not on this harp)'
              )}
            </>
          ) : (
            dash
          )}
        </dd>
        <dt>Hold time</dt>
        <dd>{stats ? `${(stats.holdMs / 1000).toFixed(1)} s` : dash}</dd>
        <dt>Pitch steadiness</dt>
        <dd>{stats ? `±${stats.pitchSigma.toFixed(1)}¢` : dash}</dd>
        <dt>Average level</dt>
        <dd>{stats ? `${Math.round(stats.meanDb)} dB` : dash}</dd>
        <dt>Level steadiness</dt>
        <dd>{stats ? `±${stats.dbSigma.toFixed(1)} dB` : dash}</dd>
        <dt>Vibrato</dt>
        <dd>{vibrato}</dd>
      </dl>
      <p className={gameStyles.hint}>
        Steadiness is the spread (σ) over the note you're holding: lower is steadier.
      </p>
    </>
  )
}
