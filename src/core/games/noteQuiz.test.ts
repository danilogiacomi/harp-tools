import { describe, expect, it } from 'vitest'
import { buildHarp, tabLabel, type HarpNote } from '../harmonica/harp'
import { DEFAULT_POOL_FILTER, buildPool } from './notePool'
import { PITCH_CLASSES, isRightHole, isRightName, pickQuizNote, quizPoints } from './noteQuiz'

const c = buildHarp('C')
const tab = (label: string): HarpNote => c.find((n) => tabLabel(n) === label)!

describe('quizPoints', () => {
  it('gives 0 for a wrong answer and a speed bonus over 10 s for a right one', () => {
    expect(quizPoints(false, 0)).toBe(0)
    expect(quizPoints(true, 0)).toBe(200)
    expect(quizPoints(true, 5000)).toBe(150)
    expect(quizPoints(true, 10000)).toBe(100)
    expect(quizPoints(true, 25000)).toBe(100)
  })
})

describe('answers', () => {
  it('checks a name by pitch class', () => {
    expect(PITCH_CLASSES).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(isRightName(tab('1'), 0)).toBe(true)
    expect(isRightName(tab('1'), 1)).toBe(false)
    expect(isRightName(tab("-3'"), 10)).toBe(true) // Bb4
    const f = buildHarp('F')
    expect(
      isRightName(
        f.find((n) => tabLabel(n) === '1')!,
        5,
      ),
    ).toBe(true)
  })
  it('accepts any box with the exact pitch, but not another octave', () => {
    expect(isRightHole(67, tab('-2'))).toBe(true)
    expect(isRightHole(67, tab('3'))).toBe(true)
    expect(isRightHole(67, tab('-3'))).toBe(false)
    expect(isRightHole(67, tab('6'))).toBe(false) // G5
  })
})

describe('pickQuizNote', () => {
  const pool = buildPool(c, DEFAULT_POOL_FILTER, false)
  it('picks from the pool and never the same box twice in a row', () => {
    const first = pickQuizNote(pool, () => 0, null)
    expect(tabLabel(first)).toBe('1')
    expect(tabLabel(pickQuizNote(pool, () => 0, first))).toBe('-1')
  })
  it('repeats when the pool has only one box', () => {
    const one = [tab('4')]
    expect(pickQuizNote(one, () => 0.9, one[0])).toBe(one[0])
  })
})
