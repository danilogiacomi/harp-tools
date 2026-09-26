import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AudioGate } from './AudioGate'

function fakeEngine() {
  let unlocked = false
  let needsGesture = true
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((l) => l())
  return {
    get isUnlocked() {
      return unlocked
    },
    get needsGesture() {
      return !unlocked && needsGesture
    },
    unlock: vi.fn(async () => {
      unlocked = true
    }),
    onStateChange(l: () => void) {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
    /**
     * Simulate the browser suspending the context (e.g. iOS interruption). With `autoResuming`
     * the engine is still trying to resume on its own; otherwise it already needs a gesture.
     */
    suspend(autoResuming = false) {
      unlocked = false
      needsGesture = !autoResuming
      notify()
    },
    resumed() {
      unlocked = true
      notify()
    },
    resumeRefused() {
      needsGesture = true
      notify()
    },
  }
}

describe('AudioGate', () => {
  it('asks for a tap before showing audio content', async () => {
    const engine = fakeEngine()
    render(
      <AudioGate engine={engine} supported>
        <p>audio stuff</p>
      </AudioGate>,
    )
    expect(screen.queryByText('audio stuff')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /tap to start/i }))
    expect(await screen.findByText('audio stuff')).toBeInTheDocument()
    expect(engine.unlock).toHaveBeenCalledOnce()
  })

  it('asks again if the browser suspends audio', async () => {
    const engine = fakeEngine()
    await engine.unlock()
    render(
      <AudioGate engine={engine} supported>
        <p>audio stuff</p>
      </AudioGate>,
    )
    expect(screen.getByText('audio stuff')).toBeInTheDocument()
    act(() => engine.suspend())
    expect(screen.getByRole('button', { name: /tap to start/i })).toBeInTheDocument()
  })

  it('explains when Web Audio is not supported', () => {
    render(
      <AudioGate engine={fakeEngine()} supported={false}>
        <p>audio stuff</p>
      </AudioGate>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/Web Audio/)
  })

  describe('automatic resume', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    const renderUnlocked = async () => {
      const engine = fakeEngine()
      await engine.unlock()
      vi.useFakeTimers()
      render(
        <AudioGate engine={engine} supported>
          <p>audio stuff</p>
        </AudioGate>,
      )
      return engine
    }

    it('keeps the tool mounted when audio resumes on its own', async () => {
      const engine = await renderUnlocked()
      act(() => engine.suspend(true))
      expect(screen.getByText('audio stuff')).toBeInTheDocument()
      act(() => engine.resumed())
      act(() => vi.advanceTimersByTime(1000))
      expect(screen.getByText('audio stuff')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /tap to start/i })).toBeNull()
    })

    it('shows the overlay when the automatic resume is refused', async () => {
      const engine = await renderUnlocked()
      act(() => engine.suspend(true))
      act(() => engine.resumeRefused())
      expect(screen.queryByText('audio stuff')).toBeNull()
      expect(screen.getByRole('button', { name: /tap to start/i })).toBeInTheDocument()
    })

    it('shows the overlay when the automatic resume is still pending after a grace period', async () => {
      const engine = await renderUnlocked()
      act(() => engine.suspend(true))
      act(() => vi.advanceTimersByTime(250))
      expect(screen.getByText('audio stuff')).toBeInTheDocument()
      act(() => vi.advanceTimersByTime(100))
      expect(screen.getByRole('button', { name: /tap to start/i })).toBeInTheDocument()
    })
  })
})
