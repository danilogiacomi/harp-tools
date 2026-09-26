import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  browserStorage,
  loadSettings,
  sanitizeSettings,
  saveSettings,
  type Settings,
} from './settings'

interface SettingsApi {
  settings: Settings
  update: (patch: Partial<Settings>) => void
}

const SettingsContext = createContext<SettingsApi | null>(null)

interface Props {
  children: ReactNode
  storage?: Storage | null
}

export function SettingsProvider({ children, storage = browserStorage() }: Props) {
  const [settings, setSettings] = useState(() => loadSettings(storage))

  useEffect(() => saveSettings(storage, settings), [storage, settings])

  const update = useCallback(
    (patch: Partial<Settings>) => setSettings((prev) => sanitizeSettings({ ...prev, ...patch })),
    [],
  )
  const value = useMemo(() => ({ settings, update }), [settings, update])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsApi {
  const api = useContext(SettingsContext)
  if (!api) throw new Error('useSettings must be used inside <SettingsProvider>')
  return api
}
