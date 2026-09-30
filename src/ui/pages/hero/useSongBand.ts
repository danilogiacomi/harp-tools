import { useEffect, useMemo, useRef, useState } from 'react'
import { BackingScheduler } from '../../../audio/backing/BackingScheduler'
import type { BackingConfig } from '../../../core/jam/backingSchedule'
import { useSettings } from '../../settings/SettingsContext'

export interface SongBand {
  /** Plays the song from its count-in, restarting it if it is already playing. */
  start(): void
  stop(): void
}

/**
 * The band for one song (spec §1.3). `onBar` hears each bar when it sounds: negative in the
 * count-in, `form.length` when a song that doesn't loop has ended. `config` should be memoised
 * by the caller. The band is disposed on unmount.
 */
export function useSongBand(config: BackingConfig, onBar: (bar: number) => void): SongBand {
  const { settings } = useSettings()
  const latest = useRef(onBar)
  useEffect(() => {
    latest.current = onBar
  })
  const [band] = useState(() => new BackingScheduler(config, (bar) => latest.current(bar)))

  useEffect(() => band.setConfig(config), [band, config])
  useEffect(() => band.setA4(settings.a4), [band, settings.a4])
  useEffect(() => () => band.dispose(), [band])

  return useMemo(
    () => ({
      start: () => {
        // A running scheduler ignores start(), which would leave "Again" silent.
        if (band.isRunning) band.stop()
        band.start()
      },
      stop: () => band.stop(),
    }),
    [band],
  )
}
