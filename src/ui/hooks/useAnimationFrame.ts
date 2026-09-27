import { useEffect, useRef } from 'react'

/**
 * Calls `draw(nowMs)` on animation frames at most every `minIntervalMs`, for charts and lanes
 * that update the DOM through refs instead of re-rendering. `nowMs` is on the performance.now()
 * clock, the same one mic readings use. Stops on unmount.
 */
export function useAnimationFrame(draw: (nowMs: number) => void, minIntervalMs = 0): void {
  const latest = useRef(draw)
  useEffect(() => {
    latest.current = draw
  })
  useEffect(() => {
    let id = 0
    let last = -Infinity
    const frame = (nowMs: number) => {
      if (nowMs - last >= minIntervalMs) {
        last = nowMs
        latest.current(nowMs)
      }
      id = requestAnimationFrame(frame)
    }
    id = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(id)
  }, [minIntervalMs])
}
