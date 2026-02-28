import { useEffect, useRef, useState } from 'react'
import { uploadFile } from '~/lib/upload'
import {
  ArrowUp01Icon,
  Attachment01Icon,
  Camera01Icon,
  CheckmarkCircle01Icon,
  Delete02Icon,
  Edit02Icon,
  File01Icon,
  Loading03Icon,
  LockIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { data, Form, href, useFetcher } from 'react-router'

import { BackButton } from '~/components/layout/back-button'
import { EmptyState } from '~/components/layout/empty-state'
import { ErrorBanner } from '~/components/layout/feedback'
import { PriorityIndicator, PrioritySelector } from '~/components/tickets/priority-indicator'
import { StatusBadge, statusLabels, type Status } from '~/components/tickets/status-badge'
import {
  TimelineEntry,
  ImagePreview,
  formatFileSize,
  type TimelineItem,
} from '~/components/tickets/timeline-entry'
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
import { listCategories } from '~/lib/services/categories.server'
import {
  createAttachment,
  deleteAttachment,
  listTicketAttachments,
} from '~/lib/services/ticket-attachments.server'
import { listFractions } from '~/lib/services/fractions.server'
import { addComment, getTicketTimeline } from '~/lib/services/ticket-comments.server'
import { getTicket, updateTicket, updateTicketStatus } from '~/lib/services/tickets.server'
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

  const [timeline, categories, attachments, orgFractions] = await Promise.all([
    getTicketTimeline(orgId, params.id),
    listCategories(),
    listTicketAttachments(orgId, params.id),
    listFractions(orgId),
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
    orgFractions,
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

    if (field === 'fractionId') {
      await updateTicket(orgId, params.id, { fractionId: value || null }, user.id)
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
    const fractionId = formData.get('fractionId') as string
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
        fractionId: fractionId || null,
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
  const {
    ticket,
    timeline,
    categories,
    attachments,
    orgFractions,
    canManage,
    isAdmin,
    isCreator,
    userId,
  } = loaderData
  const statusFetcher = useFetcher()
  const priorityFetcher = useFetcher()
  const categoryFetcher = useFetcher()
  const fractionFetcher = useFetcher()
  const attachFetcher = useFetcher()
  const evidenceFetcher = useFetcher()
  const canEdit = isAdmin || isCreator
  const [editOpen, setEditOpen] = useState(false)

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

      <TicketHeader ticket={ticket} />

      <EvidenceGallery
        attachments={attachments}
        canEdit={canEdit}
        userId={userId}
        evidenceFetcher={evidenceFetcher}
      />

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="flex flex-col gap-5 lg:col-span-3">
          <ActivityCard timeline={timeline} attachFetcher={attachFetcher} />
        </div>

        <div className="lg:sticky lg:top-4 lg:col-span-2 lg:self-start">
          <DetailsCard
            ticket={ticket}
            categories={categories}
            orgFractions={orgFractions}
            canManage={canManage}
            canEdit={canEdit}
            statusFetcher={statusFetcher}
            priorityFetcher={priorityFetcher}
            categoryFetcher={categoryFetcher}
            fractionFetcher={fractionFetcher}
          />
        </div>
      </div>

      {canEdit && (
        <EditTicketDrawer
          ticket={ticket}
          categories={categories}
          orgFractions={orgFractions}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </div>
  )
}

function TicketHeader({
  ticket,
}: {
  ticket: { title: string; private: boolean; description: string | null }
}) {
  return (
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
  )
}

function EvidenceGallery({
  attachments,
  canEdit,
  userId,
  evidenceFetcher,
}: {
  attachments: {
    id: string
    fileName: string
    fileUrl: string
    fileSize: number
    mimeType: string
    uploadedBy: string
    uploaderName: string
    createdAt: Date | string
  }[]
  canEdit: boolean
  userId: string
  evidenceFetcher: ReturnType<typeof useFetcher>
}) {
  const [isEvidenceUploading, setIsEvidenceUploading] = useState(false)
  const evidenceFileInputRef = useRef<HTMLInputElement>(null)
  const [pendingPreviews, setPendingPreviews] = useState<
    { fileName: string; previewUrl: string; fileSize: number; mimeType: string }[]
  >([])
  const lastAttachmentCount = useRef(attachments.length)

  // Remove pending previews as server confirms new attachments
  useEffect(() => {
    if (attachments.length > lastAttachmentCount.current) {
      const diff = attachments.length - lastAttachmentCount.current
      setPendingPreviews((prev) => {
        const toRemove = prev.slice(0, diff)
        toRemove.forEach((p) => URL.revokeObjectURL(p.previewUrl))
        return prev.slice(diff)
      })
    }
    lastAttachmentCount.current = attachments.length
  }, [attachments.length])

  if (attachments.length === 0 && pendingPreviews.length === 0 && !canEdit) return null

  return (
    <div className="mb-5 flex flex-wrap items-start gap-3">
      {attachments.map((att) => {
        const isImage = att.mimeType.startsWith('image/')
        return (
          <div key={att.id} className="group relative w-32">
            {isImage ? (
              <ImagePreview
                src={att.fileUrl}
                alt={att.fileName}
                className="ring-foreground/10 block h-36 w-full cursor-zoom-in overflow-hidden rounded-2xl ring-1"
                caption={`${att.uploaderName} · ${formatDate(att.createdAt)}`}
              />
            ) : (
              <a
                href={att.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={`${att.fileName} (${formatFileSize(att.fileSize)})`}
                className="ring-foreground/10 hover:ring-primary/20 flex h-36 w-full flex-col items-center justify-center gap-1.5 rounded-2xl ring-1 transition-colors"
              >
                <HugeiconsIcon
                  icon={File01Icon}
                  size={24}
                  strokeWidth={1.5}
                  className="text-muted-foreground"
                />
                <span className="text-muted-foreground text-sm">
                  {att.fileName.split('.').pop()?.toUpperCase()}
                </span>
              </a>
            )}
            {canEdit && att.uploadedBy === userId && (
              <evidenceFetcher.Form method="post" className="absolute -top-2 -right-2">
                <input type="hidden" name="intent" value="delete-attachment" />
                <input type="hidden" name="attachmentId" value={att.id} />
                <Button
                  type="submit"
                  variant="destructive"
                  size="icon-sm"
                  className="size-7 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={2} />
                </Button>
              </evidenceFetcher.Form>
            )}
          </div>
        )
      })}
      {pendingPreviews.map((p, i) => {
        const isImage = p.mimeType.startsWith('image/')
        return (
          <div key={`pending-${i}`} className="relative w-32">
            {isImage ? (
              <div className="ring-foreground/10 relative h-36 w-full overflow-hidden rounded-2xl ring-1">
                <img
                  src={p.previewUrl}
                  alt={p.fileName}
                  className="size-full object-cover opacity-60"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    size={20}
                    strokeWidth={1.5}
                    className="animate-spin text-white drop-shadow"
                  />
                </div>
              </div>
            ) : (
              <div className="ring-foreground/10 flex h-36 w-full flex-col items-center justify-center gap-1.5 rounded-2xl ring-1">
                <HugeiconsIcon
                  icon={File01Icon}
                  size={24}
                  strokeWidth={1.5}
                  className="text-muted-foreground"
                />
                <HugeiconsIcon
                  icon={Loading03Icon}
                  size={16}
                  strokeWidth={1.5}
                  className="text-muted-foreground animate-spin"
                />
              </div>
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
              const previewUrl = URL.createObjectURL(file)
              setPendingPreviews((prev) => [
                ...prev,
                { fileName: file.name, previewUrl, fileSize: file.size, mimeType: file.type },
              ])
              setIsEvidenceUploading(true)
              try {
                const { url } = await uploadFile(file, { access: 'public' })
                evidenceFetcher.submit(
                  {
                    intent: 'attach',
                    fileName: file.name,
                    fileUrl: url,
                    fileSize: String(file.size),
                    mimeType: file.type,
                  },
                  { method: 'post' },
                )
              } catch {
                setPendingPreviews((prev) => {
                  const idx = prev.findIndex((p) => p.previewUrl === previewUrl)
                  if (idx === -1) return prev
                  URL.revokeObjectURL(previewUrl)
                  return [...prev.slice(0, idx), ...prev.slice(idx + 1)]
                })
              } finally {
                setIsEvidenceUploading(false)
                if (evidenceFileInputRef.current) evidenceFileInputRef.current.value = ''
              }
            }}
          />
          <button
            type="button"
            className="border-foreground/10 text-muted-foreground hover:border-primary/30 hover:text-primary flex h-36 w-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed transition-colors"
            disabled={isEvidenceUploading}
            onClick={() => evidenceFileInputRef.current?.click()}
          >
            <HugeiconsIcon icon={Camera01Icon} size={20} strokeWidth={1.5} />
            <span className="text-sm font-medium">Adicionar evidência</span>
          </button>
        </>
      )}
    </div>
  )
}

function ActivityCard({
  timeline,
  attachFetcher,
}: {
  timeline: TimelineItem[]
  attachFetcher: ReturnType<typeof useFetcher>
}) {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <Card>
      <CardContent>
        {timeline.length === 0 ? (
          <EmptyState
            icon={CheckmarkCircle01Icon}
            message="Sem atividade registada"
            className="mt-4"
          />
        ) : (
          <div className="flex flex-col">
            {timeline
              .filter((item) => item.type !== 'attachment')
              .map((item) => (
                <TimelineEntry key={item.id} item={item} />
              ))}
          </div>
        )}

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
                  const { url } = await uploadFile(file, { access: 'public' })
                  attachFetcher.submit(
                    {
                      intent: 'attach',
                      fileName: file.name,
                      fileUrl: url,
                      fileSize: String(file.size),
                      mimeType: file.type,
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
              <HugeiconsIcon
                icon={isUploading ? Loading03Icon : Attachment01Icon}
                size={16}
                strokeWidth={2}
                className={isUploading ? 'animate-spin' : undefined}
              />
            </Button>
            <Button type="submit" size="icon" variant="default" className="size-8 rounded-lg">
              <HugeiconsIcon icon={ArrowUp01Icon} size={16} strokeWidth={2} />
            </Button>
          </div>
        </Form>
      </CardContent>
    </Card>
  )
}

function DetailsCard({
  ticket,
  categories,
  orgFractions,
  canManage,
  canEdit,
  statusFetcher,
  priorityFetcher,
  categoryFetcher,
  fractionFetcher,
}: {
  ticket: {
    status: string
    priority: 'urgent' | 'high' | 'medium' | 'low' | null
    category: string | null
    fractionId: string | null
    fractionLabel: string | null
    creatorName: string
    createdAt: Date | string
  }
  categories: { key: string }[]
  orgFractions: { id: string; label: string }[]
  canManage: boolean
  canEdit: boolean
  statusFetcher: ReturnType<typeof useFetcher>
  priorityFetcher: ReturnType<typeof useFetcher>
  categoryFetcher: ReturnType<typeof useFetcher>
  fractionFetcher: ReturnType<typeof useFetcher>
}) {
  const priorityCurrent =
    (priorityFetcher.formData?.get('value') as string) ?? ticket.priority ?? ''

  const statusItems = (Object.entries(statusLabels) as [Status, string][]).map(
    ([value, label]) => ({ label, value }),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalhes</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-4">
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

          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground text-sm">Fração</dt>
            <dd className="text-sm">
              {canEdit && orgFractions.length > 0 ? (
                <InlineFractionSelect
                  fractions={orgFractions}
                  defaultValue={ticket.fractionId}
                  fetcher={fractionFetcher}
                />
              ) : (
                ticket.fractionLabel || <span className="text-muted-foreground">&mdash;</span>
              )}
            </dd>
          </div>

          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground text-sm">Criado por</dt>
            <dd className="text-sm">{ticket.creatorName}</dd>
          </div>

          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground text-sm">Criado em</dt>
            <dd className="text-sm">{formatDate(ticket.createdAt)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}

function EditTicketDrawer({
  ticket,
  categories,
  orgFractions,
  open,
  onOpenChange,
}: {
  ticket: {
    title: string
    description: string | null
    category: string | null
    priority: 'urgent' | 'high' | 'medium' | 'low' | null
    fractionId: string | null
    private: boolean
  }
  categories: { key: string }[]
  orgFractions: { id: string; label: string }[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPopup>
        <DrawerHeader>
          <DrawerTitle>Editar ocorrência</DrawerTitle>
          <DrawerDescription>Altere os dados da ocorrência.</DrawerDescription>
        </DrawerHeader>
        <div className="px-6 pb-6">
          <Form method="post" className="grid gap-4" onSubmit={() => onOpenChange(false)}>
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

            {orgFractions.length > 0 && (
              <Field>
                <FieldLabel>Fração</FieldLabel>
                <Select
                  name="fractionId"
                  defaultValue={ticket.fractionId ?? ''}
                  items={orgFractions.map((f) => ({ label: f.label, value: f.id }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem fração" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sem fração</SelectItem>
                    {orgFractions.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <label htmlFor="edit-private" className="flex items-center gap-2">
              <Checkbox id="edit-private" name="private" defaultChecked={ticket.private} />
              <span className="text-sm">Marcar como privado</span>
            </label>

            <Button type="submit" className="mt-1">
              Guardar
            </Button>
          </Form>
        </div>
      </DrawerPopup>
    </Drawer>
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

function InlineFractionSelect({
  fractions: fractionsList,
  defaultValue,
  fetcher,
}: {
  fractions: { id: string; label: string }[]
  defaultValue: string | null
  fetcher: ReturnType<typeof useFetcher>
}) {
  const current = defaultValue ?? ''
  const items = fractionsList.map((f) => ({ label: f.label, value: f.id }))

  return (
    <Select
      defaultValue={current}
      onValueChange={(value) => {
        if (value === current) return
        const formData = new FormData()
        formData.set('intent', 'update-field')
        formData.set('field', 'fractionId')
        formData.set('value', value ?? '')
        fetcher.submit(formData, { method: 'post' })
      }}
      items={items}
    >
      <SelectTrigger className="h-10 w-auto min-w-32">
        <SelectValue placeholder="Sem fração" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">Sem fração</SelectItem>
        {fractionsList.map((f) => (
          <SelectItem key={f.id} value={f.id}>
            {f.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
