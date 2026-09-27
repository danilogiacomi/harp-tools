import { useState } from 'react'
import { localDate } from '../../../core/log/dates'
import { emptyLog } from '../../../core/log/logModel'
import {
  dailySeconds,
  formatDuration,
  pageSecondsThisWeek,
  recentSessions,
  streaks,
  totals,
} from '../../../core/log/stats'
import { clearLog, loadLog } from '../../log/practiceLog'
import { browserStorage } from '../../settings/settings'
import { pageTitle } from '../homeGroups'
import { DayChart } from './DayChart'
import styles from './PracticeLogPage.module.css'

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

export function PracticeLogPage({ now = Date.now }: { now?: () => number }) {
  // A report, read once when the page opens.
  const [state, setState] = useState(() => ({
    log: loadLog(browserStorage()),
    today: localDate(now()),
  }))
  const [confirming, setConfirming] = useState(false)
  const { log, today } = state

  const streak = streaks(log, today)
  const total = totals(log, today)
  const pages = pageSecondsThisWeek(log, today)
  const sessions = recentSessions(log)

  const clear = () => {
    clearLog(browserStorage())
    setState((s) => ({ ...s, log: emptyLog() }))
    setConfirming(false)
  }

  return (
    <>
      <h1>Practice log</h1>
      <p className={styles.intro}>
        Time counts while a tool or game is open with its audio running (the positions page and the
        note quiz count while they're on screen). Everything stays in this browser.
      </p>

      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>Current streak</dt>
          <dd>{days(streak.current)}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Longest streak</dt>
          <dd>{days(streak.longest)}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Today</dt>
          <dd>{formatDuration(total.today)}</dd>
        </div>
        <div className={styles.stat}>
          <dt>This week</dt>
          <dd>{formatDuration(total.week)}</dd>
        </div>
        <div className={styles.stat}>
          <dt>All time</dt>
          <dd>{formatDuration(total.all)}</dd>
        </div>
      </dl>
      <p className={styles.hint}>A streak day needs at least a minute of practice.</p>

      <section aria-labelledby="log-days">
        <h2 id="log-days">Last 14 days</h2>
        <DayChart days={dailySeconds(log, today)} />
      </section>

      <section aria-labelledby="log-pages">
        <h2 id="log-pages">This week by page</h2>
        <table className={styles.table} aria-labelledby="log-pages">
          <thead>
            <tr>
              <th scope="col">Page</th>
              <th scope="col">Time</th>
            </tr>
          </thead>
          <tbody>
            {pages.length === 0 ? (
              <tr>
                <td colSpan={2} className={styles.empty}>
                  Nothing yet this week.
                </td>
              </tr>
            ) : (
              pages.map((p) => (
                <tr key={p.pageId}>
                  <td>{pageTitle(p.pageId)}</td>
                  <td>{formatDuration(p.seconds)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="log-sessions">
        <h2 id="log-sessions">Recent scored sessions</h2>
        <table className={styles.table} aria-labelledby="log-sessions">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Game</th>
              <th scope="col">Score</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={3} className={styles.empty}>
                  No scored sessions yet.
                </td>
              </tr>
            ) : (
              sessions.map((s, i) => (
                <tr key={`${s.date}-${i}`}>
                  <td>{s.date}</td>
                  <td>{pageTitle(s.game)}</td>
                  <td>
                    {s.score} / {s.max}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* One fixed-height row for both states, so confirming doesn't move anything. */}
      <div className={styles.clear}>
        {confirming ? (
          <>
            <span>Clear the whole log? This can't be undone.</span>
            <button type="button" onClick={clear}>
              Yes, clear the log
            </button>
            <button type="button" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirming(true)}>
            Clear log
          </button>
        )}
      </div>
    </>
  )
}
