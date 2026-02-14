import { href, redirect, type RouterContextProvider } from 'react-router'
import { eq, and } from 'drizzle-orm'

import { db } from '~/lib/db'
import { member, organization, userFractions } from '~/lib/db/schema'
import { sessionContext } from './context'

import type { Session } from './auth.server'

type OrgRole = 'org_admin'
type FractionRole = 'fraction_owner_admin' | 'fraction_member'
export type UserRole = OrgRole | FractionRole

type RbacContext = Pick<RouterContextProvider, 'get'>

type AuthResult = {
  session: Session
  user: Session['user']
}

type OrgResult = AuthResult & {
  org: typeof organization.$inferSelect
  orgRole: 'owner' | 'admin' | 'member'
  effectiveRole: UserRole
}

/**
 * Require authenticated user. Redirects to /login if not authenticated.
 */
export function requireAuth(context: RbacContext): AuthResult {
  const session = context.get(sessionContext)
  if (!session) throw redirect(href('/login'))
  return { session, user: session.user }
}

/**
 * Require authenticated user who belongs to an organization.
 * Redirects to /login if not authenticated, /onboarding if no active org.
 */
export async function requireOrgMember(context: RbacContext): Promise<OrgResult> {
  const { session, user } = requireAuth(context)

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

  // Resolve effective role: org owner/admin → org_admin
  let effectiveRole: UserRole = 'fraction_member'
  if (orgRole === 'owner' || orgRole === 'admin') {
    effectiveRole = 'org_admin'
  } else {
    // Check fraction roles for non-admin org members
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
      effectiveRole = fractionRole.role as FractionRole
    }
  }

  return { session, user, org, orgRole, effectiveRole }
}

/**
 * Require org_admin role. Throws 403 if user is not an org admin.
 */
export async function requireOrgAdmin(context: RbacContext): Promise<OrgResult> {
  const result = await requireOrgMember(context)
  if (result.effectiveRole !== 'org_admin') {
    throw new Response('Forbidden', { status: 403 })
  }
  return result
}

/**
 * Require one of the specified roles. Throws 403 if user doesn't have any.
 */
export async function requireRole(context: RbacContext, roles: UserRole[]): Promise<OrgResult> {
  const result = await requireOrgMember(context)
  if (!roles.includes(result.effectiveRole)) {
    throw new Response('Forbidden', { status: 403 })
  }
  return result
}

/**
 * Get user's role for a specific fraction.
 * Returns the fraction role or null if not associated.
 */
export async function getFractionRole(
  orgId: string,
  userId: string,
  fractionId: string,
): Promise<'fraction_owner_admin' | 'fraction_member' | null> {
  const [row] = await db
    .select({ role: userFractions.role })
    .from(userFractions)
    .where(
      and(
        eq(userFractions.orgId, orgId),
        eq(userFractions.userId, userId),
        eq(userFractions.fractionId, fractionId),
        eq(userFractions.status, 'approved'),
      ),
    )
    .limit(1)

  return (row?.role as 'fraction_owner_admin' | 'fraction_member') ?? null
}
