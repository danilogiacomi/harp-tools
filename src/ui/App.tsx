import type { ComponentType } from 'react'
import { Header } from './components/Header'
import { EchoNotePage } from './pages/echo/EchoNotePage'
import { HomePage } from './pages/HomePage'
import { MetronomePage } from './pages/metronome/MetronomePage'
import { TunerPage } from './pages/tuner/TunerPage'
import { useHashRoute } from './router'
import { SettingsProvider } from './settings/SettingsContext'
import styles from './App.module.css'

const ROUTES: Record<string, ComponentType> = {
  '/': HomePage,
  '/tuner': TunerPage,
  '/metronome': MetronomePage,
  '/echo': EchoNotePage,
}

function CurrentPage() {
  const Page = ROUTES[useHashRoute()] ?? HomePage
  return <Page />
}

export function App() {
  return (
    <SettingsProvider>
      <Header />
      <main className={styles.main}>
        <CurrentPage />
      </main>
    </SettingsProvider>
  )
}
