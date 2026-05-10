#!/usr/bin/env bun
/**
 * Rasterize src/app/icon.svg to src/app/favicon.ico for legacy browsers
 * that ignore the SVG icon link. Run via `bun run favicon`.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ICON_SVG_PATH = resolve(SCRIPT_DIR, '..', 'src', 'app', 'icon.svg')
const FAVICON_ICO_PATH = resolve(SCRIPT_DIR, '..', 'src', 'app', 'favicon.ico')
const SIZE = 32

const svg = readFileSync(ICON_SVG_PATH, 'utf-8')
const html = `<!doctype html><html><head><style>html,body{margin:0;padding:0;background:transparent;}svg{width:${SIZE}px;height:${SIZE}px;display:block;}</style></head><body>${svg}</body></html>`

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: SIZE, height: SIZE },
  deviceScaleFactor: 1,
  colorScheme: 'light',
})
const page = await context.newPage()
await page.setContent(html, { waitUntil: 'load' })
const png = await page.screenshot({
  type: 'png',
  omitBackground: true,
  clip: { x: 0, y: 0, width: SIZE, height: SIZE },
})
await browser.close()

const pngBuffer = Buffer.from(png)
const ico = Buffer.alloc(6 + 16 + pngBuffer.length)
ico.writeUInt16LE(0, 0)
ico.writeUInt16LE(1, 2)
ico.writeUInt16LE(1, 4)
ico.writeUInt8(SIZE, 6)
ico.writeUInt8(SIZE, 7)
ico.writeUInt8(0, 8)
ico.writeUInt8(0, 9)
ico.writeUInt16LE(1, 10)
ico.writeUInt16LE(32, 12)
ico.writeUInt32LE(pngBuffer.length, 14)
ico.writeUInt32LE(22, 18)
pngBuffer.copy(ico, 22)

writeFileSync(FAVICON_ICO_PATH, ico)
console.log(`Wrote ${FAVICON_ICO_PATH} (${ico.length} bytes)`)
