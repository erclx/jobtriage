import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SESSION_KEYS } from '@/features/chat/storage-keys'

import { ProfileNode } from './profile-node'

vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}))

const LONG_PROFILE = [
  '- Senior AI engineer with extensive experience shipping production agents on Anthropic and OpenAI stacks at scale',
  '- Based in Stockholm, open to hybrid roles in the Nordics within a forty-minute commute from the city centre',
  '- Must-haves include meaningful equity, a senior IC track, and an engineering-led culture without product-design politics',
  '- Deal-breakers are pure research roles, on-call rotations above one in six, and any role that demands relocation outside Sweden',
  '- Strong preference for early-stage teams between fifteen and fifty engineers building developer-facing tools',
  '- Open to staff-level positions when the scope is genuinely cross-team rather than nominal',
].join('\n')

function renderProfileNode() {
  const onEdit = vi.fn()
  const result = render(
    <ProfileNode
      id="profile"
      data={{ onEdit } as unknown as Record<string, unknown>}
      type="profile"
      selected={false}
      zIndex={2}
      isConnectable={false}
      positionAbsoluteX={0}
      positionAbsoluteY={0}
      dragHandle=""
      dragging={false}
      deletable={false}
      selectable={false}
      draggable={false}
    />,
  )
  return { onEdit, ...result }
}

describe('ProfileNode', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  afterEach(() => {
    window.sessionStorage.clear()
  })

  it('should render a Read more toggle when the profile content overflows the clamp', () => {
    window.sessionStorage.setItem(SESSION_KEYS.profile, LONG_PROFILE)

    renderProfileNode()

    expect(screen.getByTestId('profile-node-toggle')).toHaveTextContent(
      /Read more/,
    )
  })

  it('should not render the toggle when the profile is empty', () => {
    renderProfileNode()

    expect(screen.queryByTestId('profile-node-toggle')).not.toBeInTheDocument()
  })

  it('should expand to Show less and not call onEdit when the toggle is clicked', async () => {
    window.sessionStorage.setItem(SESSION_KEYS.profile, LONG_PROFILE)
    const user = userEvent.setup()

    const { onEdit } = renderProfileNode()

    await user.click(screen.getByTestId('profile-node-toggle'))

    expect(screen.getByTestId('profile-node-toggle')).toHaveTextContent(
      /Show less/,
    )
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('should open the editor when the node body is clicked', async () => {
    window.sessionStorage.setItem(SESSION_KEYS.profile, LONG_PROFILE)
    const user = userEvent.setup()

    const { onEdit } = renderProfileNode()

    await user.click(screen.getByTestId('profile-node'))

    expect(onEdit).toHaveBeenCalledTimes(1)
  })
})
