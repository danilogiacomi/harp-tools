import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { localDate } from '../../core/log/dates'
import { isFinished, maxScore, sessionScore } from '../../core/games/session'
import { loadLog } from '../log/practiceLog'
import { loadBest } from '../scores/bestScores'
import { useScoring } from './useScoring'

beforeEach(() => localStorage.clear())

describe('useScoring', () => {
  it('saves a new best when a scored session finishes, then restarts', () => {
    const { result } = renderHook(() => useScoring('scored', 'echo|key=C', 2))
    expect(result.current.best).toBeNull()
    act(() => {
      result.current.record({ correct: true, points: 150 })
    })
    expect(result.current.newBest).toBe(false)
    act(() => {
      result.current.record({ correct: true, points: 100 })
    })
    expect(isFinished(result.current.session)).toBe(true)
    expect(result.current).toMatchObject({ best: 250, newBest: true })
    expect(loadBest(localStorage, 'echo|key=C')).toBe(250)

    act(() => result.current.restart())
    expect(result.current.session.results).toEqual([])
    expect(result.current).toMatchObject({ best: 250, newBest: false })
  })

  it('loads the saved best and keeps it when beaten by nothing', () => {
    localStorage.setItem('harp-tools:best-scores', JSON.stringify({ k: 900 }))
    const { result } = renderHook(() => useScoring('scored', 'k', 1))
    expect(result.current.best).toBe(900)
    act(() => {
      result.current.record({ correct: true, points: 100 })
    })
    expect(result.current).toMatchObject({ best: 900, newBest: false })
  })

  it('counts rounds recorded back to back from the same render', () => {
    const { result } = renderHook(() => useScoring('scored', 'k', 3))
    const { record } = result.current
    act(() => {
      record({ correct: true, points: 10 })
      record({ correct: true, points: 20 })
    })
    expect(sessionScore(result.current.session)).toBe(30)
  })

  it('never saves practice or zero scores', () => {
    const practice = renderHook(() => useScoring('practice', 'p', 1))
    act(() => {
      practice.result.current.record({ correct: true, points: 100 })
    })
    const zero = renderHook(() => useScoring('scored', 'z', 1))
    act(() => {
      zero.result.current.record({ correct: false, points: 0 })
    })
    expect(localStorage.getItem('harp-tools:best-scores')).toBeNull()
  })

  it('passes the per-round maximum to the session', () => {
    const { result } = renderHook(() => useScoring('scored', 'rhythm|x', 8, 100))
    expect(maxScore(result.current.session)).toBe(800)
    act(() => result.current.restart())
    expect(maxScore(result.current.session)).toBe(800)
  })
})

describe('useScoring — practice log', () => {
  it('logs every finished scored session, including a zero score', () => {
    const { result } = renderHook(() => useScoring('scored', 'echo|key=C', 2))
    act(() => {
      result.current.record({ correct: true, points: 150 })
    })
    expect(loadLog(localStorage).sessions).toEqual([])
    act(() => {
      result.current.record({ correct: false, points: 0 })
    })
    expect(loadLog(localStorage).sessions).toEqual([
      { date: localDate(Date.now()), game: 'echo', score: 150, max: 400 },
    ])

    const zero = renderHook(() => useScoring('scored', 'quiz|task=name', 1))
    act(() => {
      zero.result.current.record({ correct: false, points: 0 })
    })
    expect(loadLog(localStorage).sessions[1]).toMatchObject({ game: 'quiz', score: 0, max: 200 })
  })

  it('logs a finished session once, even if more rounds are recorded after it', () => {
    const { result } = renderHook(() => useScoring('scored', 'bend|key=C', 1))
    act(() => {
      result.current.record({ correct: true, points: 100 })
      result.current.record({ correct: true, points: 100 })
    })
    expect(loadLog(localStorage).sessions).toHaveLength(1)
  })

  it('never logs practice', () => {
    const { result } = renderHook(() => useScoring('practice', 'echo|key=C', 2))
    act(() => {
      for (let i = 0; i < 5; i++) result.current.record({ correct: true, points: 100 })
    })
    expect(loadLog(localStorage).sessions).toEqual([])
  })
})
