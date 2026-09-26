import { useEffect, useState, type ReactNode } from 'react'
import { audioEngine, isWebAudioSupported } from '../../audio/AudioEngine'
import styles from './AudioGate.module.css'

export interface UnlockableEngine {
  readonly isUnlocked: boolean
  /** Not running, and an automatic resume was refused: only a tap can restart audio. */
  readonly needsGesture: boolean
  unlock(): Promise<void>
  onStateChange(listener: () => void): () => void
}

interface Props {
  children: ReactNode
  engine?: UnlockableEngine
  supported?: boolean
}

/** How long an automatic resume may stay pending before we ask for a tap. */
const RESUME_GRACE_MS = 300

/**
 * Renders its children once audio is running; otherwise shows a "tap to start" button. If the
 * browser suspends audio later, the engine resumes it on its own and the button only comes back
 * when that fails or takes longer than a short grace period.
 */
export function AudioGate({
  children,
  engine = audioEngine,
  supported = isWebAudioSupported(),
}: Props) {
  const [unlocked, setUnlocked] = useState(() => engine.isUnlocked)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const off = engine.onStateChange(() => {
      clearTimeout(timer)
      if (engine.isUnlocked) setUnlocked(true)
      else if (engine.needsGesture) setUnlocked(false)
      else timer = setTimeout(() => setUnlocked(engine.isUnlocked), RESUME_GRACE_MS)
    })
    return () => {
      off()
      clearTimeout(timer)
    }
  }, [engine])

  if (!supported) {
    return (
      <p role="alert" className="notice">
        This browser doesn't support the Web Audio API, so the audio tools can't run here. Try a
        recent version of Chrome, Firefox, Safari or Edge.
      </p>
    )
  }

  if (unlocked) return <>{children}</>

  const start = async () => {
    try {
      await engine.unlock()
      setFailed(false)
      setUnlocked(engine.isUnlocked)
    } catch {
      setFailed(true)
    }
  }

  return (
    <div className={styles.gate}>
      <button type="button" className={styles.start} onClick={start}>
        Tap to start audio
      </button>
      <p className={styles.hint}>Browsers only allow sound after you interact with the page.</p>
      {failed && (
        <p role="alert" className="notice">
          Couldn't start audio. Try tapping again.
        </p>
      )}
    </div>
  )
}
