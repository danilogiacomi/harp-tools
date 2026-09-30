import { useState } from 'react'

/** Test control for `virtual:pwa-register/react` (aliased here in vite.config.ts). */
export const pwaStub = {
  offlineReady: false,
  needRefresh: false,
  updateServiceWorker: (async () => {}) as (reload?: boolean) => Promise<void>,
  reset() {
    this.offlineReady = false
    this.needRefresh = false
    this.updateServiceWorker = async () => {}
  },
}

export function useRegisterSW() {
  const offlineReady = useState(pwaStub.offlineReady)
  const needRefresh = useState(pwaStub.needRefresh)
  return {
    offlineReady,
    needRefresh,
    updateServiceWorker: (reload?: boolean) => pwaStub.updateServiceWorker(reload),
  }
}
