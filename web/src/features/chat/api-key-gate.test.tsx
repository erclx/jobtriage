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

  it('should render the gate when no key is stored', async () => {
    render(
      <ApiKeyGate>
        <div>protected</div>
      </ApiKeyGate>,
    )

    expect(
      await screen.findByRole('heading', {
        name: /Bring your own API key/i,
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText('protected')).not.toBeInTheDocument()
  })

  it('should render children when a key is already in sessionStorage', async () => {
    window.sessionStorage.setItem(SESSION_KEYS.apiKey, 'sk-ant-existing')

    render(
      <ApiKeyGate>
        <div>protected</div>
      </ApiKeyGate>,
    )

    expect(await screen.findByText('protected')).toBeInTheDocument()
  })

  it('should default the provider picker to Anthropic', async () => {
    render(
      <ApiKeyGate>
        <div>protected</div>
      </ApiKeyGate>,
    )

    const anthropicRadio = await screen.findByRole('radio', {
      name: 'Anthropic',
    })
    expect(anthropicRadio).toBeChecked()
    expect(screen.getByLabelText(/Anthropic API key/i)).toBeInTheDocument()
  })

  it('should swap label, placeholder, and helper link when switching to OpenAI', async () => {
    const user = userEvent.setup()
    render(
      <ApiKeyGate>
        <div>protected</div>
      </ApiKeyGate>,
    )

    await user.click(await screen.findByRole('radio', { name: 'OpenAI' }))

    expect(screen.getByLabelText(/OpenAI API key/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('sk-...')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Get an OpenAI key/i }),
    ).toBeInTheDocument()
  })

  it('should surface the free-tier hint when Gemini is selected', async () => {
    const user = userEvent.setup()
    render(
      <ApiKeyGate>
        <div>protected</div>
      </ApiKeyGate>,
    )

    await user.click(await screen.findByRole('radio', { name: 'Gemini' }))

    expect(
      screen.getByRole('link', { name: /free Gemini key/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Free tier/i)).toBeInTheDocument()
  })

  it('should show a soft prefix warning on blur but allow submit', async () => {
    const user = userEvent.setup()
    render(
      <ApiKeyGate>
        <div>protected</div>
      </ApiKeyGate>,
    )

    const input = await screen.findByLabelText(/Anthropic API key/i)
    await user.type(input, 'wrong-shape')
    await user.tab()

    expect(screen.getByRole('status')).toHaveTextContent(/sk-ant-/i)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /start chat/i }))

    expect(await screen.findByText('protected')).toBeInTheDocument()
    expect(window.sessionStorage.getItem(SESSION_KEYS.apiKey)).toBe(
      'wrong-shape',
    )
  })

  it('should persist provider as openai when OpenAI is submitted', async () => {
    const user = userEvent.setup()
    render(
      <ApiKeyGate>
        <div>protected</div>
      </ApiKeyGate>,
    )

    await user.click(await screen.findByRole('radio', { name: 'OpenAI' }))
    const input = screen.getByLabelText(/OpenAI API key/i)
    await user.type(input, 'sk-openai-test')
    await user.click(screen.getByRole('button', { name: /start chat/i }))

    expect(await screen.findByText('protected')).toBeInTheDocument()
    expect(window.sessionStorage.getItem(SESSION_KEYS.provider)).toBe('openai')
    expect(window.sessionStorage.getItem(SESSION_KEYS.apiKey)).toBe(
      'sk-openai-test',
    )
  })

  it('should persist provider as gemini when Gemini is submitted', async () => {
    const user = userEvent.setup()
    render(
      <ApiKeyGate>
        <div>protected</div>
      </ApiKeyGate>,
    )

    await user.click(await screen.findByRole('radio', { name: 'Gemini' }))
    const input = screen.getByLabelText(/Gemini API key/i)
    await user.type(input, 'AIza-test-key')
    await user.click(screen.getByRole('button', { name: /start chat/i }))

    expect(await screen.findByText('protected')).toBeInTheDocument()
    expect(window.sessionStorage.getItem(SESSION_KEYS.provider)).toBe('gemini')
    expect(window.sessionStorage.getItem(SESSION_KEYS.apiKey)).toBe(
      'AIza-test-key',
    )
  })

  it('should not persist provider when the user changes radios without submitting', async () => {
    window.sessionStorage.setItem(SESSION_KEYS.apiKey, 'sk-ant-existing')
    window.sessionStorage.setItem(SESSION_KEYS.provider, 'anthropic')
    const onResolveSwitch = vi.fn()
    const user = userEvent.setup()

    render(
      <ApiKeyGate switchRequested onResolveSwitch={onResolveSwitch}>
        <div>protected</div>
      </ApiKeyGate>,
    )

    await user.click(await screen.findByRole('radio', { name: 'OpenAI' }))
    await user.click(
      screen.getByRole('button', { name: /Cancel and keep current provider/i }),
    )

    expect(window.sessionStorage.getItem(SESSION_KEYS.provider)).toBe(
      'anthropic',
    )
  })

  it('should render over a stored provider when switchRequested and cancels without clearing', async () => {
    window.sessionStorage.setItem(SESSION_KEYS.apiKey, 'sk-ant-existing')
    const onResolveSwitch = vi.fn()
    const user = userEvent.setup()

    render(
      <ApiKeyGate switchRequested onResolveSwitch={onResolveSwitch}>
        <div>protected</div>
      </ApiKeyGate>,
    )

    expect(
      screen.getByRole('heading', { name: /Bring your own API key/i }),
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

  it('should cancel the switch overlay on Escape without clearing storage', async () => {
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

  it('should clear the auto-populated profile when switching from mock to BYOK', async () => {
    window.sessionStorage.setItem(SESSION_KEYS.provider, 'mock')
    window.sessionStorage.setItem(
      SESSION_KEYS.profile,
      '# Demo profile\n- nurse',
    )
    const user = userEvent.setup()

    render(
      <ApiKeyGate switchRequested onResolveSwitch={() => {}}>
        <div>protected</div>
      </ApiKeyGate>,
    )

    const input = await screen.findByLabelText(/Anthropic API key/i)
    await user.type(input, 'sk-ant-real')
    await user.click(screen.getByRole('button', { name: /start chat/i }))

    expect(window.sessionStorage.getItem(SESSION_KEYS.provider)).toBe(
      'anthropic',
    )
    expect(window.sessionStorage.getItem(SESSION_KEYS.profile)).toBeNull()
  })

  it('should keep the profile when switching between BYOK and Ollama', async () => {
    window.sessionStorage.setItem(SESSION_KEYS.apiKey, 'sk-ant-existing')
    window.sessionStorage.setItem(SESSION_KEYS.provider, 'anthropic')
    window.sessionStorage.setItem(
      SESSION_KEYS.profile,
      '# Real profile\n- senior engineer',
    )
    const user = userEvent.setup()

    render(
      <ApiKeyGate switchRequested onResolveSwitch={() => {}}>
        <div>protected</div>
      </ApiKeyGate>,
    )

    await user.click(
      await screen.findByRole('button', { name: /Use local Ollama/i }),
    )

    expect(window.sessionStorage.getItem(SESSION_KEYS.provider)).toBe('ollama')
    expect(window.sessionStorage.getItem(SESSION_KEYS.profile)).toBe(
      '# Real profile\n- senior engineer',
    )
  })

  it('should set provider to mock and unmount the gate on demo onramp click', async () => {
    const user = userEvent.setup()
    render(
      <ApiKeyGate>
        <div>protected</div>
      </ApiKeyGate>,
    )

    await user.click(
      await screen.findByRole('button', { name: /Try the demo, no key/i }),
    )

    expect(await screen.findByText('protected')).toBeInTheDocument()
    expect(window.sessionStorage.getItem(SESSION_KEYS.provider)).toBe('mock')
    expect(window.sessionStorage.getItem(SESSION_KEYS.apiKey)).toBeNull()
  })

  it('should keep the demo onramp visible alongside the BYOK provider picker', async () => {
    render(
      <ApiKeyGate>
        <div>protected</div>
      </ApiKeyGate>,
    )

    expect(
      await screen.findByRole('button', { name: /Try the demo, no key/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /Bring your own API key/i }),
    ).toBeInTheDocument()
  })

  it('should hide the Ollama onramp when running under a Vercel deploy', async () => {
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'production')

    render(
      <ApiKeyGate>
        <div>protected</div>
      </ApiKeyGate>,
    )

    expect(
      await screen.findByRole('heading', {
        name: /Bring your own API key/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Use local Ollama/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Requires Ollama/i)).not.toBeInTheDocument()

    vi.unstubAllEnvs()
  })

  it('should show the Ollama onramp on the local dev surface', async () => {
    render(
      <ApiKeyGate>
        <div>protected</div>
      </ApiKeyGate>,
    )

    expect(
      await screen.findByRole('button', { name: /Use local Ollama/i }),
    ).toBeInTheDocument()
  })

  it('should persist a valid Anthropic key and unmount the gate', async () => {
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
    expect(window.sessionStorage.getItem(SESSION_KEYS.provider)).toBe(
      'anthropic',
    )
  })
})
