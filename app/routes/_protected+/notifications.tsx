import {
  CheckmarkCircle01Icon,
  Comment01Icon,
  MailSend02Icon,
  Notification03Icon,
  TickDouble02Icon,
  Ticket02Icon,
  UserAdd01Icon,
  XingIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Form, href, Link, useNavigation } from 'react-router'
import { redirect } from 'react-router'

import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { orgContext, userContext } from '~/lib/auth/context'
import { formatRelativeTime } from '~/lib/format'
import { listNotifications, markAllAsRead, markAsRead } from '~/lib/services/notifications'
import { EmptyState } from '~/components/layout/empty-state'
import type { Route } from './+types/notifications'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Notificações — Zelus' }]
}

export async function loader({ context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const { id: userId } = context.get(userContext)

  const notifications = await listNotifications(orgId, userId)

  return { notifications }
}

export async function action({ request, context }: Route.ActionArgs) {
  const { orgId } = context.get(orgContext)
  const { id: userId } = context.get(userContext)

  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'mark-read') {
    const notificationId = formData.get('notificationId') as string
    if (notificationId) {
      await markAsRead(orgId, notificationId, userId)
    }
  } else if (intent === 'mark-all-read') {
    await markAllAsRead(orgId, userId)
  }

  return redirect(href('/notifications'))
}

const typeConfig: Record<
  string,
  { icon: typeof Ticket02Icon; iconClass: string; bgClass: string }
> = {
  ticket_update: {
    icon: Ticket02Icon,
    iconClass: 'text-primary',
    bgClass: 'bg-primary/10',
  },
  ticket_comment: {
    icon: Comment01Icon,
    iconClass: 'text-primary',
    bgClass: 'bg-primary/10',
  },
  association_requested: {
    icon: UserAdd01Icon,
    iconClass: 'text-amber-600',
    bgClass: 'bg-amber-500/10',
  },
  association_approved: {
    icon: CheckmarkCircle01Icon,
    iconClass: 'text-emerald-600',
    bgClass: 'bg-emerald-500/10',
  },
  association_rejected: {
    icon: XingIcon,
    iconClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
  },
  invite_received: {
    icon: MailSend02Icon,
    iconClass: 'text-primary',
    bgClass: 'bg-primary/10',
  },
}

const defaultConfig = {
  icon: Notification03Icon,
  iconClass: 'text-muted-foreground',
  bgClass: 'bg-muted',
}

export default function NotificationsPage({ loaderData }: Route.ComponentProps) {
  const { notifications } = loaderData
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'

  const unreadCount = notifications.filter((n) => !n.readAt).length

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Notificações</h1>
          <p className="text-muted-foreground text-sm">
            {unreadCount > 0
              ? `${unreadCount} ${unreadCount === 1 ? 'não lida' : 'não lidas'}`
              : 'Todas lidas'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Form method="post">
            <input type="hidden" name="intent" value="mark-all-read" />
            <Button type="submit" variant="outline" disabled={isSubmitting}>
              Marcar todas como lidas
            </Button>
          </Form>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={Notification03Icon} message="Sem notificações" />
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {notifications.map((notification) => {
            const url = getNotificationUrl(notification.type, notification.metadata)
            const config = typeConfig[notification.type] ?? defaultConfig
            const isRead = !!notification.readAt

            const content = (
              <div
                className={`flex items-center gap-4 rounded-2xl p-4 ring-1 transition-colors ${
                  isRead
                    ? 'bg-muted/30 ring-foreground/5'
                    : 'bg-primary/5 ring-primary/10 hover:bg-primary/10'
                }`}
              >
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                    isRead ? 'bg-muted text-muted-foreground' : config.bgClass
                  }`}
                >
                  <HugeiconsIcon
                    icon={config.icon}
                    size={18}
                    strokeWidth={1.5}
                    className={isRead ? undefined : config.iconClass}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${isRead ? 'text-muted-foreground' : ''}`}>
                    {notification.title}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-sm">{notification.message}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-muted-foreground text-sm">
                    {formatRelativeTime(notification.createdAt)}
                  </span>
                  {!isRead && (
                    <Form method="post" onClick={(e) => e.stopPropagation()}>
                      <input type="hidden" name="intent" value="mark-read" />
                      <input type="hidden" name="notificationId" value={notification.id} />
                      <Button type="submit" variant="ghost" size="icon-sm" disabled={isSubmitting}>
                        <HugeiconsIcon icon={TickDouble02Icon} size={16} strokeWidth={2} />
                      </Button>
                    </Form>
                  )}
                </div>
              </div>
            )

            return url ? (
              <Link key={notification.id} to={url} className="block">
                {content}
              </Link>
            ) : (
              <div key={notification.id}>{content}</div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function getNotificationUrl(type: string, metadata: unknown): string | null {
  const meta = metadata as { [key: string]: string } | null
  if (!meta) return null

  switch (type) {
    case 'ticket_update':
    case 'ticket_comment':
      return meta.ticketId ? href('/tickets/:id', { id: meta.ticketId }) : null
    case 'association_requested':
      return href('/admin/associations')
    case 'association_approved':
    case 'association_rejected':
      return meta.fractionId ? href('/fractions/:id', { id: meta.fractionId }) : null
    case 'invite_received':
      return meta.token ? href('/invite/:token', { token: meta.token }) : null
    default:
      return null
  }
}
