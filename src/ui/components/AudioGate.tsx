import { useEffect, useState, type ReactNode } from 'react'
import { audioEngine, isWebAudioSupported } from '../../audio/AudioEngine'
import styles from './AudioGate.module.css'

export interface UnlockableEngine {
  readonly isUnlocked: boolean
  unlock(): Promise<void>
  onStateChange(listener: () => void): () => void
}

interface Props {
  children: ReactNode
  engine?: UnlockableEngine
  supported?: boolean
}

/** Renders its children only once audio is running; otherwise shows a "tap to start" button. */
export function AudioGate({
  children,
  engine = audioEngine,
  supported = isWebAudioSupported(),
}: Props) {
  const [unlocked, setUnlocked] = useState(() => engine.isUnlocked)
  const [failed, setFailed] = useState(false)

  useEffect(() => engine.onStateChange(() => setUnlocked(engine.isUnlocked)), [engine])

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
