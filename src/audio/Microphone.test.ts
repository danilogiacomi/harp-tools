import { describe, expect, it } from 'vitest'
import { mapMicError } from './Microphone'

describe('mapMicError', () => {
  it.each([
    ['NotAllowedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotFoundError', 'no-device'],
    ['OverconstrainedError', 'no-device'],
    ['NotReadableError', 'busy'],
    ['AbortError', 'busy'],
    ['SomethingElse', 'unknown'],
  ])('maps %s to %s', (name, kind) => {
    expect(mapMicError(new DOMException('x', name))).toBe(kind)
  })
  it('handles non-DOMException values', () => {
    expect(mapMicError(new Error('boom'))).toBe('unknown')
    expect(mapMicError(null)).toBe('unknown')
  })
})
