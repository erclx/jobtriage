import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProfileDialog } from './profile-dialog'
import { SESSION_KEYS } from './storage-keys'

describe('ProfileDialog', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  afterEach(() => {
    window.sessionStorage.clear()
  })

  it('should persist the draft to sessionStorage on save', async () => {
    const onProfileChange = vi.fn()
    const user = userEvent.setup()

    render(
      <ProfileDialog
        open
        onOpenChange={() => undefined}
        onProfileChange={onProfileChange}
      />,
    )

    const dialog = screen.getByRole('dialog')
    const textarea = within(dialog).getByRole('textbox')
    await user.type(textarea, '## Role\nSenior')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(window.sessionStorage.getItem(SESSION_KEYS.profile)).toBe(
      '## Role\nSenior',
    )
    expect(onProfileChange).toHaveBeenCalledWith('## Role\nSenior')
  })

  it('should fill the textarea with the example profile when load example is clicked', async () => {
    const user = userEvent.setup()

    render(
      <ProfileDialog
        open
        onOpenChange={() => undefined}
        onProfileChange={() => undefined}
      />,
    )

    const dialog = screen.getByRole('dialog')
    await user.click(
      within(dialog).getByRole('button', { name: /Load example/i }),
    )

    const textarea = within(dialog).getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value.length).toBeGreaterThan(0)
  })

  it('should disable save when the draft equals the saved value', () => {
    window.sessionStorage.setItem(SESSION_KEYS.profile, 'existing')

    render(
      <ProfileDialog
        open
        onOpenChange={() => undefined}
        onProfileChange={() => undefined}
      />,
    )

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('should persist an over-soft-cap draft when the dialog is closed via escape', async () => {
    const longDraft = 'x'.repeat(20_001)
    const onProfileChange = vi.fn()
    const onOpenChange = vi.fn()
    const user = userEvent.setup()

    render(
      <ProfileDialog
        open
        onOpenChange={onOpenChange}
        onProfileChange={onProfileChange}
      />,
    )

    const dialog = screen.getByRole('dialog')
    const textarea = within(dialog).getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: longDraft } })

    await user.keyboard('{Escape}')

    expect(window.sessionStorage.getItem(SESSION_KEYS.profile)).toBe(longDraft)
    expect(onProfileChange).toHaveBeenCalledWith(longDraft)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('should keep save enabled when the draft exceeds the soft cap', async () => {
    const longDraft = 'x'.repeat(20_001)
    const user = userEvent.setup()

    render(
      <ProfileDialog
        open
        onOpenChange={() => undefined}
        onProfileChange={() => undefined}
      />,
    )

    const dialog = screen.getByRole('dialog')
    const textarea = within(dialog).getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: longDraft } })

    const save = within(dialog).getByRole('button', { name: 'Save' })
    expect(save).toBeEnabled()
    await user.click(save)

    expect(window.sessionStorage.getItem(SESSION_KEYS.profile)).toBe(longDraft)
  })
})
