import { HARP_KEYS, type HarpKey } from '../../core/harmonica/keys'
import { BPM_MAX, BPM_MIN } from '../../core/rhythm/tempo'

export type LabelMode = 'note' | 'tab'

export interface Settings {
  key: HarpKey
  /** Reference pitch for A4 in Hz. */
  a4: number
  /** Show over-notes most harps can't play reliably. */
  showAdvanced: boolean
  labelMode: LabelMode
  bpm: number
  /** Linear RMS below which mic input counts as silence. */
  noiseFloor: number
  /** NoteMatcher: how far from the target still counts (cents, either way). */
  toleranceCents: number
  /** NoteMatcher: how long a note must be held. */
  holdMs: number
  /** NoteMatcher hold for melody echo, where notes follow each other quickly. */
  melodyHoldMs: number
}

export const DEFAULT_SETTINGS: Settings = {
  key: 'C',
  a4: 440,
  showAdvanced: false,
  labelMode: 'note',
  bpm: 90,
  noiseFloor: 0.01,
  toleranceCents: 25,
  holdMs: 500,
  melodyHoldMs: 250,
}

export const STORAGE_KEY = 'harp-tools:settings'
export const A4_RANGE = [430, 450] as const
export const NOISE_FLOOR_RANGE = [0.001, 0.1] as const
export const TOLERANCE_RANGE = [5, 50] as const
export const HOLD_RANGE = [100, 2000] as const
export const MELODY_HOLD_RANGE = [100, 1000] as const

const inRange = (v: unknown, [lo, hi]: readonly [number, number]): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi

/** Coerce anything (e.g. old or hand-edited storage) into valid Settings, field by field. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const d = DEFAULT_SETTINGS
  return {
    key: HARP_KEYS.includes(r.key as HarpKey) ? (r.key as HarpKey) : d.key,
    a4: inRange(r.a4, A4_RANGE) ? r.a4 : d.a4,
    showAdvanced: typeof r.showAdvanced === 'boolean' ? r.showAdvanced : d.showAdvanced,
    labelMode: r.labelMode === 'note' || r.labelMode === 'tab' ? r.labelMode : d.labelMode,
    bpm: inRange(r.bpm, [BPM_MIN, BPM_MAX]) ? r.bpm : d.bpm,
    noiseFloor: inRange(r.noiseFloor, NOISE_FLOOR_RANGE) ? r.noiseFloor : d.noiseFloor,
    toleranceCents: inRange(r.toleranceCents, TOLERANCE_RANGE)
      ? r.toleranceCents
      : d.toleranceCents,
    holdMs: inRange(r.holdMs, HOLD_RANGE) ? r.holdMs : d.holdMs,
    melodyHoldMs: inRange(r.melodyHoldMs, MELODY_HOLD_RANGE) ? r.melodyHoldMs : d.melodyHoldMs,
  }
}

export function loadSettings(storage: Pick<Storage, 'getItem'> | null): Settings {
  try {
    const text = storage?.getItem(STORAGE_KEY)
    return sanitizeSettings(text ? JSON.parse(text) : {})
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(storage: Pick<Storage, 'setItem'> | null, settings: Settings): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Storage full or blocked — settings just won't persist this session.
  }
}

export function browserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
