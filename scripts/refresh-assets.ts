/**
 * Refresh all landing page assets (screenshots + video).
 *
 * This script:
 *   1. Applies demo seed data
 *   2. Starts the dev server
 *   3. Captures screenshots via Playwright
 *   4. Stops the dev server
 *
 * Usage: bun run assets:refresh
 *
 * For video rendering, run `bun run video:render` separately after this.
 */
import { spawn, spawnSync } from 'child_process'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dirname ?? __dirname, '..')

function run(cmd: string, args: string[], envOverrides?: Record<string, string>): void {
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...envOverrides },
  })
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited with code ${result.status}`)
  }
}

async function waitForServer(url: string, timeoutMs = 60_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`)
}

async function main() {
  const port = process.env.PORT ?? '5199'
  const baseUrl = `http://localhost:${port}`

  // 1. Seed demo data
  console.log('\n--- Step 1/3: Seeding demo data ---\n')
  run('bun', ['run', 'db:seed-demo'])

  // 2. Start dev server on a dedicated port
  console.log('\n--- Step 2/3: Starting dev server ---\n')
  const devServer = spawn('bun', ['run', 'dev', '--', '--port', port], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  })

  try {
    console.log(`Waiting for server at ${baseUrl}...`)
    await waitForServer(`${baseUrl}/login`)
    console.log('Server is ready!\n')

    // 3. Capture screenshots
    console.log('--- Step 3/3: Capturing screenshots ---\n')
    run('bun', ['run', 'video:capture'], { BASE_URL: baseUrl })
  } finally {
    // 4. Stop dev server
    console.log('\nStopping dev server...')
    devServer.kill()
  }

  console.log('\nDone! Screenshots updated in public/screenshots/')
  console.log('To also update the hero video, run: bun run video:render')
}

main().catch((err) => {
  console.error('Asset refresh failed:', err)
  process.exit(1)
})
