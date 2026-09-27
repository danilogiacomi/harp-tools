import { tabLabel, type HarpNote } from '../harmonica/harp'

export interface TabNoteItem {
  kind: 'note'
  /** The token's tab without its duration, e.g. `-3'`. */
  tab: string
  note: HarpNote
  beats: number
}

export interface TabRestItem {
  kind: 'rest'
  beats: number
}

export interface TabBarItem {
  kind: 'bar'
}

export type TabItem = TabNoteItem | TabRestItem | TabBarItem

export interface TabError {
  /** 1-based position of the token in the text. */
  position: number
  token: string
  message: string
}

export interface ParsedTab {
  items: TabItem[]
  errors: TabError[]
}

// A hole (1–10), optionally drawn (-), then bend ticks or an over-note suffix.
const NOTE = /^-?(10|[1-9])('{1,3}|od|o)?$/
const DURATION = /^(\d+(\.\d+)?|\.\d+)$/

/**
 * Spec §10: space-separated tokens — notes in tab notation (`4` `-4` `-3'` `6o` `7od`), `_` for a
 * rest, `|` for a bar line, and an optional `:beats` duration on notes and rests (default 1).
 * Notes resolve against `harp` (its key and tuning); a token it can't play is an error.
 */
export function parseTab(text: string, harp: readonly HarpNote[]): ParsedTab {
  const byTab = new Map(harp.map((n) => [tabLabel(n), n]))
  const items: TabItem[] = []
  const errors: TabError[] = []
  const tokens = text.split(/\s+/).filter((t) => t !== '')

  tokens.forEach((token, i) => {
    const fail = (message: string) => errors.push({ position: i + 1, token, message })
    if (token === '|') {
      items.push({ kind: 'bar' })
      return
    }
    const [body, duration, extra] = token.split(':')
    if (extra !== undefined || duration === '') return fail('has more than one duration')
    let beats = 1
    if (duration !== undefined) {
      if (!DURATION.test(duration) || Number(duration) <= 0) {
        return fail('the duration must be a positive number of beats')
      }
      beats = Number(duration)
    }
    if (body === '_') {
      items.push({ kind: 'rest', beats })
      return
    }
    if (!NOTE.test(body)) return fail('is not a note, rest (_) or bar line (|)')
    const note = byTab.get(body)
    if (!note) return fail("isn't on this harp")
    items.push({ kind: 'note', tab: body, note, beats })
  })
  return { items, errors }
}

export interface TimedNote {
  /** Index among the tab's notes (rests and bars don't count). */
  index: number
  tab: string
  note: HarpNote
  startBeat: number
  beats: number
}

export interface TabTimeline {
  notes: TimedNote[]
  /** Beat positions of the bar lines. */
  bars: number[]
  totalBeats: number
}

/** Places notes on a beat grid from 0: durations add up, bar lines take no time. */
export function tabTimeline(items: readonly TabItem[]): TabTimeline {
  const notes: TimedNote[] = []
  const bars: number[] = []
  let beat = 0
  for (const item of items) {
    if (item.kind === 'bar') {
      bars.push(beat)
      continue
    }
    if (item.kind === 'note') {
      notes.push({
        index: notes.length,
        tab: item.tab,
        note: item.note,
        startBeat: beat,
        beats: item.beats,
      })
    }
    beat += item.beats
  }
  return { notes, bars, totalBeats: beat }
}

export function beatMs(bpm: number): number {
  return 60000 / bpm
}

/** A short stable id for a text (djb2), so a custom tab's best score is kept per tab. */
export function textHash(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0
  return h.toString(36)
}
