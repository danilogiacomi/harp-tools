import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_POOL_FILTER } from '../../../core/games/notePool'
import { recordRound, startSession, type SessionState } from '../../../core/games/session'
import type { Scoring } from '../../hooks/useScoring'
import { SettingsProvider } from '../../settings/SettingsContext'
import { HoldMeter } from './HoldMeter'
import { MatchSettings } from './MatchSettings'
import { ModeToggle } from './ModeToggle'
import { PoolFilterPanel } from './PoolFilterPanel'
import { ScorePanel } from './ScorePanel'

const withSettings = (ui: ReactNode) =>
  render(<SettingsProvider storage={null}>{ui}</SettingsProvider>)
const scoring = (session: SessionState, patch: Partial<Scoring> = {}): Scoring => ({
  session,
  best: null,
  newBest: false,
  record: vi.fn(),
  restart: vi.fn(),
  ...patch,
})

describe('ModeToggle', () => {
  it('shows and switches the mode', () => {
    const onChange = vi.fn()
    render(<ModeToggle mode="practice" onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Practice' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    expect(onChange).toHaveBeenCalledWith('scored')
  })
})

describe('PoolFilterPanel', () => {
  it('edits the hole range and technique groups', () => {
    const onChange = vi.fn()
    withSettings(<PoolFilterPanel filter={DEFAULT_POOL_FILTER} onChange={onChange} />)
    fireEvent.change(screen.getByRole('combobox', { name: /From hole/ }), {
      target: { value: '3' },
    })
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_POOL_FILTER, fromHole: 3 })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Bends' }))
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_POOL_FILTER,
      groups: ['plain', 'bends'],
    })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Blow / draw' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_POOL_FILTER, groups: [] })
  })

  it('binds "Advanced over-notes" to the global setting', () => {
    withSettings(<PoolFilterPanel filter={DEFAULT_POOL_FILTER} onChange={vi.fn()} />)
    const advanced = screen.getByRole('checkbox', { name: 'Advanced over-notes' })
    expect(advanced).not.toBeChecked()
    fireEvent.click(advanced)
    expect(advanced).toBeChecked()
  })

  it('can show only some groups and hide the advanced toggle', () => {
    withSettings(
      <PoolFilterPanel
        filter={DEFAULT_POOL_FILTER}
        onChange={vi.fn()}
        groups={[]}
        advancedToggle={false}
      />,
    )
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.getByRole('combobox', { name: /To hole/ })).toBeInTheDocument()
  })
})

describe('ScorePanel', () => {
  it('shows the round and score while playing', () => {
    const s = recordRound(startSession('scored'), { correct: true, points: 150 })
    render(<ScorePanel scoring={scoring(s, { best: 900 })} onRestart={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Round 2 of 10 · Score 150 · Best 900')
  })

  it('summarises a finished session', () => {
    let s = startSession('scored', 2)
    s = recordRound(s, { correct: true, points: 150 })
    s = recordRound(s, { correct: false, points: 0 })
    const onRestart = vi.fn()
    render(<ScorePanel scoring={scoring(s, { best: 150, newBest: true })} onRestart={onRestart} />)
    expect(screen.getByRole('status')).toHaveTextContent('Final score: 150 / 400')
    expect(screen.getByRole('status')).toHaveTextContent('1 of 2 correct')
    expect(screen.getByRole('status')).toHaveTextContent('New best score!')
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(onRestart).toHaveBeenCalled()
  })

  it('renders nothing in practice', () => {
    const { container } = render(
      <ScorePanel scoring={scoring(startSession('practice'))} onRestart={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('MatchSettings', () => {
  it('edits the matcher thresholds', () => {
    withSettings(<MatchSettings melodyHold />)
    fireEvent.change(screen.getByRole('slider', { name: /Tolerance/ }), { target: { value: '30' } })
    expect(screen.getByText('±30¢')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('slider', { name: /Hold time/ }), {
      target: { value: '800' },
    })
    expect(screen.getByText('800 ms')).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /Melody hold/ })).toHaveValue('250')
  })

  it('hides the melody hold unless asked', () => {
    withSettings(<MatchSettings />)
    expect(screen.queryByRole('slider', { name: /Melody hold/ })).toBeNull()
  })
})

describe('HoldMeter', () => {
  it('shows progress as a percentage', () => {
    render(<HoldMeter progress={0.456} />)
    expect(screen.getByRole('progressbar', { name: 'Hold' })).toHaveAttribute('aria-valuenow', '46')
  })
})
