import type { Position } from '../harmonica/positions'

export type LickStyle = 'blues2' | 'folk1' | 'minor3'

export interface LickStyleInfo {
  id: LickStyle
  name: string
  position: Position
}

export const LICK_STYLES: readonly LickStyleInfo[] = [
  { id: 'blues2', name: '2nd-position blues', position: 2 },
  { id: 'folk1', name: '1st-position folk', position: 1 },
  { id: 'minor3', name: '3rd-position minor', position: 3 },
]

export interface Lick {
  id: string
  name: string
  style: LickStyle
  /** Key-relative tab with durations in beats (spec §10 format). */
  tab: string
}

/** Spec §11: short, generic scale fragments written for this site — not transcriptions. */
export const LICKS: readonly Lick[] = [
  { id: 'blues-up', name: 'Blues scale up', style: 'blues2', tab: "-2 -3' 4 -4' -4 -5 6:2" },
  { id: 'blues-down', name: 'Blues scale down', style: 'blues2', tab: "6 -5 -4 -4' 4 -3' -2:2" },
  { id: 'root-fifth', name: 'Root to fifth', style: 'blues2', tab: '-2 -3 4 -4:3' },
  {
    id: 'bend-release',
    name: 'Bend and release',
    style: 'blues2',
    tab: "-3':0.5 -3:0.5 4 -3 -2:2",
  },
  { id: 'call', name: 'Call', style: 'blues2', tab: '-4 -5 6:2 -5 -4:2' },
  { id: 'response', name: 'Response', style: 'blues2', tab: "-4 4 -3' -2:3" },
  { id: 'fifth-slide', name: 'Slide to the fifth', style: 'blues2', tab: "4 -4' -4:2 -5 -4:2" },
  {
    id: 'shuffle-riff',
    name: 'Shuffle riff',
    style: 'blues2',
    tab: '-2:0.67 -3:0.33 4:0.67 -4:0.33 5 -4 -2:2',
  },
  { id: 'turnaround-down', name: 'Turnaround down', style: 'blues2', tab: '6 -5 5 -4 4 -3 -4:2' },
  { id: 'turnaround-up', name: 'Turnaround up', style: 'blues2', tab: "-2 -3 4 -4' -4:3" },
  { id: 'major-run', name: 'Major run', style: 'folk1', tab: '4 -4 5 -5 6 -6 -7 7:2' },
  { id: 'folk-turn', name: 'Folk turn', style: 'folk1', tab: '6 -6 6 5 -4 4:2' },
  { id: 'arpeggio', name: 'Arpeggio', style: 'folk1', tab: '4 5 6 7:2 6 5 4:2' },
  { id: 'dorian-up', name: 'Dorian climb', style: 'minor3', tab: '-4 5 -5 6 -6:2 -5 -4:2' },
  { id: 'minor-sigh', name: 'Minor sigh', style: 'minor3', tab: '-6 6 -5 -4:3' },
  { id: 'minor-pent', name: 'Minor pentatonic', style: 'minor3', tab: '-4 -5 6 -6 7:2 -6 6 -4:2' },
]
