import styles from './HomePage.module.css'

const TOOLS = [
  {
    href: '#/tuner',
    icon: '🎯',
    title: 'Tuner',
    text: 'See which hole and technique you are playing, or hear any note on your harp.',
  },
  {
    href: '#/metronome',
    icon: '🥁',
    title: 'Metronome',
    text: 'Steady time with tap tempo, accents and subdivisions.',
  },
]

const GAMES = [
  { icon: '👂', title: 'Echo the note', text: 'Hear a note, then play it back.' },
  { icon: '〰️', title: 'Bend trainer', text: 'Hit and hold a target bend on a live meter.' },
  { icon: '🪜', title: 'Scale runner', text: 'Scales in 1st, 2nd and 3rd position.' },
  { icon: '🎼', title: 'Interval training', text: 'Name or play the interval you hear.' },
  { icon: '🔁', title: 'Melody echo', text: 'Repeat phrases that grow as you improve.' },
]

export function HomePage() {
  return (
    <>
      <h1 className={styles.title}>Practice tools for diatonic harmonica</h1>
      <p className={styles.lead}>
        Pick your harp's key at the top — everything on the site follows it.
      </p>

      <h2>Tools</h2>
      <ul className={styles.cards} aria-label="Tools">
        {TOOLS.map((t) => (
          <li key={t.href}>
            <a href={t.href} className={styles.card}>
              <span className={styles.icon} aria-hidden>
                {t.icon}
              </span>
              <strong>{t.title}</strong>
              <span className={styles.text}>{t.text}</span>
            </a>
          </li>
        ))}
      </ul>

      <h2>Games</h2>
      <ul className={styles.cards} aria-label="Games">
        {GAMES.map((g) => (
          <li key={g.title}>
            <div className={styles.card} data-disabled="true">
              <span className={styles.icon} aria-hidden>
                {g.icon}
              </span>
              <strong>{g.title}</strong>
              <span className={styles.text}>{g.text}</span>
              <span className={styles.badge}>Coming soon</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
