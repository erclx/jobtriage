import { expect, type Route, test } from '@playwright/test'

interface UIMessageChunk {
  type: string
  [key: string]: unknown
}

function uiMessageStream(chunks: readonly UIMessageChunk[]): string {
  const lines = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
  lines.push('data: [DONE]\n\n')
  return lines.join('')
}

async function fulfillStream(
  route: Route,
  chunks: readonly UIMessageChunk[],
): Promise<void> {
  await route.fulfill({
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'x-vercel-ai-ui-message-stream': 'v1',
    },
    body: uiMessageStream(chunks),
  })
}

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

  test('renders ad cards for a multi-tool searchJobs + matchProfile turn', async ({
    page,
  }) => {
    await page.route('**/api/chat', async (route) => {
      await fulfillStream(route, [
        { type: 'start' },
        { type: 'start-step' },
        {
          type: 'tool-input-available',
          toolCallId: 'call-1',
          toolName: 'searchJobs',
          input: { region: 'reg-stockholm', top_k: 1 },
        },
        {
          type: 'tool-output-available',
          toolCallId: 'call-1',
          output: {
            results: [
              {
                ad_id: 'ad-1',
                headline: 'Senior AI engineer',
                employer_name: 'Acme AB',
                municipality: 'Stockholm',
                application_deadline: '2026-06-01',
                webpage_url: 'https://example.com/ad-1',
              },
            ],
          },
        },
        {
          type: 'tool-input-available',
          toolCallId: 'call-2',
          toolName: 'matchProfile',
          input: { ad_ids: ['ad-1'] },
        },
        {
          type: 'tool-output-available',
          toolCallId: 'call-2',
          output: {
            results: [
              {
                ad_id: 'ad-1',
                headline: 'Senior AI engineer',
                employer_name: 'Acme AB',
                municipality: 'Stockholm',
                application_deadline: '2026-06-01',
                webpage_url: 'https://example.com/ad-1',
                description_excerpt: 'Build agents in Stockholm with Azure ML.',
                occupation_label: 'Software developer',
              },
            ],
          },
        },
        { type: 'text-start', id: 'text-1' },
        {
          type: 'text-delta',
          id: 'text-1',
          delta: 'Strong fit on the Azure ML signals.',
        },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish-step' },
        { type: 'finish' },
      ])
    })

    await page.goto('/')
    await page.getByLabel(/Anthropic API key/i).fill('sk-ant-playwright-test')
    await page.getByRole('button', { name: /start chat/i }).click()

    const textarea = page.getByPlaceholder(/Ask about Swedish job ads/i)
    await textarea.fill('How does ad-1 match my profile?')
    await textarea.press('Enter')

    const cards = page.getByTestId('ad-card')
    await expect(cards).toHaveCount(2)
    await expect(
      page.getByText(/Build agents in Stockholm with Azure ML/),
    ).toBeVisible()
    await expect(
      page.getByText(/Strong fit on the Azure ML signals/),
    ).toBeVisible()

    const tracePanel = page.getByText(/Searched JobTech filter/i)
    await expect(tracePanel).toBeVisible()
    await expect(page.getByText(/parameters/i)).toHaveCount(0)
  })
})
