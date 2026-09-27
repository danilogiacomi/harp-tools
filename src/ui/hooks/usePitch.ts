import { useEffect, useRef, useState } from 'react'
import { MicrophoneError, type MicErrorKind } from '../../audio/Microphone'
import type { PitchListener, PitchReading } from '../../audio/pitch/PitchDetector'
import { PitchyDetector } from '../../audio/pitch/PitchyDetector'
import { useSettings } from '../settings/SettingsContext'

const MIN_CLARITY = 0.9

export type PitchStatus = 'idle' | 'starting' | 'listening' | 'error'

export interface PitchState {
  reading: PitchReading | null
  rms: number
  status: PitchStatus
  error: MicErrorKind | null
}

interface Live {
  reading: PitchReading | null
  rms: number
  live: boolean
  error: MicErrorKind | null
}

const IDLE: PitchState = { reading: null, rms: 0, status: 'idle', error: null }
const EMPTY: Live = { reading: null, rms: 0, live: false, error: null }

/**
 * Live mic pitch while `enabled`; the mic is released when disabled or unmounted. `onReading`,
 * if given, receives every detector frame (outside render) — games use it for precise timing.
 */
export function usePitch(enabled: boolean, onReading?: PitchListener): PitchState {
  const { settings } = useSettings()
  const noiseFloor = useRef(settings.noiseFloor)
  const readingListener = useRef(onReading)
  const [live, setLive] = useState<Live>(EMPTY)

  useEffect(() => {
    noiseFloor.current = settings.noiseFloor
  }, [settings.noiseFloor])

  useEffect(() => {
    readingListener.current = onReading
  })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const detector = new PitchyDetector(() => ({
      minClarity: MIN_CLARITY,
      noiseFloor: noiseFloor.current,
    }))
    const off = detector.onPitch((reading, rms) => {
      setLive({ reading, rms, live: true, error: null })
      readingListener.current?.(reading, rms)
    })
    const offError = detector.onError((error) => setLive({ ...EMPTY, error }))
    detector.start().catch((e: unknown) => {
      if (!cancelled) {
        setLive({ ...EMPTY, error: e instanceof MicrophoneError ? e.kind : 'unknown' })
      }
    })
    return () => {
      cancelled = true
      off()
      offError()
      detector.stop()
      setLive(EMPTY)
    }
  }, [enabled])

  if (!enabled) return IDLE
  if (live.error) return { reading: null, rms: 0, status: 'error', error: live.error }
  return {
    reading: live.reading,
    rms: live.rms,
    status: live.live ? 'listening' : 'starting',
    error: null,
  }
}
