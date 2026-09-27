import { HOME_GROUPS, entryHref, type HomeEntry } from './homeGroups'
import styles from './HomePage.module.css'

function CardList({ label, cards }: { label: string; cards: readonly HomeEntry[] }) {
  return (
    <ul className={styles.cards} aria-label={label}>
      {cards.map((c) => (
        <li key={c.id}>
          <a href={entryHref(c)} className={styles.card}>
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
        Pick your harp's key and tuning at the top — everything on the site follows them.
      </p>
      {HOME_GROUPS.filter((g) => g.entries.length > 0).map((g) => (
        <section key={g.id} aria-labelledby={`home-${g.id}`}>
          <h2 id={`home-${g.id}`}>{g.title}</h2>
          <CardList label={g.title} cards={g.entries} />
        </section>
      ))}
    </>
  )
}
