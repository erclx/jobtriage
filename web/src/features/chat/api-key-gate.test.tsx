import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ApiKeyGate } from './api-key-gate'
import { SESSION_KEYS } from './storage-keys'

describe('ApiKeyGate', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  afterEach(() => {
    window.sessionStorage.clear()
  })

  it('renders the gate when no key is stored', async () => {
    render(
      <ApiKeyGate>
        <div>protected</div>
      </ApiKeyGate>,
    )

    expect(
      await screen.findByRole('heading', {
        name: /Bring your own Anthropic key/i,
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText('protected')).not.toBeInTheDocument()
  })

  it('renders children when a key is already in sessionStorage', async () => {
    window.sessionStorage.setItem(SESSION_KEYS.apiKey, 'sk-ant-existing')

    render(
      <ApiKeyGate>
        <div>protected</div>
      </ApiKeyGate>,
    )

    expect(await screen.findByText('protected')).toBeInTheDocument()
  })

  it('rejects keys that do not start with sk-ant-', async () => {
    const user = userEvent.setup()
    render(
      <ApiKeyGate>
        <div>protected</div>
      </ApiKeyGate>,
    )

    const input = await screen.findByLabelText(/Anthropic API key/i)
    await user.type(input, 'wrong-key-shape')
    await user.click(screen.getByRole('button', { name: /start chat/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/sk-ant-/i)
    expect(window.sessionStorage.getItem(SESSION_KEYS.apiKey)).toBeNull()
  })

  it('persists a valid key and unmounts the gate', async () => {
    const user = userEvent.setup()
    render(
      <ApiKeyGate>
        <div>protected</div>
      </ApiKeyGate>,
    )

    const input = await screen.findByLabelText(/Anthropic API key/i)
    await user.type(input, 'sk-ant-valid')
    await user.click(screen.getByRole('button', { name: /start chat/i }))

    expect(await screen.findByText('protected')).toBeInTheDocument()
    expect(window.sessionStorage.getItem(SESSION_KEYS.apiKey)).toBe(
      'sk-ant-valid',
    )
  })
})
