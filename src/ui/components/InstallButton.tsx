import { useEffect, useState } from 'react'
import styles from './InstallButton.module.css'

/** Chrome/Edge/Android's install event (not in TypeScript's DOM types). */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface InstallEnv {
  /** Already running as an installed app. */
  standalone: boolean
  /** iPhone/iPad Safari, which never offers an install prompt. */
  ios: boolean
}

export function browserInstallEnv(): InstallEnv {
  const standalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches
  const ua = navigator.userAgent
  const ios =
    (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) &&
    !('onbeforeinstallprompt' in window)
  return { standalone, ios }
}

export function InstallButton({ env = browserInstallEnv() }: { env?: InstallEnv }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPrompt(e as InstallPromptEvent)
    }
    const onInstalled = () => {
      setPrompt(null)
      setInstalled(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (env.standalone || installed) return null
  if (prompt) {
    const install = async () => {
      await prompt.prompt()
      await prompt.userChoice
      setPrompt(null) // the event can only be used once
    }
    return (
      <p className={styles.install}>
        <button type="button" onClick={install}>
          Install app
        </button>
      </p>
    )
  }
  if (env.ios) return <p className={styles.install}>On iPhone or iPad: Share → Add to Home Screen</p>
  return null
}
