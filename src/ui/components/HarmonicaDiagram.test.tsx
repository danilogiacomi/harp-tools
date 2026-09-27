import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { buildHarp, noteId } from '../../core/harmonica/harp'
import { HarmonicaDiagram } from './HarmonicaDiagram'

const harp = buildHarp('C')
type Props = Parameters<typeof HarmonicaDiagram>[0]
const renderDiagram = (props: Partial<Props> = {}) =>
  render(
    <HarmonicaDiagram
      harp={harp}
      spelling="sharp"
      labelMode="note"
      showAdvanced={false}
      {...props}
    />,
  )

describe('HarmonicaDiagram', () => {
  it('renders the hole numbers', () => {
    renderDiagram()
    for (let h = 1; h <= 10; h++)
      expect(screen.getByTestId(`hole-${h}`)).toHaveTextContent(String(h))
  })

  it('puts blow notes above the hole numbers and draw notes below', () => {
    renderDiagram()
    const hole1 = screen.getByTestId('hole-1')
    const blow = screen.getByRole('button', { name: '1 C4' })
    const draw = screen.getByRole('button', { name: '-1 D4' })
    expect(hole1.compareDocumentPosition(blow) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    expect(hole1.compareDocumentPosition(draw) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('colour-codes notes by technique', () => {
    renderDiagram()
    expect(screen.getByRole('button', { name: '4 C5' })).toHaveAttribute('data-color', 'blow')
    expect(screen.getByRole('button', { name: '-4 D5' })).toHaveAttribute('data-color', 'draw')
    expect(screen.getByRole('button', { name: "-3'' A4" })).toHaveAttribute('data-color', 'bend')
    expect(screen.getByRole('button', { name: "10'' A#6" })).toHaveAttribute('data-color', 'bend')
    expect(screen.getByRole('button', { name: '6o A#5' })).toHaveAttribute('data-color', 'overblow')
    expect(screen.getByRole('button', { name: '7od C#6' })).toHaveAttribute(
      'data-color',
      'overdraw',
    )
  })

  it('hides advanced over-notes unless showAdvanced is on', () => {
    const { rerender } = renderDiagram()
    expect(screen.queryByRole('button', { name: '2o G#4' })).toBeNull()
    rerender(<HarmonicaDiagram harp={harp} spelling="sharp" labelMode="note" showAdvanced />)
    expect(screen.getByRole('button', { name: '2o G#4' })).toHaveAttribute('data-advanced', 'true')
  })

  it('shows tab labels in tab mode', () => {
    renderDiagram({ labelMode: 'tab' })
    expect(screen.getByRole('button', { name: "-3'' A4" })).toHaveTextContent("-3''")
  })

  it('uses flat spelling when asked', () => {
    renderDiagram({ harp: buildHarp('F'), spelling: 'flat' })
    expect(screen.getByRole('button', { name: '4 F5' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '-4 G5' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1 F4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "-3' Eb5" })).toBeInTheDocument()
  })

  it('applies highlights by note id', () => {
    const c4 = harp.find((n) => n.hole === 1 && n.technique === 'blow')!
    renderDiagram({ highlights: new Map([[noteId(c4), 'detected']]) })
    expect(screen.getByRole('button', { name: '1 C4' })).toHaveAttribute(
      'data-highlight',
      'detected',
    )
  })

  it('marks the target cell with aria-current, for screen readers', () => {
    const c4 = harp.find((n) => n.hole === 1 && n.technique === 'blow')!
    const d4 = harp.find((n) => n.hole === 1 && n.technique === 'draw')!
    renderDiagram({
      highlights: new Map([
        [noteId(c4), 'target'],
        [noteId(d4), 'detected'],
      ]),
    })
    expect(screen.getByRole('button', { name: '1 C4' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: '-1 D4' })).not.toHaveAttribute('aria-current')
  })

  it('reports press and release', () => {
    const onNoteDown = vi.fn()
    const onNoteUp = vi.fn()
    renderDiagram({ onNoteDown, onNoteUp })
    const a4 = screen.getByRole('button', { name: "-3'' A4" })
    fireEvent.pointerDown(a4)
    expect(onNoteDown).toHaveBeenCalledWith(expect.objectContaining({ midi: 69 }))
    fireEvent.pointerUp(a4)
    expect(onNoteUp).toHaveBeenCalledWith(expect.objectContaining({ midi: 69 }))
  })

  it('marks cells interactive only when notes can be pressed', () => {
    const { unmount } = renderDiagram()
    expect(screen.getByRole('button', { name: '1 C4' })).not.toHaveAttribute('data-interactive')
    unmount()
    renderDiagram({ onNoteDown: vi.fn() })
    expect(screen.getByRole('button', { name: '1 C4' })).toHaveAttribute('data-interactive', 'true')
  })

  it('releases the note when the browser cancels the pointer (e.g. a scroll gesture)', () => {
    const onNoteDown = vi.fn()
    const onNoteUp = vi.fn()
    renderDiagram({ onNoteDown, onNoteUp })
    const c4 = screen.getByRole('button', { name: '1 C4' })
    fireEvent.pointerDown(c4)
    fireEvent.pointerCancel(c4)
    expect(onNoteUp).toHaveBeenCalledWith(expect.objectContaining({ midi: 60 }))
  })

  it('ignores non-primary mouse buttons', () => {
    const onNoteDown = vi.fn()
    renderDiagram({ onNoteDown })
    fireEvent.pointerDown(screen.getByRole('button', { name: '1 C4' }), { button: 2 })
    expect(onNoteDown).not.toHaveBeenCalled()
  })

  it('conceals note names from every accessible name when asked', () => {
    renderDiagram({ concealNotes: true, showAdvanced: true })
    expect(screen.getByRole('button', { name: '1 blow' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '-1 draw' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "-3'' draw bend" })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "10'' blow bend" })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '6o overblow' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '7od overdraw' })).toBeInTheDocument()
    // No accessible name spells a note (a letter A–G, optional # or b, then a digit).
    for (const button of screen.getAllByRole('button')) {
      expect(button.getAttribute('aria-label')).not.toMatch(/[A-G](#|b)?-?\d/)
      expect(button).not.toHaveAttribute('title')
    }
  })

  it('keeps note names in accessible names by default', () => {
    renderDiagram()
    expect(screen.getByRole('button', { name: '1 C4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "-3'' A4" })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '1 blow' })).toBeNull()
  })
})
