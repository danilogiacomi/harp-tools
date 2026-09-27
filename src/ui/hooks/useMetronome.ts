import { useCallback, useEffect, useState } from 'react'
import { Metronome } from '../../audio/Metronome'
import type { MetronomeConfig } from '../../core/rhythm/schedule'

/** `config` should be memoised by the caller; changes apply live while running. */
export function useMetronome(config: MetronomeConfig) {
  const [running, setRunning] = useState(false)
  const [beat, setBeat] = useState<number | null>(null)
  /** performance.now() when the latest beat was heard — games compare note onsets to it. */
  const [lastBeatMs, setLastBeatMs] = useState<number | null>(null)
  const [metronome] = useState(
    () =>
      new Metronome(config, (pulse) => {
        setBeat(pulse)
        setLastBeatMs(performance.now())
      }),
  )

  useEffect(() => metronome.setConfig(config), [metronome, config])
  useEffect(() => () => metronome.stop(), [metronome])

  const toggle = useCallback(() => {
    if (metronome.isRunning) {
      metronome.stop()
      setRunning(false)
      setBeat(null)
      setLastBeatMs(null)
    } else {
      metronome.start()
      setRunning(true)
    }
  }, [metronome])

  return { running, beat, lastBeatMs, toggle }
}
