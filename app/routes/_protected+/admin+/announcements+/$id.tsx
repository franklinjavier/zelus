import { redirect, href } from 'react-router'
import { z } from 'zod'

import type { Route } from './+types/$id'
import { orgContext, userContext } from '~/lib/auth/context'
import { getAnnouncement, updateAnnouncement } from '~/lib/services/announcements.server'
import type { Recurrence } from '~/lib/announcements/recurrence'
import { toInputDate } from '~/lib/format'
import { setToast } from '~/lib/toast.server'
import { AnnouncementForm } from './new'

const updateSchema = z.object({
  title: z.string().min(1, 'Titulo e obrigatorio'),
  description: z.string().min(1, 'Descricao e obrigatoria'),
  eventDate: z.string().min(1, 'Data e obrigatoria'),
  eventTime: z.string().min(1, 'Hora e obrigatoria'),
  recurrenceType: z.enum(['none', 'custom']).default('none'),
  frequency: z.enum(['weekly', 'monthly']).optional(),
  interval: z.coerce.number().min(1).optional(),
  daysOfWeek: z.string().optional(),
  dayOfMonth: z.coerce.number().min(1).max(31).optional(),
  endType: z.enum(['never', 'date', 'count']).optional(),
  endDate: z.string().optional(),
  endCount: z.coerce.number().min(1).optional(),
})

function buildRecurrence(fields: z.infer<typeof updateSchema>): Recurrence | null {
  if (fields.recurrenceType !== 'custom') return null

  const frequency = fields.frequency ?? 'weekly'
  const interval = fields.interval ?? 1
  const endType = fields.endType ?? 'never'

  if (frequency === 'weekly') {
    const daysOfWeek = fields.daysOfWeek
      ? fields.daysOfWeek
          .split(',')
          .map((d) => parseInt(d.trim(), 10))
          .filter((n) => !isNaN(n))
      : [5]

    const base = { frequency: 'weekly' as const, interval, daysOfWeek }

    if (endType === 'date' && fields.endDate) {
      return { ...base, endType: 'date', endDate: fields.endDate }
    }
    if (endType === 'count' && fields.endCount) {
      return { ...base, endType: 'count', endCount: fields.endCount }
    }
    return { ...base, endType: 'never' }
  }

  const dayOfMonth = fields.dayOfMonth ?? 1
  const base = { frequency: 'monthly' as const, interval, dayOfMonth }

  if (endType === 'date' && fields.endDate) {
    return { ...base, endType: 'date', endDate: fields.endDate }
  }
  if (endType === 'count' && fields.endCount) {
    return { ...base, endType: 'count', endCount: fields.endCount }
  }
  return { ...base, endType: 'never' }
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const announcement = await getAnnouncement(orgId, params.id)
  if (!announcement) throw new Response('Not Found', { status: 404 })

  const recurrence = announcement.recurrence as Recurrence | null
  const hours = String(announcement.eventDate.getHours()).padStart(2, '0')
  const minutes = String(announcement.eventDate.getMinutes()).padStart(2, '0')
  const eventTime = `${hours}:${minutes}`

  let defaultValues: Record<string, unknown> = {
    title: announcement.title,
    description: announcement.description,
    eventDate: toInputDate(announcement.eventDate),
    eventTime,
    recurrenceType: recurrence ? 'custom' : 'none',
  }

  if (recurrence) {
    defaultValues.frequency = recurrence.frequency
    defaultValues.interval = recurrence.interval
    defaultValues.endType = recurrence.endType

    if (recurrence.frequency === 'weekly') {
      defaultValues.daysOfWeek = recurrence.daysOfWeek.join(',')
    } else {
      defaultValues.dayOfMonth = recurrence.dayOfMonth
    }

    if (recurrence.endType === 'date') {
      defaultValues.endDate = recurrence.endDate
    }
    if (recurrence.endType === 'count') {
      defaultValues.endCount = recurrence.endCount
    }
  }

  return { defaultValues }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { orgId } = context.get(orgContext)
  const user = context.get(userContext)
  const formData = await request.formData()
  const fields = Object.fromEntries(formData)

  const parsed = updateSchema.safeParse(fields)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Dados invalidos.'
    return { error: msg }
  }

  const { title, description, eventDate, eventTime } = parsed.data
  const dateTime = new Date(`${eventDate}T${eventTime}:00`)
  const recurrence = buildRecurrence(parsed.data)

  await updateAnnouncement(
    orgId,
    params.id,
    { title, description, eventDate: dateTime, recurrence },
    user.id,
  )

  return redirect(href('/admin/announcements'), {
    headers: await setToast('Aviso atualizado.'),
  })
}

export default function EditAnnouncementPage({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <AnnouncementForm
      defaultValues={
        loaderData.defaultValues as Parameters<typeof AnnouncementForm>[0]['defaultValues']
      }
      submitLabel="Guardar alteracoes"
      error={actionData && 'error' in actionData ? actionData.error : undefined}
    />
  )
}
