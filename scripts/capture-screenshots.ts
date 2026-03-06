/**
 * Capture screenshots of the app for the landing page feature showcase.
 *
 * Uses client-side navigation (sidebar clicks) instead of full page.goto()
 * to avoid SSR hydration issues in headless Chromium.
 *
 * Prerequisites:
 *   1. Dev server running: bun run dev
 *   2. Demo seed applied: bun run db:seed-demo
 *
 * Usage: bun run video:capture
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync, readdirSync } from 'fs'
import { resolve } from 'path'
import sharp from 'sharp'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173'
const OUTPUT_DIR = resolve(import.meta.dirname ?? __dirname, '..', 'public', 'screenshots')

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true })
}

async function main() {
  console.log('Launching browser...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
  })
  const page = await context.newPage()

  // Helper: screenshot with path
  async function screenshot(name: string) {
    const path = resolve(OUTPUT_DIR, `${name}.png`)
    await page.screenshot({ path, type: 'png' })
    console.log(`  ✓ ${name}.png saved`)
  }

  // Helper: click sidebar link using getByRole for accessible link matching
  async function clickSidebarLink(text: string, urlPattern?: string) {
    await page.getByRole('link', { name: text, exact: true }).first().click()
    if (urlPattern) {
      await page.waitForURL(urlPattern, { timeout: 10_000 })
    }
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)
  }

  // -------------------------------------------------------------------------
  // Login
  // -------------------------------------------------------------------------
  console.log('Logging in as admin@zelus.sh...')
  await page.goto(`${BASE_URL}/login`)
  await page.waitForLoadState('networkidle')
  await page.fill('#email', 'admin@zelus.sh')
  await page.fill('#password', 'password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/home**', { timeout: 15_000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  console.log('Login successful')

  // -------------------------------------------------------------------------
  // 1. Home page (already on /home after login)
  // -------------------------------------------------------------------------
  console.log('  Capturing 01-home...')
  await screenshot('01-home')

  // -------------------------------------------------------------------------
  // 2. Tickets list
  // -------------------------------------------------------------------------
  console.log('  Capturing 02-tickets...')
  await clickSidebarLink('Ocorrências', '**/tickets**')
  await screenshot('02-tickets')

  // -------------------------------------------------------------------------
  // 3. Assistant — go to conversation with messages
  // -------------------------------------------------------------------------
  console.log('  Capturing 03-assistant...')
  await clickSidebarLink('Assistente', '**/assistant**')
  await page.waitForTimeout(500)

  // Click into the existing conversation
  const convLink = page.locator('a[href*="/assistant/"]').first()
  if (await convLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await convLink.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)
  }
  await screenshot('03-assistant')

  // -------------------------------------------------------------------------
  // 4. Suppliers
  // -------------------------------------------------------------------------
  console.log('  Capturing 04-suppliers...')
  await clickSidebarLink('Prestadores', '**/suppliers**')
  await screenshot('04-suppliers')

  // -------------------------------------------------------------------------
  // Done — close browser, then generate thumbnails
  // -------------------------------------------------------------------------
  await browser.close()

  // Generate optimized thumbnails (webp, 50% width)
  console.log('\nGenerating thumbnails...')
  const pngFiles = readdirSync(OUTPUT_DIR).filter((f) => f.endsWith('.png'))
  for (const file of pngFiles) {
    const input = resolve(OUTPUT_DIR, file)
    const output = resolve(OUTPUT_DIR, file.replace('.png', '-thumb.webp'))
    const metadata = await sharp(input).metadata()
    await sharp(input)
      .resize({ width: Math.round((metadata.width ?? 1280) / 2) })
      .webp({ quality: 80 })
      .toFile(output)
    console.log(`  ✓ ${file.replace('.png', '-thumb.webp')} saved`)
  }

  console.log(`\nDone! 4 screenshots + 4 thumbnails saved to ${OUTPUT_DIR}`)
}

main().catch((err) => {
  console.error('Screenshot capture failed:', err)
  process.exit(1)
})
