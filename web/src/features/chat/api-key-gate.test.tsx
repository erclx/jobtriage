import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

  it('renders over a stored provider when switchRequested and cancels without clearing', async () => {
    window.sessionStorage.setItem(SESSION_KEYS.apiKey, 'sk-ant-existing')
    const onResolveSwitch = vi.fn()
    const user = userEvent.setup()

    render(
      <ApiKeyGate switchRequested onResolveSwitch={onResolveSwitch}>
        <div>protected</div>
      </ApiKeyGate>,
    )

    expect(
      screen.getByRole('heading', { name: /Bring your own Anthropic key/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText('protected')).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /Cancel and keep current provider/i }),
    )

    expect(onResolveSwitch).toHaveBeenCalledTimes(1)
    expect(window.sessionStorage.getItem(SESSION_KEYS.apiKey)).toBe(
      'sk-ant-existing',
    )
  })

  it('cancels the switch overlay on Escape without clearing storage', async () => {
    window.sessionStorage.setItem(SESSION_KEYS.apiKey, 'sk-ant-existing')
    const onResolveSwitch = vi.fn()
    const user = userEvent.setup()

    render(
      <ApiKeyGate switchRequested onResolveSwitch={onResolveSwitch}>
        <div>protected</div>
      </ApiKeyGate>,
    )

    await user.keyboard('{Escape}')

    expect(onResolveSwitch).toHaveBeenCalledTimes(1)
    expect(window.sessionStorage.getItem(SESSION_KEYS.apiKey)).toBe(
      'sk-ant-existing',
    )
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
