import styles from './TabText.module.css'

/** One tab token (`-3'`, `6o`, `_`) in the site's tab style: monospace, never wrapped. */
export function TabText({ tab }: { tab: string }) {
  return <span className={styles.tab}>{tab}</span>
}

/** A row of tab tokens separated by thin gaps, e.g. a lick's "Show tab" line. */
export function TabLine({ tabs }: { tabs: readonly string[] }) {
  return (
    <span className={styles.line}>
      {tabs.map((t, i) => (
        <TabText key={i} tab={t} />
      ))}
    </span>
  )
}
