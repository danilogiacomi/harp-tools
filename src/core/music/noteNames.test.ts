import { describe, expect, it } from 'vitest'
import { noteName, pitchClassName } from './noteNames'

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

describe('pitchClassName', () => {
  it('names a pitch class without an octave, in either spelling', () => {
    expect(pitchClassName(0)).toBe('C')
    expect(pitchClassName(1, 'sharp')).toBe('C#')
    expect(pitchClassName(1, 'flat')).toBe('Db')
    expect(pitchClassName(10, 'flat')).toBe('Bb')
    expect(pitchClassName(13)).toBe('C#')
  })
})
