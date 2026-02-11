import { data, Form, useFetcher, Link } from 'react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Calendar03Icon,
  UserCircleIcon,
  Home11Icon,
  LockIcon,
  Edit02Icon,
} from '@hugeicons/core-free-icons'

import type { Route } from './+types/$id'
import { orgContext, userContext } from '~/lib/auth/context'
import { getFractionRole } from '~/lib/auth/rbac'
import { getTicket, updateTicket, updateTicketStatus } from '~/lib/services/tickets'
import { addComment, getTicketTimeline } from '~/lib/services/ticket-comments'
import { deleteAttachment } from '~/lib/services/ticket-attachments'
import { listCategories } from '~/lib/services/categories'
import { translateCategory } from '~/lib/category-labels'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import { Field, FieldLabel } from '~/components/ui/field'
import { Textarea } from '~/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { StatusBadge, statusLabels, type Status } from '~/components/tickets/status-badge'
import { PriorityIndicator, PrioritySelector } from '~/components/tickets/priority-indicator'
import { TimelineEntry } from '~/components/tickets/timeline-entry'
import { formatDate } from '~/lib/format'
import { BackButton } from '~/components/layout/back-button'
import { ErrorBanner } from '~/components/layout/feedback'
import { setToast } from '~/lib/toast.server'

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData?.ticket?.title ?? 'Ocorrencia'
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
    if (!content?.trim()) return { error: 'Comentario obrigatorio.' }
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
    if (!status) return { error: 'Estado obrigatorio.' }
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

    if (!title?.trim()) return { error: 'Titulo obrigatorio.' }

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
    if (!attachmentId) return { error: 'Anexo nao encontrado.' }
    try {
      await deleteAttachment(orgId, attachmentId, user.id)
      return data({ success: true }, { headers: await setToast('Alterações guardadas.') })
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erro ao apagar anexo.' }
    }
  }

  return { error: 'Acao desconhecida.' }
}

export default function TicketDetailPage({ loaderData, actionData }: Route.ComponentProps) {
  const { ticket, timeline, categories, canManage, isAdmin, isCreator } = loaderData
  const statusFetcher = useFetcher()
  const canEdit = isAdmin || isCreator

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
      <BackButton to="/tickets" />

      {actionData && 'error' in actionData && (
        <ErrorBanner className="mt-4">{actionData.error}</ErrorBanner>
      )}

      {/* Title + description header */}
      <div className="mt-6 mb-5">
        <h1 className="text-lg font-semibold tracking-tight">{ticket.title}</h1>
        {ticket.description && (
          <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">
            {ticket.description}
          </p>
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
                  <Textarea name="content" placeholder="Escrever comentario..." rows={3} required />
                  <div className="flex justify-end">
                    <Button type="submit">Comentar</Button>
                  </div>
                </Form>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Details + Edit */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          {/* Details Card */}
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
                  <dt className="text-muted-foreground text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <HugeiconsIcon
                        icon={Home11Icon}
                        size={14}
                        strokeWidth={2}
                        className="text-muted-foreground"
                      />
                      Fracao
                    </span>
                  </dt>
                  <dd className="text-sm">
                    {ticket.fractionLabel || <span className="text-muted-foreground">&mdash;</span>}
                  </dd>
                </div>

                {/* Creator */}
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <HugeiconsIcon
                        icon={UserCircleIcon}
                        size={14}
                        strokeWidth={2}
                        className="text-muted-foreground"
                      />
                      Criado por
                    </span>
                  </dt>
                  <dd className="text-sm">{ticket.creatorName}</dd>
                </div>

                {/* Created date */}
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <HugeiconsIcon
                        icon={Calendar03Icon}
                        size={14}
                        strokeWidth={2}
                        className="text-muted-foreground"
                      />
                      Criado em
                    </span>
                  </dt>
                  <dd className="text-sm">{formattedDate}</dd>
                </div>

                {/* Private */}
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <HugeiconsIcon
                        icon={LockIcon}
                        size={14}
                        strokeWidth={2}
                        className="text-muted-foreground"
                      />
                      Privado
                    </span>
                  </dt>
                  <dd className="text-sm">{ticket.private ? 'Sim' : 'Nao'}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Edit Card (only if creator or admin) */}
          {canEdit && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <span className="inline-flex items-center gap-2">
                    <HugeiconsIcon icon={Edit02Icon} size={16} strokeWidth={2} />
                    Editar ocorrencia
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form method="post" className="grid gap-4">
                  <input type="hidden" name="intent" value="update-ticket" />

                  <Field>
                    <FieldLabel htmlFor="edit-title">Titulo</FieldLabel>
                    <Input id="edit-title" name="title" defaultValue={ticket.title} required />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="edit-description">Descricao</FieldLabel>
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

                  <div className="flex justify-end pt-2">
                    <Button type="submit">Guardar</Button>
                  </div>
                </Form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
