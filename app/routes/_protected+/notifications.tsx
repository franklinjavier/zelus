import { Notification03Icon, TickDouble02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Form, href, Link, useNavigation } from 'react-router'
import { redirect } from 'react-router'

import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { orgContext, userContext } from '~/lib/auth/context'
import { formatDate } from '~/lib/format'
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
        <Card className="mt-6 gap-0 py-0">
          <CardContent className="p-0">
            <div className="divide-y">
              {notifications.map((notification) => {
                const url = getNotificationUrl(notification.type, notification.metadata)

                return (
                  <div
                    key={notification.id}
                    className={`flex items-center gap-3 px-4 py-3${notification.readAt ? 'opacity-50' : ''}`}
                  >
                    <span
                      className={`size-2 shrink-0 rounded-full ${!notification.readAt ? 'bg-primary' : 'bg-transparent'}`}
                    />
                    <div className="min-w-0 flex-1">
                      {url ? (
                        <Link to={url} className="text-sm font-medium hover:underline">
                          {notification.title}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium">{notification.title}</p>
                      )}
                      <p className="text-muted-foreground mt-0.5 text-sm">{notification.message}</p>
                    </div>
                    <span className="text-muted-foreground shrink-0 text-sm">
                      {formatDate(notification.createdAt)}
                    </span>
                    {!notification.readAt && (
                      <Form method="post">
                        <input type="hidden" name="intent" value="mark-read" />
                        <input type="hidden" name="notificationId" value={notification.id} />
                        <Button type="submit" variant="ghost" disabled={isSubmitting}>
                          <HugeiconsIcon
                            icon={TickDouble02Icon}
                            data-icon="inline-start"
                            size={16}
                            strokeWidth={2}
                          />
                          Marcar como lida
                        </Button>
                      </Form>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
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
    case 'association_approved':
    case 'association_rejected':
      return meta.fractionId ? href('/fractions/:id', { id: meta.fractionId }) : null
    case 'invite_received':
      return meta.token ? href('/invite/:token', { token: meta.token }) : null
    default:
      return null
  }
}
