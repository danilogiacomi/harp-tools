import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildHarp } from '../../../core/harmonica/harp'
import { SettingsProvider, useSettings } from '../../settings/SettingsContext'
import type { PitchState } from '../../hooks/usePitch'
import { ListenMode, PlayMode } from './TunerPage'

const player = vi.hoisted(() => ({
  play: vi.fn(async () => {}),
  start: vi.fn(),
  stop: vi.fn(),
  isSounding: false,
}))

vi.mock('../../hooks/useNotePlayer', () => ({ useNotePlayer: () => player }))

const pitch = vi.hoisted(() => ({
  state: { reading: null, rms: 0, status: 'starting', error: null } as PitchState,
}))
vi.mock('../../hooks/usePitch', () => ({ usePitch: () => pitch.state }))

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

  it('offers the Reed / Pure reference sound in the Play toolbar', () => {
    renderPlay()
    expect(screen.getByRole('group', { name: 'Reference sound' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reed' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('ListenMode', () => {
  const renderListen = () =>
    render(
      <SettingsProvider storage={null}>
        <ListenMode harp={buildHarp('C')} spelling="sharp" />
      </SettingsProvider>,
    )
  it('keeps the same layout while the mic starts, while silent and while hearing a note', () => {
    pitch.state = { reading: null, rms: 0, status: 'starting', error: null }
    const { container, rerender } = renderListen()
    expect(screen.getByText('Waiting for microphone permission…')).toBeInTheDocument()
    const rows = () => [...container.children].map((el) => el.tagName + '.' + el.className)
    const starting = rows()

    pitch.state = { reading: null, rms: 0.001, status: 'listening', error: null }
    rerender(
      <SettingsProvider storage={null}>
        <ListenMode harp={buildHarp('C')} spelling="sharp" />
      </SettingsProvider>,
    )
    expect(screen.queryByText('Waiting for microphone permission…')).toBeNull()
    expect(rows()).toEqual(starting)

    pitch.state = {
      reading: { freq: 440, clarity: 1, rms: 0.1 },
      rms: 0.1,
      status: 'listening',
      error: null,
    }
    rerender(
      <SettingsProvider storage={null}>
        <ListenMode harp={buildHarp('C')} spelling="sharp" />
      </SettingsProvider>,
    )
    expect(screen.getByText('440.0 Hz')).toBeInTheDocument()
    expect(rows()).toEqual(starting)
  })
})
