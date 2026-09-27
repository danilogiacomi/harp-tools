import { useEffect, useState } from 'react'

export class Timeouts {
  private ids = new Set<ReturnType<typeof setTimeout>>()

  after(ms: number, fn: () => void): void {
    const id = setTimeout(() => {
      this.ids.delete(id)
      fn()
    }, ms)
    this.ids.add(id)
  }

  clear(): void {
    this.ids.forEach(clearTimeout)
    this.ids.clear()
  }
}

/** Timers that die with the component (e.g. "next round in 1.5 s"). */
export function useTimeouts(): Timeouts {
  const [timeouts] = useState(() => new Timeouts())
  useEffect(() => () => timeouts.clear(), [timeouts])
  return timeouts
}
