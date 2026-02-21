/**
 * Capture screenshots of the app for the Remotion hero video.
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
import { existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173'
const OUTPUT_DIR = resolve(import.meta.dirname ?? __dirname, '..', 'video', 'screenshots')

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
  await page.waitForURL('**/assistant**', { timeout: 15_000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  console.log('Login successful')

  // -------------------------------------------------------------------------
  // 1. Admin Dashboard
  // -------------------------------------------------------------------------
  console.log('  Capturing 01-dashboard...')
  // Open the Administração collapsible in sidebar
  await page
    .getByRole('button', { name: /Administração/i })
    .first()
    .click()
  await page.waitForTimeout(300)
  // Click Dashboard sub-link
  await page.getByRole('link', { name: 'Dashboard' }).first().click()
  await page.waitForURL('**/admin/dashboard**', { timeout: 10_000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800)
  await screenshot('01-dashboard')

  // -------------------------------------------------------------------------
  // 2. Tickets list
  // -------------------------------------------------------------------------
  console.log('  Capturing 02-tickets...')
  await clickSidebarLink('Ocorrências', '**/tickets**')
  await screenshot('02-tickets')

  // -------------------------------------------------------------------------
  // 3. Ticket detail — click on the "Elevador" ticket
  // -------------------------------------------------------------------------
  console.log('  Capturing 03-ticket-detail...')
  const elevatorTicket = page.getByRole('link', { name: /Elevador/i }).first()
  if (await elevatorTicket.isVisible({ timeout: 3000 }).catch(() => false)) {
    await elevatorTicket.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)
  } else {
    // Fallback: click any ticket link
    console.warn('  ⚠ Elevator ticket not found, clicking first ticket...')
    const anyTicket = page.locator('a[href*="/tickets/"]').first()
    if (await anyTicket.isVisible({ timeout: 3000 }).catch(() => false)) {
      await anyTicket.click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(800)
    }
  }
  await screenshot('03-ticket-detail')

  // -------------------------------------------------------------------------
  // 4. Fractions
  // -------------------------------------------------------------------------
  console.log('  Capturing 04-fractions...')
  await clickSidebarLink('Frações', '**/fractions**')
  await screenshot('04-fractions')

  // -------------------------------------------------------------------------
  // 5. Assistant — go to conversation with messages
  // -------------------------------------------------------------------------
  console.log('  Capturing 05-assistant...')
  await clickSidebarLink('Assistente', '**/assistant**')
  await page.waitForTimeout(500)

  // Click into the existing conversation
  const convLink = page.locator('a[href*="/assistant/"]').first()
  if (await convLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await convLink.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)
  }
  await screenshot('05-assistant')

  // -------------------------------------------------------------------------
  // 6. Suppliers
  // -------------------------------------------------------------------------
  console.log('  Capturing 06-suppliers...')
  await clickSidebarLink('Prestadores', '**/suppliers**')
  await screenshot('06-suppliers')

  // -------------------------------------------------------------------------
  // Done
  // -------------------------------------------------------------------------
  await browser.close()
  console.log(`\nDone! 6 screenshots saved to ${OUTPUT_DIR}`)
}

main().catch((err) => {
  console.error('Screenshot capture failed:', err)
  process.exit(1)
})
