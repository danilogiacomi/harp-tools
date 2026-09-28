import type { PitchListener } from '../../audio/pitch/PitchDetector'
import { usePitch } from '../hooks/usePitch'
import { MicErrorNotice } from './MicErrorNotice'

interface Props {
  /** Receives every detector frame, outside render. */
  onReading: PitchListener
  enabled?: boolean
}

/**
 * The mic for a page with a live chart: frames go to `onReading` and only this status line
 * re-renders, when the mic's status changes. The line is always rendered, so the page doesn't
 * jump while the mic starts.
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
