import {
  AiChat02Icon,
  Building06Icon,
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

export const mainNav: NavItem[] = [
  { label: 'Assistente', to: href('/assistant'), icon: AiChat02Icon },
  { label: 'Ocorrências', to: href('/tickets'), icon: Ticket02Icon },
  { label: 'Frações', to: href('/fractions'), icon: Building06Icon },
  { label: 'Prestadores', to: href('/suppliers'), icon: TruckDeliveryIcon },
  { label: 'Intervenções', to: href('/maintenance'), icon: WrenchIcon },
]

export const adminNav: NavItem[] = [
  { label: 'Dashboard', to: href('/admin/dashboard'), icon: ShieldKeyIcon },
  { label: 'Categorias', to: href('/admin/categories'), icon: ShieldKeyIcon },
  { label: 'Condomínio', to: href('/admin/organization'), icon: ShieldKeyIcon },
  { label: 'Convites', to: href('/admin/invites'), icon: ShieldKeyIcon },
  { label: 'Documentos', to: href('/admin/documents'), icon: ShieldKeyIcon },
  { label: 'Membros', to: href('/admin/members'), icon: ShieldKeyIcon },
  { label: 'Pedidos de acesso', to: href('/admin/associations'), icon: ShieldKeyIcon },
]

export const extraNav: NavItem[] = [
  { label: 'Notificações', to: href('/notifications'), icon: Notification03Icon },
  { label: 'Perfil', to: href('/settings/profile'), icon: UserIcon },
  { label: 'Conta', to: href('/settings/account'), icon: UserIcon },
  { label: 'Meus Condomínios', to: href('/orgs'), icon: Building06Icon },
]
