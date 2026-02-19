import { z } from 'zod'

import { auth } from '~/lib/auth/auth.server'

export const createOrgSchema = z.object({
  name: z.string().min(1, 'Nome do condomínio obrigatório'),
  city: z.string().min(1, 'Cidade obrigatória'),
  totalFractions: z.string().optional(),
  notes: z.string().optional(),
})

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const suffix = crypto.randomUUID().slice(0, 8)
  return `${base}-${suffix}`
}

export async function createOrganization(
  orgData: z.infer<typeof createOrgSchema>,
  requestHeaders: Headers,
) {
  return auth.api.createOrganization({
    body: {
      name: orgData.name,
      slug: generateSlug(orgData.name),
      city: orgData.city || undefined,
      totalFractions: orgData.totalFractions || undefined,
      notes: orgData.notes || undefined,
    },
    asResponse: true,
    headers: requestHeaders,
  })
}
