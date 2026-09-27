import { useState } from 'react'
import {
  HARP_KEYS,
  keyForPitchClass,
  keySpelling,
  type HarpKey,
} from '../../../core/harmonica/keys'
import { PITCH_CLASSES } from '../../../core/games/noteQuiz'
import {
  POSITION_INFO,
  harpForPosition,
  positionLabel,
  positionTonicPc,
} from '../../../core/harmonica/positions'
import { tuningById } from '../../../core/harmonica/tunings'
import { pitchClassName } from '../../../core/music/noteNames'
import { usePracticeTimer } from '../../hooks/usePracticeTimer'
import { useSettings } from '../../settings/SettingsContext'
import styles from './PositionsPage.module.css'

type Style = 'major' | 'blues' | 'minor' | 'naturalMinor' | 'all'

const STYLES: readonly { id: Style; label: string; position: number | null }[] = [
  { id: 'major', label: 'Major / folk', position: 1 },
  { id: 'blues', label: 'Blues / rock', position: 2 },
  { id: 'minor', label: 'Minor', position: 3 },
  { id: 'naturalMinor', label: 'Natural minor', position: 4 },
  { id: 'all', label: 'Show all', position: null },
]

/** Offered when the style is "Show all". */
const MOST_PLAYED = [1, 2, 3]

const infoFor = (position: number) => POSITION_INFO.find((i) => i.position === position)!

export function PositionsPage() {
  usePracticeTimer('positions', { requireAudio: false })
  const { settings } = useSettings()
  return (
    <>
      <h1>Positions &amp; keys</h1>
      <p className={styles.intro}>
        Which harp to grab for a song, and what each harp plays in each position.
      </p>
      {settings.tuning !== 'richter' && (
        <p className={styles.intro}>
          Positions are shown for a Richter harp; your harp is tuned{' '}
          {tuningById(settings.tuning).name}, so what each position actually plays may differ.
        </p>
      )}
      <div className={styles.panels}>
        <SongPanel />
        <HarpPanel />
      </div>
    </>
  )
}

function SongPanel() {
  const [tonic, setTonic] = useState(7) // G
  const [style, setStyle] = useState<Style>('blues')
  const chosen = STYLES.find((s) => s.id === style)?.position ?? null
  const harpFor = (position: number) => harpForPosition(tonic, position)

  const recommendation =
    chosen === null
      ? `Most played: ${MOST_PLAYED.map((p) => `${harpFor(p)} harp (${positionLabel(p)})`).join(' · ')}`
      : `Use a ${harpFor(chosen)} harp — ${positionLabel(chosen)} position (${infoFor(chosen).mode})`

  return (
    <section className={styles.panel} aria-labelledby="song-heading">
      <h2 id="song-heading">I have a song in…</h2>
      <div className={styles.fields}>
        <label className={styles.field}>
          Key
          <select
            aria-label="Song key"
            value={tonic}
            onChange={(e) => setTonic(Number(e.target.value))}
          >
            {PITCH_CLASSES.map((pc) => (
              <option key={pc} value={pc}>
                {keyForPitchClass(pc)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Style
          <select
            aria-label="Style"
            value={style}
            onChange={(e) => setStyle(e.target.value as Style)}
          >
            {STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className={styles.recommendation} data-testid="recommendation">
        {recommendation}
      </p>
      <table className={styles.table}>
        <caption>Every position for a song in {keyForPitchClass(tonic)}</caption>
        <thead>
          <tr>
            <th scope="col">Position</th>
            <th scope="col">Harp</th>
            <th scope="col">Mode</th>
            <th scope="col">Typical use</th>
          </tr>
        </thead>
        <tbody>
          {POSITION_INFO.map((info) => (
            <tr
              key={info.position}
              data-recommended={info.position === chosen ? 'true' : undefined}
            >
              <th scope="row">{positionLabel(info.position)}</th>
              <td>{harpFor(info.position)} harp</td>
              <td>{info.mode}</td>
              <td>{info.use ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function HarpPanel() {
  const { settings } = useSettings()
  // Starts at the header key and follows it when it changes; a local pick doesn't touch it.
  const [choice, setChoice] = useState({ harp: settings.key, headerKey: settings.key })
  if (choice.headerKey !== settings.key) {
    setChoice({ harp: settings.key, headerKey: settings.key })
  }
  const harp = choice.harp
  const spelling = keySpelling(harp)
  const summary = POSITION_INFO.map(
    (info) =>
      `${positionLabel(info.position)} ${pitchClassName(positionTonicPc(harp, info.position), spelling)} ${info.short}`,
  ).join(' · ')

  return (
    <section className={styles.panel} aria-labelledby="harp-heading">
      <h2 id="harp-heading">I have a … harp</h2>
      <div className={styles.fields}>
        <label className={styles.field}>
          Harp
          <select
            aria-label="Harp"
            value={harp}
            onChange={(e) => setChoice((c) => ({ ...c, harp: e.target.value as HarpKey }))}
          >
            {HARP_KEYS.map((k) => (
              <option key={k} value={k}>
                {k} harp
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className={styles.summary} data-testid="harp-summary">
        <strong>{harp} harp:</strong> {summary}
      </p>
    </section>
  )
}
