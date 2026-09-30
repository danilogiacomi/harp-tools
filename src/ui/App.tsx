import type { ComponentType } from 'react'
import { Header } from './components/Header'
import { UpdateBar } from './components/UpdateBar'
import { BendTrainerPage } from './pages/bend/BendTrainerPage'
import { EchoNotePage } from './pages/echo/EchoNotePage'
import { HealthCheckPage } from './pages/health/HealthCheckPage'
import { HomePage } from './pages/HomePage'
import { HoleFinderPage } from './pages/holeFinder/HoleFinderPage'
import { IntervalsPage } from './pages/intervals/IntervalsPage'
import { JamPage } from './pages/jam/JamPage'
import { LickTrainerPage } from './pages/licks/LickTrainerPage'
import { MelodyEchoPage } from './pages/melody/MelodyEchoPage'
import { PracticeLogPage } from './pages/log/PracticeLogPage'
import { MetronomePage } from './pages/metronome/MetronomePage'
import { PositionsPage } from './pages/positions/PositionsPage'
import { NoteQuizPage } from './pages/quiz/NoteQuizPage'
import { RhythmTrainerPage } from './pages/rhythm/RhythmTrainerPage'
import { ScaleRunnerPage } from './pages/scales/ScaleRunnerPage'
import { TabReaderPage } from './pages/tabReader/TabReaderPage'
import { ToneMeterPage } from './pages/tone/ToneMeterPage'
import { TunerPage } from './pages/tuner/TunerPage'
import { useHashRoute } from './router'
import { SettingsProvider } from './settings/SettingsContext'
import styles from './App.module.css'

const ROUTES: Record<string, ComponentType> = {
  '/': HomePage,
  '/tuner': TunerPage,
  '/metronome': MetronomePage,
  '/health': HealthCheckPage,
  '/tone': ToneMeterPage,
  '/positions': PositionsPage,
  '/echo': EchoNotePage,
  '/bend': BendTrainerPage,
  '/scales': ScaleRunnerPage,
  '/intervals': IntervalsPage,
  '/melody': MelodyEchoPage,
  '/hole-finder': HoleFinderPage,
  '/quiz': NoteQuizPage,
  '/rhythm': RhythmTrainerPage,
  '/tab-reader': TabReaderPage,
  '/licks': LickTrainerPage,
  '/jam': JamPage,
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
      <UpdateBar />
    </SettingsProvider>
  )
}
