import type { ReactNode } from 'react'
import { AudioGate } from '../AudioGate'
import { MatchSettings } from './MatchSettings'
import styles from './Game.module.css'

interface Props {
  title: string
  intro: string
  /** Show the melody-echo hold slider in the matching settings. */
  melodyHold?: boolean
  children: ReactNode
}

export function GameLayout({ title, intro, melodyHold = false, children }: Props) {
  return (
    <>
      <h1>{title}</h1>
      <p className={styles.intro}>{intro}</p>
      <AudioGate>{children}</AudioGate>
      <MatchSettings melodyHold={melodyHold} />
    </>
  )
}
