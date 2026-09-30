import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { InstallButton } from './InstallButton'

const DESKTOP = { standalone: false, ios: false }

function firePrompt(
  outcome: 'accepted' | 'dismissed' = 'accepted',
  promptFn?: () => Promise<void>
) {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>
    userChoice: Promise<{ outcome: string }>
  }
  event.prompt = vi.fn(promptFn ?? (async () => {}))
  event.userChoice = Promise.resolve({ outcome })
  act(() => {
    window.dispatchEvent(event)
  })
  return event
}

describe('InstallButton', () => {
  it('shows nothing until the browser offers installation', () => {
    const { container } = render(<InstallButton env={DESKTOP} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows "Install app" after beforeinstallprompt and prompts on click', async () => {
    render(<InstallButton env={DESKTOP} />)
    const event = firePrompt()
    expect(event.defaultPrevented).toBe(true)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Install app' }))
    })
    expect(event.prompt).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Install app' })).toBeNull()
  })

  it('hides after the app is installed', () => {
    render(<InstallButton env={DESKTOP} />)
    firePrompt()
    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })
    expect(screen.queryByRole('button', { name: 'Install app' })).toBeNull()
  })

  it('shows the Add to Home Screen hint on iOS', () => {
    render(<InstallButton env={{ standalone: false, ios: true }} />)
    expect(screen.getByText('On iPhone or iPad: Share → Add to Home Screen')).toBeInTheDocument()
  })

  it('shows nothing when already running as an installed app', () => {
    const { container } = render(<InstallButton env={{ standalone: true, ios: true }} />)
    firePrompt()
    expect(container).toBeEmptyDOMElement()
  })

  it('hides the button even when prompt() rejects', async () => {
    render(<InstallButton env={DESKTOP} />)
    firePrompt('accepted', async () => {
      throw new DOMException('used', 'InvalidStateError')
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Install app' }))
    })
    expect(screen.queryByRole('button', { name: 'Install app' })).toBeNull()
  })
})
