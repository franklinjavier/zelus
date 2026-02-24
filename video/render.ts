/**
 * Render the HeroVideo composition as MP4 (H.264) and WebM (VP9).
 * Output: ../public/hero.mp4 and ../public/hero.webm
 *
 * Usage: bun run render.ts  (from video/ directory)
 */
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { resolve } from 'path'

const COMPOSITION_ID = 'HeroVideo'
const OUTPUT_DIR = resolve(import.meta.dirname ?? __dirname, '..', 'public')
const ENTRY_POINT = resolve(import.meta.dirname ?? __dirname, 'src', 'index.ts')

async function main() {
  console.log('Bundling Remotion project...')
  const bundleLocation = await bundle({ entryPoint: ENTRY_POINT })

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: COMPOSITION_ID,
  })

  console.log(
    `Composition: ${composition.id} (${composition.durationInFrames} frames @ ${composition.fps}fps)`,
  )

  // Render MP4 (H.264) — CRF 28 for good quality at smaller size
  console.log('\nRendering MP4...')
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: resolve(OUTPUT_DIR, 'hero.mp4'),
    crf: 28,
  })
  console.log('✓ hero.mp4 saved')

  // Render WebM (VP8) — CRF 30 for web-optimized size
  console.log('\nRendering WebM...')
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'vp8',
    outputLocation: resolve(OUTPUT_DIR, 'hero.webm'),
    crf: 30,
  })
  console.log('✓ hero.webm saved')

  console.log('\nDone! Videos saved to public/')
}

main().catch((err) => {
  console.error('Render failed:', err)
  process.exit(1)
})
