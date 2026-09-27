import { describe, expect, it } from 'vitest'
import { FEEDBACK_TAIL_MS, FeedbackGate } from './feedbackGate'

describe('FeedbackGate', () => {
  it('accepts readings when nothing has played', () => {
    expect(new FeedbackGate().accepts(0)).toBe(true)
  })

  it('rejects readings while a note sounds and for 150 ms after it stops', () => {
    expect(FEEDBACK_TAIL_MS).toBe(150)
    const gate = new FeedbackGate()
    gate.noteStarted()
    expect(gate.accepts(500)).toBe(false)
    expect(gate.accepts(5000)).toBe(false)
    gate.noteEnded(1000)
    expect(gate.accepts(1000)).toBe(false)
    expect(gate.accepts(1149)).toBe(false)
    expect(gate.accepts(1150)).toBe(true)
  })

  it('closes again when the next note starts', () => {
    const gate = new FeedbackGate()
    gate.noteStarted()
    gate.noteEnded(0)
    expect(gate.accepts(200)).toBe(true)
    gate.noteStarted()
    expect(gate.accepts(300)).toBe(false)
  })

  it('takes a custom tail', () => {
    const gate = new FeedbackGate(50)
    gate.noteStarted()
    gate.noteEnded(0)
    expect(gate.accepts(49)).toBe(false)
    expect(gate.accepts(50)).toBe(true)
  })
})
