import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import styles from './UpdateBar.module.css'

export const OFFLINE_NOTICE_MS = 6000

/**
 * Service-worker news, fixed at the bottom of the screen so it never moves the page. A new
 * version waits for the user's Reload; it is never applied mid-session.
 */
export function UpdateBar() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (error: unknown) => console.warn('Service worker registration failed', error),
  })

  useEffect(() => {
    if (!offlineReady) return
    const timer = setTimeout(() => setOfflineReady(false), OFFLINE_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [offlineReady, setOfflineReady])

  if (!needRefresh && !offlineReady) return null
  const dismiss = () => {
    setNeedRefresh(false)
    setOfflineReady(false)
  }
  return (
    <div className={styles.bar} role="status">
      <span>{needRefresh ? 'A new version is ready' : 'Ready to work offline'}</span>
      {needRefresh && (
        <button type="button" className={styles.reload} onClick={() => updateServiceWorker(true)}>
          Reload
        </button>
      )}
      <button type="button" className={styles.dismiss} aria-label="Dismiss" onClick={dismiss}>
        ✕
      </button>
    </div>
  )
}
