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
import { spawn, type Subprocess } from 'bun'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dirname ?? __dirname, '..')

function run(cmd: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, {
      cwd: ROOT,
      stdout: 'inherit',
      stderr: 'inherit',
      env: process.env,
    })
    proc.exited.then((code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd.join(' ')} exited with code ${code}`))
    })
  })
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
  const baseUrl = process.env.BASE_URL ?? 'http://localhost:5173'

  // 1. Seed demo data
  console.log('\n--- Step 1/3: Seeding demo data ---\n')
  await run(['bun', 'run', 'db:seed-demo'])

  // 2. Start dev server
  console.log('\n--- Step 2/3: Starting dev server ---\n')
  const devServer: Subprocess = spawn(['bun', 'run', 'dev'], {
    cwd: ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
    env: process.env,
  })

  try {
    console.log(`Waiting for server at ${baseUrl}...`)
    await waitForServer(`${baseUrl}/login`)
    console.log('Server is ready!\n')

    // 3. Capture screenshots
    console.log('--- Step 3/3: Capturing screenshots ---\n')
    await run(['bun', 'run', 'video:capture'])
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
