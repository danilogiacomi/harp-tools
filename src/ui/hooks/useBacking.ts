import { useCallback, useEffect, useState } from 'react'
import { BackingScheduler, type Mix } from '../../audio/backing/BackingScheduler'
import type { BackingConfig } from '../../core/jam/backingSchedule'
import { useSettings } from '../settings/SettingsContext'

/**
 * The play-along's backing track. `config` and `mix` should be memoised by the caller; changes
 * apply live while it plays. `bar` changes once per bar, so the page re-renders once a bar.
 */
export function useBacking(config: BackingConfig, mix: Mix) {
  const { settings } = useSettings()
  const [running, setRunning] = useState(false)
  const [bar, setBar] = useState<number | null>(null)
  const [scheduler] = useState(() => new BackingScheduler(config, setBar, mix))

  useEffect(() => scheduler.setConfig(config), [scheduler, config])
  useEffect(() => scheduler.setMix(mix), [scheduler, mix])
  useEffect(() => scheduler.setA4(settings.a4), [scheduler, settings.a4])
  useEffect(() => () => scheduler.stop(), [scheduler])

  const toggle = useCallback(() => {
    if (scheduler.isRunning) {
      scheduler.stop()
      setRunning(false)
      setBar(null)
    } else {
      scheduler.start()
      setRunning(true)
    }
  }, [scheduler])

  return { running, bar, toggle }
}
