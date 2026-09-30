import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pwaStub } from '../../test/pwaRegisterStub'
import { OFFLINE_NOTICE_MS, UpdateBar } from './UpdateBar'

afterEach(() => {
  pwaStub.reset()
  vi.useRealTimers()
})

describe('UpdateBar', () => {
  it('renders nothing when there is no news', () => {
    const { container } = render(<UpdateBar />)
    expect(container).toBeEmptyDOMElement()
  })

  it('offers a reload for a new version and only reloads when asked', () => {
    pwaStub.needRefresh = true
    const update = vi.spyOn(pwaStub, 'updateServiceWorker')
    render(<UpdateBar />)
    expect(screen.getByRole('status')).toHaveTextContent('A new version is ready')
    expect(update).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(update).toHaveBeenCalledWith(true)
  })

  it('can dismiss the new-version bar', () => {
    pwaStub.needRefresh = true
    render(<UpdateBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('says "Ready to work offline" once, then hides it by itself', () => {
    vi.useFakeTimers()
    pwaStub.offlineReady = true
    render(<UpdateBar />)
    expect(screen.getByRole('status')).toHaveTextContent('Ready to work offline')
    act(() => vi.advanceTimersByTime(OFFLINE_NOTICE_MS))
    expect(screen.queryByRole('status')).toBeNull()
  })
})
