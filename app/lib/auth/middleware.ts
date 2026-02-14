import { href, redirect } from 'react-router'
import { eq, and } from 'drizzle-orm'

import type { Route } from '../../+types/root'
import { auth } from './auth.server'
import { sessionContext, orgContext, userContext } from './context'
import { db } from '~/lib/db'
import { member, organization, userFractions } from '~/lib/db/schema'

import type { UserRole } from './rbac'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMiddlewareFunction = (...args: any[]) => any

/**
 * Root-level middleware that resolves the session for every request.
 * Stores session in context (null if not authenticated).
 * Applied in root.tsx so all routes can access session data.
 */
export const sessionMiddleware: Route.MiddlewareFunction = async ({ request, context }, next) => {
  const session = await auth.api.getSession({ headers: request.headers })
  context.set(sessionContext, session)
  return next()
}

/**
 * Requires authenticated user with active org membership.
 * Sets orgId, user, effectiveRole in context for child routes.
 */
export const orgMemberMiddleware: AnyMiddlewareFunction = async (
  { context }: { context: any },
  next: () => Promise<Response>,
) => {
  const session = context.get(sessionContext)
  if (!session) throw redirect(href('/login'))

  const user = session.user
  const activeOrgId = session.session.activeOrganizationId
  if (!activeOrgId) throw redirect(href('/onboarding'))

  const [memberRow] = await db
    .select()
    .from(member)
    .where(and(eq(member.organizationId, activeOrgId), eq(member.userId, user.id)))
    .limit(1)

  if (!memberRow) throw redirect(href('/onboarding'))

  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, activeOrgId))
    .limit(1)

  if (!org) throw redirect(href('/onboarding'))

  const orgRole = memberRow.role as 'owner' | 'admin' | 'member'

  let effectiveRole: UserRole = 'fraction_member'
  if (orgRole === 'owner' || orgRole === 'admin') {
    effectiveRole = 'org_admin'
  } else {
    const [fractionRole] = await db
      .select({ role: userFractions.role })
      .from(userFractions)
      .where(
        and(
          eq(userFractions.orgId, activeOrgId),
          eq(userFractions.userId, user.id),
          eq(userFractions.status, 'approved'),
        ),
      )
      .limit(1)

    if (fractionRole) {
      effectiveRole = fractionRole.role as UserRole
    }
  }

  context.set(orgContext, { orgId: activeOrgId, orgName: org.name, orgRole, effectiveRole })
  context.set(userContext, { id: user.id, name: user.name, email: user.email })

  return next()
}

/**
 * Requires org_admin role. Runs after orgMemberMiddleware.
 */
export const orgAdminMiddleware: AnyMiddlewareFunction = async (
  { context }: { context: any },
  next: () => Promise<Response>,
) => {
  const org = context.get(orgContext)
  if (org.effectiveRole !== 'org_admin') {
    throw new Response('Forbidden', { status: 403 })
  }
  return next()
}
