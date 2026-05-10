import { expect, test } from '@playwright/test'

test.describe('theme-toggle', () => {
  test('should cycle system, light, dark, system on click', async ({
    page,
    context,
  }) => {
    await context.addInitScript(() => {
      window.localStorage.removeItem('theme')
      window.sessionStorage.setItem('jobtriage:provider', 'ollama')
      window.sessionStorage.setItem('jobtriage:anthropic-api-key', 'ollama')
    })
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')

    const toggle = page.getByRole('button', { name: /^Theme:/ })
    await expect(toggle).toHaveAttribute(
      'aria-label',
      'Theme: system. Switch to light.',
    )

    await toggle.click()
    await expect(toggle).toHaveAttribute(
      'aria-label',
      'Theme: light. Switch to dark.',
    )

    await toggle.click()
    await expect(toggle).toHaveAttribute(
      'aria-label',
      'Theme: dark. Switch to system.',
    )

    await toggle.click()
    await expect(toggle).toHaveAttribute(
      'aria-label',
      'Theme: system. Switch to light.',
    )
  })

  test('should follow prefers-color-scheme changes when in system mode', async ({
    page,
    context,
  }) => {
    await context.addInitScript(() => {
      window.localStorage.removeItem('theme')
      window.sessionStorage.setItem('jobtriage:provider', 'ollama')
      window.sessionStorage.setItem('jobtriage:anthropic-api-key', 'ollama')
    })
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')

    await expect(page.locator('html')).not.toHaveClass(/dark/)

    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page.locator('html')).toHaveClass(/dark/)
  })
})
