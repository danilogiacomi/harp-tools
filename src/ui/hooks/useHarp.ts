import { useMemo } from 'react'
import { buildHarp, type HarpNote } from '../../core/harmonica/harp'
import { useSettings } from '../settings/SettingsContext'

/** The harp for the header's key and tuning (spec §1). Every harp-using page reads it here. */
export function useHarp(): HarpNote[] {
  const { settings } = useSettings()
  return useMemo(() => buildHarp(settings.key, settings.tuning), [settings.key, settings.tuning])
}
