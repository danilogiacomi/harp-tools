import { act, fireEvent, render, screen } from '@testing-library/react'
import { Profiler } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { PitchListener } from '../../../audio/pitch/PitchDetector'
import { midiToFreq } from '../../../core/music/pitch'
import { fakeBand } from '../../../test/fakeBackingScheduler'
import { SettingsProvider } from '../../settings/SettingsContext'
import { HeroGame } from './HarpHeroPage'

// The real useGameAudio and usePitch over a fake detector (spec: no page re-render per frame).
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
vi.mock('../../hooks/useNotePlayer', () => ({
  useNotePlayer: () => ({
    play: async () => {},
    start: () => {},
    stop: () => {},
    isSounding: false,
    onSoundingChange: () => () => {},
  }),
}))
vi.mock(
  '../../../audio/backing/BackingScheduler',
  () => import('../../../test/fakeBackingScheduler'),
)

/** One act() per frame, as each animation frame is its own task in the browser. */
const frames = (midi: number | null, n: number) => {
  const freq = midi === null ? null : midiToFreq(midi)
  for (let i = 0; i < n; i++) {
    act(() => detector.listener?.(freq === null ? null : { freq, clarity: 0.95, rms: 0.1 }, 0.1))
  }
}

describe('HeroGame render cost', () => {
  it('does not re-render on mic frames that judge nothing, idle or mid-song', () => {
    const onRender = vi.fn()
    render(
      <SettingsProvider storage={null}>
        <Profiler id="page" onRender={onRender}>
          <HeroGame storage={null} />
        </Profiler>
      </SettingsProvider>,
    )
    frames(null, 1)
    let count = onRender.mock.calls.length
    frames(null, 60)
    expect(onRender).toHaveBeenCalledTimes(count)

    fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
    act(() => fakeBand.onBar?.(-1))
    frames(67, 1) // a G4 during the count-in: nothing is due yet
    count = onRender.mock.calls.length
    frames(67, 60)
    expect(onRender).toHaveBeenCalledTimes(count)
  })
})
