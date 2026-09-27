import { useMemo } from 'react'
import { buildHarp, type HarpNote } from '../../core/harmonica/harp'
import { harpSpelling } from '../../core/harmonica/keys'
import type { Spelling } from '../../core/music/noteNames'
import { useSettings } from '../settings/SettingsContext'

/** The harp for the header's key and tuning (spec §1). Every harp-using page reads it here. */
export function useHarp(): HarpNote[] {
  const { settings } = useSettings()
  return useMemo(() => buildHarp(settings.key, settings.tuning), [settings.key, settings.tuning])
}

/** How to spell this harp's notes: the key's spelling, or its relative major on natural minor. */
export function useSpelling(): Spelling {
  const { settings } = useSettings()
  return useMemo(() => harpSpelling(settings.key, settings.tuning), [settings.key, settings.tuning])
}
