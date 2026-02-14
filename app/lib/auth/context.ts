import { createContext } from 'react-router'

import type { Session } from './auth.server'

export const sessionContext = createContext<Session | null>(null)

export const orgContext = createContext<{
  orgId: string
  orgName: string
  orgRole: string
  effectiveRole: string
}>()

export const userContext = createContext<{ id: string; name: string; email: string }>()
