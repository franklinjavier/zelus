/**
 * Record a real walkthrough video of the app for the landing page hero.
 *
 * Uses Playwright's native video recording to capture real interactions:
 * clicks, scrolling, page transitions, and UI animations — as if a real
 * user were navigating the system.
 *
 * Prerequisites:
 *   1. Dev server running: bun run dev
 *   2. Demo seed applied: bun run db:seed-demo
 *
 * Output: public/hero.webm (converted to mp4 via ffmpeg if available)
 *
 * Usage: bun run video:record
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync, copyFileSync } from 'fs'
import { resolve } from 'path'
import { execFileSync } from 'child_process'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173'
const OUTPUT_DIR = resolve(import.meta.dirname ?? __dirname, '..', 'public')
const VIDEO_DIR = resolve(import.meta.dirname ?? __dirname, '..', 'video', 'recordings')

if (!existsSync(VIDEO_DIR)) {
  mkdirSync(VIDEO_DIR, { recursive: true })
}

// ---------------------------------------------------------------------------
// Timing helpers — create a cinematic feel with natural pauses
// ---------------------------------------------------------------------------
const PAUSE_SHORT = 800 // quick glance
const PAUSE_READ = 2200 // time to read content
const PAUSE_LOOK = 3500 // lingering on important screens
const PAUSE_SCENE = 1200 // between major scene transitions

async function main() {
  console.log('Launching browser with video recording...')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    recordVideo: {
      dir: VIDEO_DIR,
      size: { width: 1280, height: 720 },
    },
  })

  const page = await context.newPage()

  // -------------------------------------------------------------------------
  // Inject animated cursor overlay (visible in recording)
  // -------------------------------------------------------------------------
  async function injectCursor() {
    await page.evaluate(() => {
      // Remove existing cursor if page navigated
      const existing = document.getElementById('__pw-cursor')
      if (existing) existing.remove()

      const cursor = document.createElement('div')
      cursor.id = '__pw-cursor'
      Object.assign(cursor.style, {
        position: 'fixed',
        zIndex: '999999',
        pointerEvents: 'none',
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        background: 'rgba(59, 130, 246, 0.35)',
        border: '2px solid rgba(59, 130, 246, 0.7)',
        transform: 'translate(-50%, -50%)',
        transition: 'left 0.08s ease-out, top 0.08s ease-out, transform 0.15s ease',
        left: '-100px',
        top: '-100px',
      })
      document.body.appendChild(cursor)

      document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px'
        cursor.style.top = e.clientY + 'px'
      })

      // Pulse effect on click
      document.addEventListener('mousedown', () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(0.7)'
        cursor.style.background = 'rgba(59, 130, 246, 0.6)'
      })
      document.addEventListener('mouseup', () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(1)'
        cursor.style.background = 'rgba(59, 130, 246, 0.35)'
      })
    })
  }

  // Re-inject cursor after each full page load
  page.on('load', () => {
    injectCursor().catch(() => {})
  })

  // Helper: move cursor to an element's center with smooth motion
  async function moveTo(selector: string) {
    const el = page.locator(selector).first()
    const box = await el.boundingBox()
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 })
    }
  }

  // Helper: move cursor to a role-based element
  async function moveToRole(role: 'link' | 'button', name: string | RegExp) {
    const el = page.getByRole(role, { name }).first()
    const box = await el.boundingBox()
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 })
    }
  }

  // Helper: click sidebar link with natural timing + cursor movement
  async function clickSidebar(text: string, urlPattern?: string) {
    await page.waitForTimeout(PAUSE_SHORT)
    await moveToRole('link', text)
    await page.waitForTimeout(200)
    await page.getByRole('link', { name: text, exact: true }).first().click()
    if (urlPattern) {
      await page.waitForURL(urlPattern, { timeout: 10_000 })
    }
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(PAUSE_SHORT)
  }

  // Helper: smooth scroll down the page
  async function scrollDown(pixels: number, steps = 4) {
    const perStep = Math.round(pixels / steps)
    for (let i = 0; i < steps; i++) {
      await page.mouse.wheel(0, perStep)
      await page.waitForTimeout(150)
    }
  }

  // =========================================================================
  // SCENE 1: Login (brief — 3s)
  // =========================================================================
  console.log('Scene 1: Login...')
  await page.goto(`${BASE_URL}/login`)
  await page.waitForLoadState('networkidle')
  await injectCursor() // explicit injection after goto
  await page.waitForTimeout(PAUSE_SHORT)

  // Move to email field and type naturally
  await moveTo('#email')
  await page.waitForTimeout(200)
  await page.click('#email')
  await page.waitForTimeout(300)
  await page.type('#email', 'admin@zelus.sh', { delay: 50 })
  await page.waitForTimeout(400)

  // Move to password field and type
  await moveTo('#password')
  await page.waitForTimeout(200)
  await page.click('#password')
  await page.type('#password', 'password123', { delay: 40 })
  await page.waitForTimeout(500)

  // Move to login button and click
  await moveTo('button[type="submit"]')
  await page.waitForTimeout(200)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/assistant**', { timeout: 15_000 })
  await page.waitForLoadState('networkidle')
  await injectCursor() // re-inject after login redirect
  await page.waitForTimeout(PAUSE_SCENE)
  console.log('  ✓ Logged in')

  // =========================================================================
  // SCENE 2: Dashboard (5s)
  // =========================================================================
  console.log('Scene 2: Dashboard...')
  // Move to and open admin menu
  await moveToRole('button', /Administração/i)
  await page.waitForTimeout(200)
  await page
    .getByRole('button', { name: /Administração/i })
    .first()
    .click()
  await page.waitForTimeout(400)

  await moveToRole('link', 'Dashboard')
  await page.waitForTimeout(200)
  await page.getByRole('link', { name: 'Dashboard' }).first().click()
  await page.waitForURL('**/admin/dashboard**', { timeout: 10_000 })
  await page.waitForLoadState('networkidle')

  // Move cursor around dashboard to show interaction
  await page.waitForTimeout(PAUSE_SHORT)
  await page.mouse.move(640, 350, { steps: 15 }) // center of page
  await page.waitForTimeout(PAUSE_LOOK) // linger on dashboard stats
  console.log('  ✓ Dashboard viewed')

  // =========================================================================
  // SCENE 3: Tickets list (5s)
  // =========================================================================
  console.log('Scene 3: Tickets...')
  await clickSidebar('Ocorrências', '**/tickets**')
  await page.waitForTimeout(PAUSE_READ) // see the kanban board

  // Hover over a ticket card for visual interaction
  const ticketCard = page.locator('a', { hasText: /Elevador/i }).first()
  if (await ticketCard.isVisible({ timeout: 2000 }).catch(() => false)) {
    const box = await ticketCard.boundingBox()
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 })
      await page.waitForTimeout(PAUSE_SHORT)
    }
  }
  console.log('  ✓ Tickets viewed')

  // =========================================================================
  // SCENE 4: Ticket detail (6s)
  // =========================================================================
  console.log('Scene 4: Ticket detail...')
  if (await ticketCard.isVisible({ timeout: 1000 }).catch(() => false)) {
    await ticketCard.click()
  } else {
    const anyTicket = page.locator('a[href*="/tickets/"]').first()
    await anyTicket.click()
  }
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(PAUSE_READ)

  // Scroll down to see comments
  await scrollDown(300)
  await page.waitForTimeout(PAUSE_READ)
  console.log('  ✓ Ticket detail viewed')

  // =========================================================================
  // SCENE 5: Fractions (4s)
  // =========================================================================
  console.log('Scene 5: Fractions...')
  await clickSidebar('Frações', '**/fractions**')
  await page.waitForTimeout(PAUSE_READ)

  // Hover over a fraction card
  const fractionCard = page.locator('a[href*="/fractions/"]').first()
  if (await fractionCard.isVisible({ timeout: 2000 }).catch(() => false)) {
    const box = await fractionCard.boundingBox()
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 })
      await page.waitForTimeout(PAUSE_SHORT)
    }
  }
  console.log('  ✓ Fractions viewed')

  // =========================================================================
  // SCENE 6: Assistant conversation (6s)
  // =========================================================================
  console.log('Scene 6: Assistant...')
  await clickSidebar('Assistente', '**/assistant**')
  await page.waitForTimeout(PAUSE_SHORT)

  // Click into the existing conversation (if any)
  const convLink = page.locator('a[href*="/assistant/"]').first()
  if (await convLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    const box = await convLink.boundingBox()
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 })
      await page.waitForTimeout(200)
    }
    await convLink.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(PAUSE_SHORT)
    console.log('  ✓ Opened existing conversation')
  } else {
    console.log('  ⚠ No existing conversation found, staying on assistant list')
  }

  // Scroll through conversation to show messages
  await scrollDown(200)
  await page.waitForTimeout(PAUSE_LOOK)
  console.log('  ✓ Assistant conversation viewed')

  // =========================================================================
  // SCENE 7: Suppliers (4s)
  // =========================================================================
  console.log('Scene 7: Suppliers...')
  await clickSidebar('Prestadores', '**/suppliers**')
  await page.waitForTimeout(PAUSE_LOOK)
  console.log('  ✓ Suppliers viewed')

  // =========================================================================
  // Final pause to close gracefully
  // =========================================================================
  await page.waitForTimeout(PAUSE_SCENE)

  // =========================================================================
  // Save video
  // =========================================================================
  console.log('\nSaving video...')
  await page.close() // triggers video save
  const video = page.video()
  if (!video) {
    throw new Error('No video recorded')
  }

  const videoPath = await video.path()
  console.log(`  Raw video: ${videoPath}`)

  // Copy WebM to public/
  const webmOut = resolve(OUTPUT_DIR, 'hero.webm')
  copyFileSync(videoPath, webmOut)
  console.log(`  ✓ ${webmOut}`)

  // Try to convert to MP4 via ffmpeg (if available)
  const mp4Out = resolve(OUTPUT_DIR, 'hero.mp4')
  try {
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-i',
        webmOut,
        '-c:v',
        'libx264',
        '-crf',
        '23',
        '-preset',
        'medium',
        '-an',
        '-movflags',
        '+faststart',
        mp4Out,
      ],
      { stdio: 'pipe' },
    )
    console.log(`  ✓ ${mp4Out}`)
  } catch {
    console.warn('  ⚠ ffmpeg not found — skipping MP4 conversion')
    console.warn('    Install ffmpeg to get MP4 output: brew install ffmpeg')
  }

  await context.close()
  await browser.close()

  console.log('\nDone! Hero video saved to public/')
}

main().catch((err) => {
  console.error('Recording failed:', err)
  process.exit(1)
})
