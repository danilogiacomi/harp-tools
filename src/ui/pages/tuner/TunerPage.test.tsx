import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildHarp } from '../../../core/harmonica/harp'
import { SettingsProvider, useSettings } from '../../settings/SettingsContext'
import { PlayMode } from './TunerPage'

const player = vi.hoisted(() => ({
  play: vi.fn(async () => {}),
  start: vi.fn(),
  stop: vi.fn(),
  isSounding: false,
}))

vi.mock('../../hooks/useNotePlayer', () => ({ useNotePlayer: () => player }))

function SetA4() {
  const { update } = useSettings()
  return (
    <>
      <button type="button" onClick={() => update({ a4: 442 })}>
        set A4
      </button>
      <button type="button" onClick={() => update({ a4: 440 })}>
        reset A4
      </button>
    </>
  )
}

const renderPlay = (key: 'C' | 'G' = 'C') =>
  render(
    <SettingsProvider storage={null}>
      <SetA4 />
      <PlayMode harp={buildHarp(key)} spelling="sharp" />
    </SettingsProvider>,
  )

describe('PlayMode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('only stops when the finger that started the sounding note lifts', () => {
    renderPlay()
    const c4 = screen.getByRole('button', { name: '1 C4' })
    const d4 = screen.getByRole('button', { name: '-1 D4' })

    fireEvent.pointerDown(c4)
    fireEvent.pointerDown(d4)
    expect(player.start).toHaveBeenLastCalledWith(62)

    fireEvent.pointerUp(c4)
    expect(player.stop).not.toHaveBeenCalled()
    expect(d4).toHaveAttribute('data-highlight', 'target')

    fireEvent.pointerUp(d4)
    expect(player.stop).toHaveBeenCalled()
    expect(d4).not.toHaveAttribute('data-highlight')
  })

  it('stops the sounding note when A4 changes', () => {
    renderPlay()
    fireEvent.click(screen.getByRole('button', { name: '▶ Play' }))
    expect(player.start).toHaveBeenCalledOnce()
    player.stop.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'set A4' }))
    expect(player.stop).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '▶ Play' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'reset A4' }))
    expect(screen.getByRole('button', { name: '▶ Play' })).toBeInTheDocument()
  })

  it('stops the sounding note when the key changes', () => {
    const { rerender } = renderPlay('C')
    fireEvent.click(screen.getByRole('button', { name: '▶ Play' }))
    player.stop.mockClear()

    rerender(
      <SettingsProvider storage={null}>
        <SetA4 />
        <PlayMode harp={buildHarp('G')} spelling="sharp" />
      </SettingsProvider>,
    )
    expect(player.stop).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '▶ Play' })).toBeInTheDocument()
  })
})
