import {
  AiChat02Icon,
  BookOpen01Icon,
  Building06Icon,
  Calendar03Icon,
  Home09Icon,
  Notification03Icon,
  ShieldKeyIcon,
  Ticket02Icon,
  TruckDeliveryIcon,
  UserIcon,
  WrenchIcon,
} from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react'
import { href } from 'react-router'

export type NavItem = { label: string; to: string; icon: IconSvgElement }

export type NavGroup = {
  label: string
  icon: IconSvgElement
  adminOnly?: boolean
  items: NavItem[]
}

export const mainNav: NavItem[] = [
  { label: 'Home', to: href('/home'), icon: Home09Icon },
  { label: 'Assistente', to: href('/assistant'), icon: AiChat02Icon },
  { label: 'Ocorrências', to: href('/tickets'), icon: Ticket02Icon },
  { label: 'Frações', to: href('/fractions'), icon: Building06Icon },
  { label: 'Prestadores', to: href('/suppliers'), icon: TruckDeliveryIcon },
  { label: 'Intervenções', to: href('/maintenance'), icon: WrenchIcon },
  { label: 'Documentos', to: href('/documents'), icon: BookOpen01Icon },
]

export const navGroups: NavGroup[] = [
  {
    label: 'Administração',
    icon: ShieldKeyIcon,
    adminOnly: true,
    items: [
      { label: 'Dashboard', to: href('/admin/dashboard'), icon: ShieldKeyIcon },
      { label: 'Avisos', to: href('/admin/announcements'), icon: Calendar03Icon },
      { label: 'Categorias', to: href('/admin/categories'), icon: ShieldKeyIcon },
      { label: 'Condomínio', to: href('/admin/organization'), icon: ShieldKeyIcon },
      { label: 'Convites', to: href('/admin/invites'), icon: ShieldKeyIcon },
      { label: 'Membros', to: href('/admin/members'), icon: ShieldKeyIcon },
      { label: 'Pedidos de acesso', to: href('/admin/associations'), icon: ShieldKeyIcon },
      { label: 'Logs', to: href('/admin/audit-logs'), icon: ShieldKeyIcon },
    ],
  },
]

export const extraNav: NavItem[] = [
  { label: 'Notificações', to: href('/notifications'), icon: Notification03Icon },
  { label: 'Perfil', to: href('/settings/profile'), icon: UserIcon },
  { label: 'Conta', to: href('/settings/account'), icon: UserIcon },
  { label: 'Meus Condomínios', to: href('/orgs'), icon: Building06Icon },
]
