import { act, fireEvent, render, screen } from '@testing-library/react'
import { Profiler } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { PitchListener } from '../../../audio/pitch/PitchDetector'
import { midiToFreq } from '../../../core/music/pitch'
import { SettingsProvider } from '../../settings/SettingsContext'
import { TabReaderGame } from './TabReaderPage'

// The real useGameAudio and usePitch over a fake detector (spec §13: no page re-render per frame).
const detector = vi.hoisted(() => ({ listener: null as PitchListener | null }))
vi.mock('../../../audio/pitch/PitchyDetector', () => ({
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
const parses = vi.hoisted(() => ({ count: 0 }))
vi.mock('../../../core/tab/parseTab', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../core/tab/parseTab')>()
  return {
    ...real,
    parseTab: (...args: Parameters<typeof real.parseTab>) => {
      parses.count++
      return real.parseTab(...args)
    },
  }
})
vi.mock('../../hooks/useNotePlayer', () => ({
  useNotePlayer: () => ({
    play: async () => {},
    start: () => {},
    stop: () => {},
    isSounding: false,
    onSoundingChange: () => () => {},
  }),
}))

/** One act() per frame, as each animation frame is its own task in the browser. */
const frames = (midi: number | null, n: number) => {
  const freq = midi === null ? null : midiToFreq(midi)
  for (let i = 0; i < n; i++) {
    act(() => detector.listener?.(freq === null ? null : { freq, clarity: 0.95, rms: 0.1 }, 0.1))
  }
}

describe('TabReaderGame render cost', () => {
  it('does not re-render on identical mic frames, idle or while waiting for a note', () => {
    const onRender = vi.fn()
    render(
      <SettingsProvider storage={null}>
        <Profiler id="page" onRender={onRender}>
          <TabReaderGame storage={null} />
        </Profiler>
      </SettingsProvider>,
    )
    frames(null, 1)
    let count = onRender.mock.calls.length
    frames(null, 60)
    expect(onRender).toHaveBeenCalledTimes(count)

    fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
    frames(67, 1) // a G4, not Mary's first note
    count = onRender.mock.calls.length
    frames(67, 60)
    expect(onRender).toHaveBeenCalledTimes(count)
  })

  it('parses the tab once, not on every render', () => {
    parses.count = 0
    render(
      <SettingsProvider storage={null}>
        <TabReaderGame storage={null} />
      </SettingsProvider>,
    )
    frames(null, 1)
    fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
    frames(76, 10) // Mary's first note: the view moves on
    fireEvent.click(screen.getByRole('button', { name: '■ Stop' }))
    expect(parses.count).toBe(1)
  })
})
