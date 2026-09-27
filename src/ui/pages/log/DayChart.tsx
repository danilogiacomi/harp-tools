import styles from './PracticeLogPage.module.css'

interface Props {
  days: readonly { date: string; seconds: number }[]
}

const BAR_W = 14
const GAP = 6
const SLOT = BAR_W + GAP
const TOP = 16
const PLOT_H = 100
const BOTTOM = 18

/** Minutes per day as bars (spec §5), with a hidden table as the text alternative. */
export function DayChart({ days }: Props) {
  const minutes = days.map((d) => Math.round(d.seconds / 60))
  const max = Math.max(1, ...minutes)
  const width = days.length * SLOT
  const height = TOP + PLOT_H + BOTTOM
  const baseline = TOP + PLOT_H

  return (
    <figure className={styles.chart}>
      <svg
        className={styles.chartSvg}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
        focusable="false"
      >
        {days.map((d, i) => {
          const h = minutes[i] === 0 ? 0 : Math.max(2, (minutes[i] / max) * PLOT_H)
          const x = i * SLOT + GAP / 2
          return (
            <g key={d.date} data-testid="day-bar">
              <rect className={styles.bar} x={x} y={baseline - h} width={BAR_W} height={h} rx={2} />
              <text
                className={styles.barLabel}
                x={x + BAR_W / 2}
                y={baseline - h - 4}
                textAnchor="middle"
              >
                {minutes[i] > 0 ? minutes[i] : ''}
              </text>
              <text
                className={styles.dayLabel}
                x={x + BAR_W / 2}
                y={height - 4}
                textAnchor="middle"
              >
                {Number(d.date.slice(8))}
              </text>
            </g>
          )
        })}
        <line className={styles.axis} x1={0} x2={width} y1={baseline} y2={baseline} />
      </svg>
      <figcaption className={styles.caption}>Minutes per day (day of the month below)</figcaption>
      <table className="visually-hidden">
        <caption>Minutes practised per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Minutes</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d, i) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              <td>{minutes[i]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
