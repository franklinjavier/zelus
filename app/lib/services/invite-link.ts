import { eq } from 'drizzle-orm'

import { db } from '~/lib/db'
import { organization } from '~/lib/db/schema'

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let code = ''
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  for (const byte of bytes) {
    code += chars[byte % chars.length]
  }
  return code
}

export async function getInviteLink(orgId: string) {
  const [org] = await db
    .select({ inviteCode: organization.inviteCode, inviteEnabled: organization.inviteEnabled })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1)
  return org ?? null
}

export async function enableInviteLink(orgId: string) {
  const [org] = await db
    .select({ inviteCode: organization.inviteCode })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1)

  const code = org?.inviteCode || generateCode()

  await db
    .update(organization)
    .set({ inviteCode: code, inviteEnabled: true })
    .where(eq(organization.id, orgId))

  return code
}

export async function disableInviteLink(orgId: string) {
  await db.update(organization).set({ inviteEnabled: false }).where(eq(organization.id, orgId))
}

export async function regenerateInviteCode(orgId: string) {
  const code = generateCode()
  await db
    .update(organization)
    .set({ inviteCode: code, inviteEnabled: true })
    .where(eq(organization.id, orgId))
  return code
}

export async function getOrgByInviteCode(code: string) {
  const [org] = await db
    .select({
      id: organization.id,
      name: organization.name,
      inviteEnabled: organization.inviteEnabled,
    })
    .from(organization)
    .where(eq(organization.inviteCode, code))
    .limit(1)
  return org ?? null
}
