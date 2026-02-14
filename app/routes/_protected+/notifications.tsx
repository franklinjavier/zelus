import { Notification03Icon } from '@hugeicons/core-free-icons'
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
            <Button type="submit" variant="outline" size="sm" disabled={isSubmitting}>
              Marcar todas como lidas
            </Button>
          </Form>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={Notification03Icon} message="Sem notificações" />
      ) : (
        <div className="mt-6 grid gap-2">
          {notifications.map((notification) => {
            const url = getNotificationUrl(notification.type, notification.metadata)

            return (
              <Card
                key={notification.id}
                className={notification.readAt ? 'opacity-60' : undefined}
              >
                <CardContent className="flex items-start gap-3 px-5 py-4">
                  {!notification.readAt && (
                    <span className="bg-primary mt-1.5 size-2.5 shrink-0 rounded-full" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {url ? (
                          <Link to={url} className="font-medium hover:underline">
                            {notification.title}
                          </Link>
                        ) : (
                          <p className="font-medium">{notification.title}</p>
                        )}
                        <p className="text-muted-foreground mt-0.5 text-sm">
                          {notification.message}
                        </p>
                      </div>
                      <span className="text-muted-foreground shrink-0 text-sm">
                        {formatDate(notification.createdAt)}
                      </span>
                    </div>
                  </div>
                  {!notification.readAt && (
                    <Form method="post">
                      <input type="hidden" name="intent" value="mark-read" />
                      <input type="hidden" name="notificationId" value={notification.id} />
                      <Button type="submit" variant="ghost" size="sm" disabled={isSubmitting}>
                        Marcar como lida
                      </Button>
                    </Form>
                  )}
                </CardContent>
              </Card>
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
    case 'association_approved':
    case 'association_rejected':
      return meta.fractionId ? href('/fractions/:id', { id: meta.fractionId }) : null
    case 'invite_received':
      return meta.token ? href('/invite/:token', { token: meta.token }) : null
    default:
      return null
  }
}
