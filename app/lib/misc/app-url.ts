/**
 * Get the application URL based on environment
 * Priority:
 * - Vercel Preview: VERCEL_URL
 * - Otherwise: BETTER_AUTH_URL > VERCEL_PROJECT_PRODUCTION_URL > VERCEL_URL > localhost
 */
export function getAppUrl() {
  // In Vercel previews, prefer the preview URL even if BETTER_AUTH_URL is set globally.
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  if (process.env.BETTER_AUTH_URL) {
    return process.env.BETTER_AUTH_URL
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:5173'
}

export function getTrustedOrigins() {
  const origins = new Set<string>()

  // Allow localhost for dev environments (SSR/API calls).
  if (process.env.NODE_ENV === 'development') {
    origins.add('http://localhost:5173')
    origins.add('http://localhost:5174')
  }

  // Base URL (handles Vercel preview + BETTER_AUTH_URL priority)
  origins.add(getAppUrl())

  // Also trust these if present, since BETTER_AUTH_URL may be set globally
  // while Vercel preview uses a different origin.
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    origins.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  }
  if (process.env.VERCEL_URL) {
    origins.add(`https://${process.env.VERCEL_URL}`)
  }
  if (process.env.BETTER_AUTH_URL) {
    origins.add(process.env.BETTER_AUTH_URL)
  }
  if (process.env.APP_URL) {
    origins.add(process.env.APP_URL)
  }

  return Array.from(origins)
}
