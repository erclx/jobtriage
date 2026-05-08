import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProfileDrawer } from './profile-drawer'
import { SESSION_KEYS } from './storage-keys'

describe('ProfileDrawer', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  afterEach(() => {
    window.sessionStorage.clear()
  })

  it('saves the draft to sessionStorage and notifies the parent', async () => {
    const user = userEvent.setup()
    const handleProfileChange = vi.fn()
    render(<ProfileDrawer onProfileChange={handleProfileChange} />)

    await user.click(screen.getByRole('button', { name: /^Profile/i }))
    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'Senior AI engineer based in Stockholm.')
    await user.click(screen.getByRole('button', { name: /^Save$/ }))

    expect(window.sessionStorage.getItem(SESSION_KEYS.profile)).toContain(
      'Senior AI engineer',
    )
    expect(handleProfileChange).toHaveBeenLastCalledWith(
      'Senior AI engineer based in Stockholm.',
    )
  })

  it('rehydrates the saved profile on mount', async () => {
    window.sessionStorage.setItem(SESSION_KEYS.profile, 'cached profile')
    render(<ProfileDrawer onProfileChange={() => undefined} />)

    expect(await screen.findByText(/14 chars saved/i)).toBeInTheDocument()
  })

  it('clears the profile and informs the parent', async () => {
    window.sessionStorage.setItem(SESSION_KEYS.profile, 'cached profile')
    const user = userEvent.setup()
    const handleProfileChange = vi.fn()
    render(<ProfileDrawer onProfileChange={handleProfileChange} />)

    await user.click(screen.getByRole('button', { name: /^Profile/i }))
    await user.click(screen.getByRole('button', { name: /^Clear$/ }))

    expect(window.sessionStorage.getItem(SESSION_KEYS.profile)).toBeNull()
    expect(handleProfileChange).toHaveBeenLastCalledWith('')
  })
})
