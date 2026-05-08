import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(SCRIPT_DIR, '..', '..')
const OUT_DIR =
  process.env.AUDIT_OUT_DIR ?? join(REPO_ROOT, '.claude', 'review', 'audit')
const BASE_URL = process.env.AUDIT_BASE_URL ?? 'http://localhost:3000'

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true })
  const browser = await chromium.launch()
  try {
    const lightContext = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
      colorScheme: 'light',
    })
    const lightPage = await lightContext.newPage()
    await lightPage.goto(BASE_URL, { waitUntil: 'load' })
    await lightPage.waitForTimeout(800)
    await lightPage.screenshot({
      path: join(OUT_DIR, 'byok-gate-light.png'),
      fullPage: true,
    })
    await lightContext.close()

    const darkContext = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
      colorScheme: 'dark',
    })
    const darkPage = await darkContext.newPage()
    await darkPage.goto(BASE_URL, { waitUntil: 'load' })
    await darkPage.waitForTimeout(800)
    await darkPage.screenshot({
      path: join(OUT_DIR, 'byok-gate-dark.png'),
      fullPage: true,
    })
    await darkContext.close()

    const ollamaContext = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
    })
    await ollamaContext.addInitScript(() => {
      window.sessionStorage.setItem('jobtriage:provider', 'ollama')
    })
    const ollamaPage = await ollamaContext.newPage()
    await ollamaPage.goto(BASE_URL, { waitUntil: 'load' })
    await ollamaPage.waitForTimeout(800)
    await ollamaPage.screenshot({
      path: join(OUT_DIR, 'empty-state.png'),
      fullPage: true,
    })
    await ollamaContext.close()

    const drawerContext = await browser.newContext({
      viewport: { width: 1280, height: 1200 },
    })
    await drawerContext.addInitScript(() => {
      window.sessionStorage.setItem('jobtriage:provider', 'ollama')
    })
    const drawerPage = await drawerContext.newPage()
    await drawerPage.goto(BASE_URL, { waitUntil: 'load' })
    await drawerPage.waitForTimeout(400)
    await drawerPage
      .getByRole('button', { name: /Profile/i })
      .first()
      .click()
    await drawerPage.waitForTimeout(300)
    await drawerPage.screenshot({
      path: join(OUT_DIR, 'profile-drawer-empty.png'),
      fullPage: true,
    })
    const textarea = drawerPage.locator('textarea.font-mono').first()
    await textarea.fill(
      '# Profile\n\nSenior AI engineer based in Stockholm. 8 years TypeScript, 4 years Python. Focus: agentic systems, RAG, hybrid retrieval.',
    )
    await drawerPage.waitForTimeout(300)
    await drawerPage.screenshot({
      path: join(OUT_DIR, 'profile-drawer-typing.png'),
      fullPage: true,
    })
    await drawerContext.close()
  } finally {
    await browser.close()
  }
}

void main()
