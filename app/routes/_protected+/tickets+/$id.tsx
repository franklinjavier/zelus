import { useState } from 'react'
import { Edit02Icon, LockIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { data, Form, href, useFetcher } from 'react-router'

import { BackButton } from '~/components/layout/back-button'
import { ErrorBanner } from '~/components/layout/feedback'
import { PriorityIndicator, PrioritySelector } from '~/components/tickets/priority-indicator'
import { StatusBadge, statusLabels, type Status } from '~/components/tickets/status-badge'
import { TimelineEntry } from '~/components/tickets/timeline-entry'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Field, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Textarea } from '~/components/ui/textarea'
import {
  Drawer,
  DrawerPopup,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '~/components/ui/drawer'
import { orgContext, userContext } from '~/lib/auth/context'
import { getFractionRole } from '~/lib/auth/rbac'
import { translateCategory } from '~/lib/category-labels'
import { formatDate } from '~/lib/format'
import { listCategories } from '~/lib/services/categories'
import { deleteAttachment } from '~/lib/services/ticket-attachments'
import { addComment, getTicketTimeline } from '~/lib/services/ticket-comments'
import { getTicket, updateTicket, updateTicketStatus } from '~/lib/services/tickets'
import { setToast } from '~/lib/toast.server'
import type { Route } from './+types/$id'

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData?.ticket?.title ?? 'Ocorrência'
  return [{ title: `${title} — Zelus` }]
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  const user = context.get(userContext)

  const ticket = await getTicket(orgId, params.id, user.id)
  if (!ticket) throw new Response('Not Found', { status: 404 })

  // Private ticket access: only org_admin or creator
  if (ticket.private) {
    if (effectiveRole !== 'org_admin' && ticket.createdBy !== user.id) {
      throw new Response('Forbidden', { status: 403 })
    }
  }

  const [timeline, categories] = await Promise.all([
    getTicketTimeline(orgId, params.id),
    listCategories(),
  ])

  // canManage: org_admin OR fraction_owner_admin for the ticket's fraction
  let canManage = effectiveRole === 'org_admin'
  if (!canManage && ticket.fractionId) {
    const fractionRole = await getFractionRole(orgId, user.id, ticket.fractionId)
    canManage = fractionRole === 'fraction_owner_admin'
  }

  const isAdmin = effectiveRole === 'org_admin'
  const isCreator = ticket.createdBy === user.id

  return { ticket, timeline, categories, canManage, isAdmin, isCreator }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  const user = context.get(userContext)
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'comment') {
    const content = formData.get('content') as string
    if (!content?.trim()) return { error: 'Comentário obrigatório.' }
    await addComment(orgId, params.id, content, user.id)
    return data({ success: true }, { headers: await setToast('Alterações guardadas.') })
  }

  if (intent === 'update-status') {
    // Check canManage
    let canManage = effectiveRole === 'org_admin'
    if (!canManage) {
      const ticket = await getTicket(orgId, params.id, user.id)
      if (ticket?.fractionId) {
        const fractionRole = await getFractionRole(orgId, user.id, ticket.fractionId)
        canManage = fractionRole === 'fraction_owner_admin'
      }
    }
    if (!canManage) throw new Response('Forbidden', { status: 403 })

    const status = formData.get('status') as 'open' | 'in_progress' | 'resolved' | 'closed'
    if (!status) return { error: 'Estado obrigatório.' }
    await updateTicketStatus(orgId, params.id, status, user.id)
    return data({ success: true }, { headers: await setToast('Alterações guardadas.') })
  }

  if (intent === 'update-ticket') {
    // Only creator or admin can edit
    const ticket = await getTicket(orgId, params.id, user.id)
    if (!ticket) throw new Response('Not Found', { status: 404 })
    if (effectiveRole !== 'org_admin' && ticket.createdBy !== user.id) {
      throw new Response('Forbidden', { status: 403 })
    }

    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const category = formData.get('category') as string
    const priority = formData.get('priority') as string
    const isPrivate = formData.get('private') === 'on'

    if (!title?.trim()) return { error: 'Título obrigatório.' }

    await updateTicket(
      orgId,
      params.id,
      {
        title,
        description: description || undefined,
        category: category || null,
        priority: (priority as 'urgent' | 'high' | 'medium' | 'low') || null,
        private: isPrivate,
      },
      user.id,
    )
    return data({ success: true }, { headers: await setToast('Alterações guardadas.') })
  }

  if (intent === 'delete-attachment') {
    const attachmentId = formData.get('attachmentId') as string
    if (!attachmentId) return { error: 'Anexo não encontrado.' }
    try {
      await deleteAttachment(orgId, attachmentId, user.id)
      return data({ success: true }, { headers: await setToast('Alterações guardadas.') })
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erro ao apagar anexo.' }
    }
  }

  return { error: 'Ação desconhecida.' }
}

export default function TicketDetailPage({ loaderData, actionData }: Route.ComponentProps) {
  const { ticket, timeline, categories, canManage, isAdmin, isCreator } = loaderData
  const statusFetcher = useFetcher()
  const canEdit = isAdmin || isCreator
  const [editOpen, setEditOpen] = useState(false)

  const statusItems = (Object.entries(statusLabels) as [Status, string][]).map(
    ([value, label]) => ({
      label,
      value,
    }),
  )

  const editCategoryItems = [
    { label: '— Nenhuma —', value: '' },
    ...categories.map((c) => ({ label: translateCategory(c.key), value: c.key })),
  ]

  const formattedDate = formatDate(ticket.createdAt)

  return (
    <div>
      <BackButton to={href('/tickets')} />

      {actionData && 'error' in actionData && (
        <ErrorBanner className="mt-4">{actionData.error}</ErrorBanner>
      )}

      {/* Title + description header */}
      <div className="mt-6 mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">{ticket.title}</h1>
            {ticket.private && (
              <HugeiconsIcon
                icon={LockIcon}
                size={14}
                strokeWidth={2}
                className="text-muted-foreground"
              />
            )}
          </div>
          {ticket.description && (
            <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">
              {ticket.description}
            </p>
          )}
        </div>
        {canEdit && (
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <HugeiconsIcon icon={Edit02Icon} data-icon="inline-start" size={16} strokeWidth={2} />
            Editar
          </Button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Left column: Timeline + Comment */}
        <div className="flex flex-col gap-5 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Atividade</CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  Sem atividade registada
                </p>
              ) : (
                <div className="flex flex-col gap-5">
                  {timeline.map((item) => (
                    <TimelineEntry key={item.id} item={item} />
                  ))}
                </div>
              )}

              {/* Comment form */}
              <div className="mt-6 border-t pt-5">
                <Form method="post" className="flex flex-col gap-3">
                  <input type="hidden" name="intent" value="comment" />
                  <Textarea name="content" placeholder="Escrever comentário..." rows={3} required />
                  <div className="flex justify-end">
                    <Button type="submit">Comentar</Button>
                  </div>
                </Form>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Details */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Detalhes</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-4">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground text-sm">Estado</dt>
                  <dd>
                    {canManage ? (
                      <statusFetcher.Form method="post">
                        <input type="hidden" name="intent" value="update-status" />
                        <Select
                          name="status"
                          defaultValue={ticket.status}
                          onValueChange={(value) => {
                            if (!value) return
                            const formData = new FormData()
                            formData.set('intent', 'update-status')
                            formData.set('status', value)
                            statusFetcher.submit(formData, { method: 'post' })
                          }}
                          items={statusItems}
                        >
                          <SelectTrigger className="h-8 w-auto min-w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusItems.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </statusFetcher.Form>
                    ) : (
                      <StatusBadge status={ticket.status as Status} />
                    )}
                  </dd>
                </div>

                {/* Priority */}
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground text-sm">Prioridade</dt>
                  <dd>
                    <PriorityIndicator priority={ticket.priority} />
                  </dd>
                </div>

                {/* Category */}
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground text-sm">Categoria</dt>
                  <dd>
                    {ticket.category ? (
                      <Badge variant="secondary">{translateCategory(ticket.category)}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">&mdash;</span>
                    )}
                  </dd>
                </div>

                {/* Fraction */}
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground text-sm">Fração</dt>
                  <dd className="text-sm">
                    {ticket.fractionLabel || <span className="text-muted-foreground">&mdash;</span>}
                  </dd>
                </div>

                {/* Creator */}
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground text-sm">Criado por</dt>
                  <dd className="text-sm">{ticket.creatorName}</dd>
                </div>

                {/* Created date */}
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground text-sm">Criado em</dt>
                  <dd className="text-sm">{formattedDate}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Drawer */}
      {canEdit && (
        <Drawer open={editOpen} onOpenChange={setEditOpen}>
          <DrawerPopup>
            <DrawerHeader>
              <DrawerTitle>Editar ocorrência</DrawerTitle>
              <DrawerDescription>Altere os dados da ocorrência.</DrawerDescription>
            </DrawerHeader>
            <div className="px-6 pb-6">
              <Form method="post" className="grid gap-4" onSubmit={() => setEditOpen(false)}>
                <input type="hidden" name="intent" value="update-ticket" />

                <Field>
                  <FieldLabel htmlFor="edit-title">Título</FieldLabel>
                  <Input id="edit-title" name="title" defaultValue={ticket.title} required />
                </Field>

                <Field>
                  <FieldLabel htmlFor="edit-description">Descrição</FieldLabel>
                  <Textarea
                    id="edit-description"
                    name="description"
                    defaultValue={ticket.description ?? ''}
                    rows={4}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="edit-category">Categoria</FieldLabel>
                  <Select
                    name="category"
                    defaultValue={ticket.category ?? ''}
                    items={editCategoryItems}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {editCategoryItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>Prioridade</FieldLabel>
                  <PrioritySelector name="priority" defaultValue={ticket.priority ?? ''} />
                </Field>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="private"
                    defaultChecked={ticket.private}
                    className="accent-primary h-5 w-5 rounded"
                  />
                  <span className="text-sm">Marcar como privado</span>
                </label>

                <Button type="submit" className="mt-1">
                  Guardar
                </Button>
              </Form>
            </div>
          </DrawerPopup>
        </Drawer>
      )}
    </div>
  )
}
