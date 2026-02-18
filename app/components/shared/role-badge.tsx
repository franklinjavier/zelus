import { Badge } from '~/components/ui/badge'

const roleLabels: Record<string, string> = {
  org_admin: 'Admin',
  fraction_owner_admin: 'Admin Fração',
  fraction_member: 'Membro',
}

export function roleLabel(role: string): string {
  return roleLabels[role] ?? role
}

export function RoleBadge({ role }: { role: string }) {
  if (role === 'fraction_member') return null
  return <Badge variant="secondary">{roleLabel(role)}</Badge>
}
