import type { ReactNode } from 'react'
import { AudioGate } from '../AudioGate'
import { MatchSettings } from './MatchSettings'
import styles from './Game.module.css'

interface Props {
  title: string
  intro: string
  /** Show the melody-echo hold slider in the matching settings. */
  melodyHold?: boolean
  /** False for a game that doesn't match notes (the rhythm trainer). */
  matchSettings?: boolean
  children: ReactNode
}

export function GameLayout({
  title,
  intro,
  melodyHold = false,
  matchSettings = true,
  children,
}: Props) {
  return (
    <>
      <h1>{title}</h1>
      <p className={styles.intro}>{intro}</p>
      <AudioGate>{children}</AudioGate>
      {matchSettings && <MatchSettings melodyHold={melodyHold} />}
    </>
  )
}
