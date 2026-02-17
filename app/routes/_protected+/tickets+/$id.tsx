import { useRef, useState } from 'react'
import {
  Add01Icon,
  ArrowUp01Icon,
  Attachment01Icon,
  Camera01Icon,
  CheckmarkCircle01Icon,
  Delete02Icon,
  Edit02Icon,
  File01Icon,
  LockIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { data, Form, href, useFetcher } from 'react-router'

import { BackButton } from '~/components/layout/back-button'
import { EmptyState } from '~/components/layout/empty-state'
import { ErrorBanner } from '~/components/layout/feedback'
import { PriorityIndicator, PrioritySelector } from '~/components/tickets/priority-indicator'
import { StatusBadge, statusLabels, type Status } from '~/components/tickets/status-badge'
import { TimelineEntry, ImagePreview, formatFileSize } from '~/components/tickets/timeline-entry'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Field, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { CategorySelect } from '~/components/shared/category-select'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Textarea } from '~/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Drawer,
  DrawerPopup,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '~/components/ui/drawer'
import { orgContext, userContext } from '~/lib/auth/context'
import { getFractionRole } from '~/lib/auth/rbac'
import { hasCategoryLabel, translateCategory } from '~/lib/category-labels'
import { formatDate } from '~/lib/format'
import { listCategories } from '~/lib/services/categories'
import {
  createAttachment,
  deleteAttachment,
  listTicketAttachments,
} from '~/lib/services/ticket-attachments'
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

  const [timeline, categories, attachments] = await Promise.all([
    getTicketTimeline(orgId, params.id),
    listCategories(),
    listTicketAttachments(orgId, params.id),
  ])

  // canManage: org_admin OR fraction_owner_admin for the ticket's fraction
  let canManage = effectiveRole === 'org_admin'
  if (!canManage && ticket.fractionId) {
    const fractionRole = await getFractionRole(orgId, user.id, ticket.fractionId)
    canManage = fractionRole === 'fraction_owner_admin'
  }

  const isAdmin = effectiveRole === 'org_admin'
  const isCreator = ticket.createdBy === user.id

  return {
    ticket,
    timeline,
    categories,
    attachments,
    canManage,
    isAdmin,
    isCreator,
    userId: user.id,
  }
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

  if (intent === 'update-field') {
    const ticket = await getTicket(orgId, params.id, user.id)
    if (!ticket) throw new Response('Not Found', { status: 404 })
    if (effectiveRole !== 'org_admin' && ticket.createdBy !== user.id) {
      throw new Response('Forbidden', { status: 403 })
    }

    const field = formData.get('field') as string
    const value = formData.get('value') as string

    if (field === 'priority') {
      await updateTicket(
        orgId,
        params.id,
        { priority: (value as 'urgent' | 'high' | 'medium' | 'low') || null },
        user.id,
      )
      return data({ success: true }, { headers: await setToast('Alterações guardadas.') })
    }

    if (field === 'category') {
      await updateTicket(orgId, params.id, { category: value || null }, user.id)
      return data({ success: true }, { headers: await setToast('Alterações guardadas.') })
    }

    return { error: 'Campo desconhecido.' }
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

  if (intent === 'attach') {
    const fileName = formData.get('fileName') as string
    const fileUrl = formData.get('fileUrl') as string
    const fileSize = formData.get('fileSize') as string
    const mimeType = formData.get('mimeType') as string
    if (!fileName || !fileUrl) return { error: 'Ficheiro inválido.' }
    await createAttachment(
      orgId,
      {
        ticketId: params.id,
        fileName,
        fileUrl,
        fileSize: Number(fileSize),
        mimeType,
      },
      user.id,
    )
    return data({ success: true }, { headers: await setToast('Ficheiro anexado.') })
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
  const { ticket, timeline, categories, attachments, canManage, isAdmin, isCreator, userId } =
    loaderData
  const statusFetcher = useFetcher()
  const priorityFetcher = useFetcher()
  const categoryFetcher = useFetcher()
  const attachFetcher = useFetcher()
  const evidenceFetcher = useFetcher()
  const canEdit = isAdmin || isCreator
  const [editOpen, setEditOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isEvidenceUploading, setIsEvidenceUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const evidenceFileInputRef = useRef<HTMLInputElement>(null)
  const priorityCurrent =
    (priorityFetcher.formData?.get('value') as string) ?? ticket.priority ?? ''

  const statusItems = (Object.entries(statusLabels) as [Status, string][]).map(
    ([value, label]) => ({
      label,
      value,
    }),
  )

  const formattedDate = formatDate(ticket.createdAt)

  return (
    <div>
      <div className="flex items-center justify-between">
        <BackButton to={href('/tickets')} />
        {canEdit && (
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <HugeiconsIcon icon={Edit02Icon} data-icon="inline-start" size={16} strokeWidth={2} />
            Editar
          </Button>
        )}
      </div>

      {actionData && 'error' in actionData && (
        <ErrorBanner className="mt-4">{actionData.error}</ErrorBanner>
      )}

      {/* Title + description header */}
      <div className="mt-6 mb-5">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{ticket.title}</h1>
          {ticket.private && (
            <Badge variant="outline" className="gap-1">
              <HugeiconsIcon icon={LockIcon} size={12} strokeWidth={2} />
              Privado
            </Badge>
          )}
        </div>
        {ticket.description && (
          <p className="text-muted-foreground mt-2 text-base whitespace-pre-wrap">
            {ticket.description}
          </p>
        )}
      </div>

      {/* Evidence thumbnails */}
      {(attachments.length > 0 || canEdit) && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Tooltip>
            <TooltipTrigger className="text-muted-foreground mr-1 flex items-center gap-1.5">
              <HugeiconsIcon icon={Camera01Icon} size={16} strokeWidth={1.5} />
              <span className="text-sm">Evidências</span>
            </TooltipTrigger>
            <TooltipContent>Fotos e ficheiros que documentam a ocorrência</TooltipContent>
          </Tooltip>
          {attachments.map((att) => {
            const isImage = att.mimeType.startsWith('image/')
            return (
              <div key={att.id} className="group relative">
                {isImage ? (
                  <ImagePreview
                    src={att.fileUrl}
                    alt={att.fileName}
                    className="block size-14 cursor-zoom-in overflow-hidden rounded-md border"
                    caption={`${att.uploaderName} · ${formatDate(att.createdAt)}`}
                  />
                ) : (
                  <a
                    href={att.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${att.fileName} (${formatFileSize(att.fileSize)})`}
                    className="border-border bg-muted/50 hover:bg-muted flex size-14 flex-col items-center justify-center gap-0.5 rounded-md border transition-colors"
                  >
                    <HugeiconsIcon
                      icon={File01Icon}
                      size={18}
                      strokeWidth={1.5}
                      className="text-muted-foreground"
                    />
                    <span className="text-muted-foreground w-12 truncate text-center text-[10px]">
                      {att.fileName.split('.').pop()}
                    </span>
                  </a>
                )}
                {canEdit && att.uploadedBy === userId && (
                  <evidenceFetcher.Form method="post" className="absolute -top-1.5 -right-1.5">
                    <input type="hidden" name="intent" value="delete-attachment" />
                    <input type="hidden" name="attachmentId" value={att.id} />
                    <Button
                      type="submit"
                      variant="destructive"
                      size="icon-sm"
                      className="size-5 rounded-full opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={12} strokeWidth={2} />
                    </Button>
                  </evidenceFetcher.Form>
                )}
              </div>
            )
          })}
          {canEdit && (
            <>
              <input
                ref={evidenceFileInputRef}
                type="file"
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setIsEvidenceUploading(true)
                  try {
                    const body = new FormData()
                    body.append('file', file)
                    const res = await fetch(href('/api/upload'), { method: 'POST', body })
                    const json = await res.json()
                    if (!res.ok || !json.url) return
                    evidenceFetcher.submit(
                      {
                        intent: 'attach',
                        fileName: json.fileName,
                        fileUrl: json.url,
                        fileSize: String(json.fileSize),
                        mimeType: json.mimeType,
                      },
                      { method: 'post' },
                    )
                  } finally {
                    setIsEvidenceUploading(false)
                    if (evidenceFileInputRef.current) evidenceFileInputRef.current.value = ''
                  }
                }}
              />
              {attachments.length > 0 ? (
                <button
                  type="button"
                  disabled={isEvidenceUploading || evidenceFetcher.state !== 'idle'}
                  onClick={() => evidenceFileInputRef.current?.click()}
                  className="border-border text-muted-foreground hover:bg-muted flex size-14 items-center justify-center rounded-md border border-dashed transition-colors disabled:opacity-50"
                >
                  <HugeiconsIcon icon={Add01Icon} size={18} strokeWidth={1.5} />
                </button>
              ) : (
                <Button
                  variant="outline"
                  disabled={isEvidenceUploading || evidenceFetcher.state !== 'idle'}
                  onClick={() => evidenceFileInputRef.current?.click()}
                >
                  <HugeiconsIcon
                    icon={Add01Icon}
                    data-icon="inline-start"
                    size={16}
                    strokeWidth={2}
                  />
                  Adicionar
                </Button>
              )}
            </>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Left column: Timeline + Comment */}
        <div className="flex flex-col gap-5 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Atividade</CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <EmptyState icon={CheckmarkCircle01Icon} message="Sem atividade registada" />
              ) : (
                <div className="flex flex-col">
                  {timeline
                    .filter((item) => item.type !== 'attachment')
                    .map((item) => (
                      <TimelineEntry key={item.id} item={item} />
                    ))}
                </div>
              )}

              {/* Comment form */}
              <Form key={timeline.length} method="post" className="relative mt-6">
                <input type="hidden" name="intent" value="comment" />
                <Textarea
                  name="content"
                  placeholder="Escrever comentário..."
                  rows={2}
                  required
                  className="pr-12 pb-10"
                />
                <div className="absolute right-3 bottom-3 flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setIsUploading(true)
                      try {
                        const body = new FormData()
                        body.append('file', file)
                        const res = await fetch(href('/api/upload'), { method: 'POST', body })
                        const json = await res.json()
                        if (!res.ok || !json.url) return
                        attachFetcher.submit(
                          {
                            intent: 'attach',
                            fileName: json.fileName,
                            fileUrl: json.url,
                            fileSize: String(json.fileSize),
                            mimeType: json.mimeType,
                          },
                          { method: 'post' },
                        )
                      } finally {
                        setIsUploading(false)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 rounded-lg"
                    disabled={isUploading || attachFetcher.state !== 'idle'}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <HugeiconsIcon icon={Attachment01Icon} size={16} strokeWidth={2} />
                  </Button>
                  <Button type="submit" size="icon" variant="default" className="size-8 rounded-lg">
                    <HugeiconsIcon icon={ArrowUp01Icon} size={16} strokeWidth={2} />
                  </Button>
                </div>
              </Form>
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
                            if (!value || value === ticket.status) return
                            const formData = new FormData()
                            formData.set('intent', 'update-status')
                            formData.set('status', value)
                            statusFetcher.submit(formData, { method: 'post' })
                          }}
                          items={statusItems}
                        >
                          <SelectTrigger className="h-10 w-auto min-w-32">
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
                    {canEdit ? (
                      <PrioritySelector
                        value={priorityCurrent}
                        className="h-10 w-auto min-w-32"
                        onValueChange={(value) => {
                          const v = value ?? ''
                          if (v === priorityCurrent) return
                          const formData = new FormData()
                          formData.set('intent', 'update-field')
                          formData.set('field', 'priority')
                          formData.set('value', v)
                          priorityFetcher.submit(formData, { method: 'post' })
                        }}
                      />
                    ) : (
                      <PriorityIndicator priority={ticket.priority} />
                    )}
                  </dd>
                </div>

                {/* Category */}
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground text-sm">Categoria</dt>
                  <dd>
                    {canEdit ? (
                      <InlineCategorySelect
                        categories={categories}
                        defaultValue={ticket.category}
                        fetcher={categoryFetcher}
                      />
                    ) : ticket.category && hasCategoryLabel(ticket.category) ? (
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
                  <FieldLabel>Categoria</FieldLabel>
                  <CategorySelect categories={categories} defaultValue={ticket.category} />
                </Field>

                <Field>
                  <FieldLabel>Prioridade</FieldLabel>
                  <PrioritySelector name="priority" defaultValue={ticket.priority ?? ''} />
                </Field>

                <label className="flex items-center gap-2">
                  <Checkbox name="private" defaultChecked={ticket.private} />
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

function InlineCategorySelect({
  categories,
  defaultValue,
  fetcher,
}: {
  categories: { key: string }[]
  defaultValue: string | null
  fetcher: ReturnType<typeof useFetcher>
}) {
  const current = defaultValue

  return (
    <CategorySelect
      categories={categories}
      defaultValue={current}
      onValueChange={(value) => {
        if (value === current) return
        const formData = new FormData()
        formData.set('intent', 'update-field')
        formData.set('field', 'category')
        formData.set('value', value ?? '')
        fetcher.submit(formData, { method: 'post' })
      }}
    />
  )
}
