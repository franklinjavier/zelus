import { z } from 'zod'

import type { Recurrence } from '~/lib/announcements/recurrence'

export const announcementSchema = z.object({
  title: z.string().min(1, 'Titulo e obrigatorio'),
  description: z.string().min(1, 'Descricao e obrigatoria'),
  eventDate: z.string().min(1, 'Data e obrigatoria'),
  eventTime: z.string().optional(),
  recurrenceType: z.enum(['none', 'custom']).default('none'),
  frequency: z.enum(['weekly', 'monthly']).optional(),
  interval: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().min(1).optional()),
  daysOfWeek: z.string().optional(),
  dayOfMonth: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.coerce.number().min(1).max(31).optional(),
  ),
  endType: z.enum(['never', 'date', 'count']).optional(),
  endDate: z.string().optional(),
  endCount: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().min(1).optional()),
  notify: z.string().optional(),
})

export type AnnouncementFields = z.infer<typeof announcementSchema>

export function buildRecurrence(fields: AnnouncementFields): Recurrence | null {
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

export function parseEventDate(eventDate: string, eventTime?: string): Date {
  return eventTime ? new Date(`${eventDate}T${eventTime}:00`) : new Date(`${eventDate}T00:00:00`)
}
