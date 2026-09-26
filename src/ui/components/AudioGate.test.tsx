import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AudioGate } from './AudioGate'

function fakeEngine() {
  let unlocked = false
  const listeners = new Set<() => void>()
  return {
    get isUnlocked() {
      return unlocked
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
    /** Simulate the browser suspending the context (e.g. iOS interruption). */
    suspend() {
      unlocked = false
      listeners.forEach((l) => l())
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
})
