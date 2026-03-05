import { redirect, href } from 'react-router'

import type { Route } from './+types/$id'
import { orgContext, userContext } from '~/lib/auth/context'
import { getAnnouncement, updateAnnouncement } from '~/lib/services/announcements.server'
import type { Recurrence } from '~/lib/announcements/recurrence'
import { toInputDate } from '~/lib/format'
import { setToast } from '~/lib/toast.server'
import { AnnouncementForm } from './new'
import { announcementSchema, buildRecurrence, parseEventDate } from './_modules/schema'

export async function loader({ params, context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const announcement = await getAnnouncement(orgId, params.id)
  if (!announcement) throw new Response('Not Found', { status: 404 })

  const recurrence = announcement.recurrence as Recurrence | null
  const h = announcement.eventDate.getHours()
  const m = announcement.eventDate.getMinutes()
  const eventTime =
    h === 0 && m === 0 ? undefined : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

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

  const parsed = announcementSchema.safeParse(fields)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Dados invalidos.'
    return { error: msg }
  }

  const { title, description, eventDate, eventTime } = parsed.data
  const dateTime = parseEventDate(eventDate, eventTime)
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
