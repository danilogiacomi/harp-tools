import styles from './HomePage.module.css'

interface Card {
  href: string
  icon: string
  title: string
  text: string
}

const TOOLS: Card[] = [
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

const GAMES: Card[] = [
  { href: '#/echo', icon: '👂', title: 'Echo the note', text: 'Hear a note, then play it back.' },
  {
    href: '#/bend',
    icon: '〰️',
    title: 'Bend trainer',
    text: 'Hit and hold a target bend on a live meter.',
  },
  {
    href: '#/scales',
    icon: '🪜',
    title: 'Scale runner',
    text: 'Scales in 1st, 2nd and 3rd position.',
  },
  {
    href: '#/intervals',
    icon: '🎼',
    title: 'Interval training',
    text: 'Name or play the interval you hear.',
  },
  {
    href: '#/melody',
    icon: '🔁',
    title: 'Melody echo',
    text: 'Repeat phrases that grow as you improve.',
  },
]

function CardList({ label, cards }: { label: string; cards: Card[] }) {
  return (
    <ul className={styles.cards} aria-label={label}>
      {cards.map((c) => (
        <li key={c.href}>
          <a href={c.href} className={styles.card}>
            <span className={styles.icon} aria-hidden>
              {c.icon}
            </span>
            <strong>{c.title}</strong>
            <span className={styles.text}>{c.text}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

export function HomePage() {
  return (
    <>
      <h1 className={styles.title}>Practice tools for diatonic harmonica</h1>
      <p className={styles.lead}>
        Pick your harp's key at the top — everything on the site follows it.
      </p>

      <h2>Tools</h2>
      <CardList label="Tools" cards={TOOLS} />

      <h2>Games</h2>
      <CardList label="Games" cards={GAMES} />
    </>
  )
}
