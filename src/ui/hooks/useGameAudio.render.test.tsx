import { act, render } from '@testing-library/react'
import { Profiler } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { PitchListener } from '../../audio/pitch/PitchDetector'
import { SettingsProvider } from '../settings/SettingsContext'
import { useGameAudio } from './useGameAudio'

// The real usePitch over a fake detector: counts what a mic frame costs the host.
const detector = vi.hoisted(() => ({ listener: null as PitchListener | null }))
vi.mock('../../audio/pitch/PitchyDetector', () => ({
  PitchyDetector: class {
    start = async () => {}
    stop = () => {}
    onPitch = (l: PitchListener) => {
      detector.listener = l
      return () => {}
    }
    onError = () => () => {}
  },
}))
vi.mock('./useNotePlayer', () => ({
  useNotePlayer: () => ({
    play: async () => {},
    start: () => {},
    stop: () => {},
    isSounding: false,
    onSoundingChange: () => () => {},
  }),
}))

function Host() {
  const audio = useGameAudio(true)
  return (
    <p>
      {audio.status} {audio.detectedMidi}
    </p>
  )
}

/** One act() per frame, as each animation frame is its own task in the browser. */
const frames = (freq: number | null, n: number) => {
  for (let i = 0; i < n; i++) {
    act(() => detector.listener?.(freq === null ? null : { freq, clarity: 0.95, rms: 0.1 }, 0.1))
  }
}

describe('useGameAudio render cost', () => {
  it('re-renders its host only when the status or the nearest note changes', () => {
    const onRender = vi.fn()
    const { container } = render(
      <SettingsProvider storage={null}>
        <Profiler id="host" onRender={onRender}>
          <Host />
        </Profiler>
      </SettingsProvider>,
    )
    frames(440, 1)
    expect(container).toHaveTextContent('listening 69')
    const after = onRender.mock.calls.length
    frames(440, 60)
    frames(441, 60) // a few cents sharp: still A4
    expect(onRender).toHaveBeenCalledTimes(after)
    frames(null, 60)
    expect(onRender).toHaveBeenCalledTimes(after + 1)
    expect(container).toHaveTextContent(/^listening$/)
  })
})
