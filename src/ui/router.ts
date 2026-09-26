import { useSyncExternalStore } from 'react'

/** '#/tuner?x=1' → '/tuner'; '' → '/'. */
export function parseHash(hash: string): string {
  const path = hash.replace(/^#/, '').split('?')[0]
  return path.startsWith('/') ? path : `/${path}`
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useHashRoute(): string {
  return useSyncExternalStore(subscribe, () => parseHash(window.location.hash))
}
