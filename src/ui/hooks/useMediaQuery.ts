import { useCallback, useSyncExternalStore } from 'react'

const hasMatchMedia = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'

/** Whether a CSS media query matches now; false where matchMedia doesn't exist. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!hasMatchMedia()) return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => hasMatchMedia() && window.matchMedia(query).matches)
}
