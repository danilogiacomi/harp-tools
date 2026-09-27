import type { ComponentType } from 'react'
import { Header } from './components/Header'
import { BendTrainerPage } from './pages/bend/BendTrainerPage'
import { EchoNotePage } from './pages/echo/EchoNotePage'
import { HomePage } from './pages/HomePage'
import { HoleFinderPage } from './pages/holeFinder/HoleFinderPage'
import { IntervalsPage } from './pages/intervals/IntervalsPage'
import { MelodyEchoPage } from './pages/melody/MelodyEchoPage'
import { PracticeLogPage } from './pages/log/PracticeLogPage'
import { MetronomePage } from './pages/metronome/MetronomePage'
import { PositionsPage } from './pages/positions/PositionsPage'
import { NoteQuizPage } from './pages/quiz/NoteQuizPage'
import { ScaleRunnerPage } from './pages/scales/ScaleRunnerPage'
import { TunerPage } from './pages/tuner/TunerPage'
import { useHashRoute } from './router'
import { SettingsProvider } from './settings/SettingsContext'
import styles from './App.module.css'

const ROUTES: Record<string, ComponentType> = {
  '/': HomePage,
  '/tuner': TunerPage,
  '/metronome': MetronomePage,
  '/positions': PositionsPage,
  '/echo': EchoNotePage,
  '/bend': BendTrainerPage,
  '/scales': ScaleRunnerPage,
  '/intervals': IntervalsPage,
  '/melody': MelodyEchoPage,
  '/hole-finder': HoleFinderPage,
  '/quiz': NoteQuizPage,
  '/log': PracticeLogPage,
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
