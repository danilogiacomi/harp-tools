import { useEffect } from 'react'
import { audioEngine } from '../../audio/AudioEngine'
import { ActiveClock, type Span } from '../../core/log/activeClock'
import { recordPractice } from '../log/practiceLog'
import { browserStorage } from '../settings/settings'

/** Spec §5: practice time is saved this often while it runs. */
export const FLUSH_MS = 15_000

/**
 * Logs time spent on `pageId` while the page is visible and — unless `requireAudio` is false —
 * audio is unlocked, so a page just left open behind "Tap to start audio" doesn't count.
 */
export function usePracticeTimer(pageId: string, opts: { requireAudio?: boolean } = {}): void {
  const requireAudio = opts.requireAudio ?? true

  useEffect(() => {
    const clock = new ActiveClock()
    const save = (span: Span | null) => {
      if (span) recordPractice(browserStorage(), pageId, span.startMs, span.endMs)
    }
    const isActive = () =>
      document.visibilityState === 'visible' && (!requireAudio || audioEngine.isUnlocked)
    // Saves what has run so far, then keeps running only while still active.
    const sync = () => {
      const now = Date.now()
      if (isActive()) {
        save(clock.flush(now))
        clock.start(now)
      } else {
        save(clock.stop(now))
      }
    }
    const hide = () => save(clock.stop(Date.now()))

    sync()
    const timer = setInterval(sync, FLUSH_MS)
    const offAudio = audioEngine.onStateChange(sync)
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('pageshow', sync)
    window.addEventListener('pagehide', hide)
    return () => {
      clearInterval(timer)
      offAudio()
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('pageshow', sync)
      window.removeEventListener('pagehide', hide)
      hide()
    }
  }, [pageId, requireAudio])
}
