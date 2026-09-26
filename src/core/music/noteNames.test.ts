import { describe, expect, it } from 'vitest'
import { noteName } from './noteNames'

describe('noteName', () => {
  it('names natural notes with octave numbers', () => {
    expect(noteName(60)).toBe('C4')
    expect(noteName(55)).toBe('G3')
    expect(noteName(59)).toBe('B3')
    expect(noteName(96)).toBe('C7')
  })
  it('uses sharps by default and flats on request', () => {
    expect(noteName(61)).toBe('C#4')
    expect(noteName(61, 'flat')).toBe('Db4')
    expect(noteName(70, 'flat')).toBe('Bb4')
  })
})
