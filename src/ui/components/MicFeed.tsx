import type { PitchListener } from '../../audio/pitch/PitchDetector'
import { usePitch } from '../hooks/usePitch'
import { MicErrorNotice } from './MicErrorNotice'

interface Props {
  /** Receives every detector frame, outside render. */
  onReading: PitchListener
  enabled?: boolean
}

/**
 * Hosts `usePitch` in a component of its own: the hook re-renders its host on every mic frame,
 * so a page with a live chart keeps it here and only this status line re-renders 60 times a
 * second. The line is always rendered, so the page doesn't jump while the mic starts.
 */
export function MicFeed({ onReading, enabled = true }: Props) {
  const { status, error } = usePitch(enabled, onReading)
  return (
    <>
      {error && <MicErrorNotice kind={error} />}
      <p className="micStatus">{status === 'starting' && 'Waiting for microphone permission…'}</p>
    </>
  )
}
