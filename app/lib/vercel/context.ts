import { createContext } from 'react-router'

// Default: fire-and-forget with error logging (used in dev where Vercel waitUntil is unavailable)
const fallback = (promise: Promise<unknown>) => {
  promise.catch((err) => console.error('Background task failed:', err))
}

export const waitUntilContext = createContext<(promise: Promise<unknown>) => void>(fallback)
