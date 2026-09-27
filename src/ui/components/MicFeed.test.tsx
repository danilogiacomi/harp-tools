import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PitchListener } from '../../audio/pitch/PitchDetector'
import type { PitchState } from '../hooks/usePitch'
import { MicFeed } from './MicFeed'

const pitch = vi.hoisted(() => ({
  state: { reading: null, rms: 0, status: 'starting', error: null } as PitchState,
  enabled: null as boolean | null,
  listener: null as PitchListener | null,
}))
vi.mock('../hooks/usePitch', () => ({
  usePitch: (enabled: boolean, onReading: PitchListener) => {
    pitch.enabled = enabled
    pitch.listener = onReading
    return pitch.state
  },
}))

describe('MicFeed', () => {
  it('passes readings through and keeps its status line in every state', () => {
    const onReading = vi.fn()
    const { container, rerender } = render(<MicFeed onReading={onReading} />)
    expect(pitch.enabled).toBe(true)
    expect(screen.getByText('Waiting for microphone permission…')).toBeInTheDocument()
    const shape = [...container.children].map((e) => e.tagName)

    pitch.state = { reading: null, rms: 0, status: 'listening', error: null }
    rerender(<MicFeed onReading={onReading} />)
    expect(screen.queryByText('Waiting for microphone permission…')).toBeNull()
    expect([...container.children].map((e) => e.tagName)).toEqual(shape)

    pitch.listener?.({ freq: 440, clarity: 1, rms: 0.1 }, 0.1)
    expect(onReading).toHaveBeenCalledWith({ freq: 440, clarity: 1, rms: 0.1 }, 0.1)
  })

  it('shows the mic error', () => {
    pitch.state = { reading: null, rms: 0, status: 'error', error: 'denied' }
    render(<MicFeed onReading={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Microphone permission was denied')
  })
})
