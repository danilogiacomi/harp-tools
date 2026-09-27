import type { ComponentType } from 'react'
import { Header } from './components/Header'
import { BendTrainerPage } from './pages/bend/BendTrainerPage'
import { EchoNotePage } from './pages/echo/EchoNotePage'
import { HomePage } from './pages/HomePage'
import { IntervalsPage } from './pages/intervals/IntervalsPage'
import { MetronomePage } from './pages/metronome/MetronomePage'
import { ScaleRunnerPage } from './pages/scales/ScaleRunnerPage'
import { TunerPage } from './pages/tuner/TunerPage'
import { useHashRoute } from './router'
import { SettingsProvider } from './settings/SettingsContext'
import styles from './App.module.css'

const ROUTES: Record<string, ComponentType> = {
  '/': HomePage,
  '/tuner': TunerPage,
  '/metronome': MetronomePage,
  '/echo': EchoNotePage,
  '/bend': BendTrainerPage,
  '/scales': ScaleRunnerPage,
  '/intervals': IntervalsPage,
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
