import { expect, test } from '@playwright/test'

test.describe('chat', () => {
  test('gates on a key, then forwards the BYOK header and profile to /api/chat', async ({
    page,
  }) => {
    let chatRequest:
      | { authorization: string; body: { profile: string | null } }
      | undefined
    await page.route('**/api/chat', async (route, request) => {
      const headers = request.headers()
      const body = JSON.parse(request.postData() ?? '{}') as {
        profile?: string | null
      }
      chatRequest = {
        authorization: headers.authorization ?? '',
        body: { profile: body.profile ?? null },
      }
      await route.fulfill({
        status: 200,
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          'x-vercel-ai-ui-message-stream': 'v1',
        },
        body: 'data: [DONE]\n\n',
      })
    })

    await page.goto('/')

    await page.getByLabel(/Anthropic API key/i).fill('sk-ant-playwright-test')
    await page.getByRole('button', { name: /start chat/i }).click()

    await expect(
      page.getByRole('heading', { name: /Ask jobtriage/i }),
    ).toBeVisible()

    const textarea = page.getByPlaceholder(/Ask about Swedish job ads/i)
    await textarea.fill('Show me Stockholm AI engineering roles')
    await textarea.press('Enter')

    await expect
      .poll(() => chatRequest, { timeout: 10_000 })
      .not.toBeUndefined()
    expect(chatRequest?.authorization).toBe('Bearer sk-ant-playwright-test')
    expect(chatRequest?.body).toEqual({ profile: null })
  })
})
