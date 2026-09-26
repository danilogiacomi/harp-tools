import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MicErrorNotice } from './MicErrorNotice'

describe('MicErrorNotice', () => {
  it.each([
    ['denied', /permission/i],
    ['insecure', /HTTPS/],
    ['no-device', /No microphone/],
    ['busy', /another app/],
    ['unknown', /reload/i],
  ] as const)('explains the %s case', (kind, text) => {
    render(<MicErrorNotice kind={kind} />)
    expect(screen.getByRole('alert')).toHaveTextContent(text)
  })
})
