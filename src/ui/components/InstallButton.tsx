import { useSyncExternalStore } from 'react'
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

interface InstallState {
  prompt: InstallPromptEvent | null
  installed: boolean
}

const INITIAL: InstallState = { prompt: null, installed: false }
let state = INITIAL
const listeners = new Set<() => void>()

function setState(next: InstallState) {
  state = next
  listeners.forEach((l) => l())
}

// Chrome fires beforeinstallprompt once per page load, and hash navigation never reloads: capture
// it at module load so it survives the home page unmounting (or never being the landing page).
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    setState({ ...state, prompt: e as InstallPromptEvent })
  })
  window.addEventListener('appinstalled', () => setState({ prompt: null, installed: true }))
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

/** Forgets any captured install offer; for tests only. */
export function resetInstallPromptForTests(): void {
  setState(INITIAL)
}

export function InstallButton({ env = browserInstallEnv() }: { env?: InstallEnv }) {
  const { prompt, installed } = useSyncExternalStore(subscribe, () => state)

  if (env.standalone || installed) return null
  if (prompt) {
    const install = async () => {
      try {
        await prompt.prompt()
        await prompt.userChoice
      } catch {
        // refused or already used: nothing to show
      } finally {
        setState({ ...state, prompt: null }) // the event can only be used once
      }
    }
    return (
      <p className={styles.install}>
        <button type="button" onClick={install}>
          Install app
        </button>
      </p>
    )
  }
  if (env.ios)
    return <p className={styles.install}>On iPhone or iPad: Share → Add to Home Screen</p>
  return null
}
