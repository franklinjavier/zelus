import {
  startOfDay,
  startOfWeek,
  addDays,
  addWeeks,
  getDaysInMonth,
  differenceInWeeks,
  differenceInMonths,
} from 'date-fns'
import { UTCDate } from '@date-fns/utc'

export type Recurrence =
  | {
      frequency: 'weekly'
      interval: number
      daysOfWeek: number[]
      endType: 'never'
    }
  | {
      frequency: 'weekly'
      interval: number
      daysOfWeek: number[]
      endType: 'date'
      endDate: string
    }
  | {
      frequency: 'weekly'
      interval: number
      daysOfWeek: number[]
      endType: 'count'
      endCount: number
    }
  | {
      frequency: 'monthly'
      interval: number
      dayOfMonth: number
      endType: 'never'
    }
  | {
      frequency: 'monthly'
      interval: number
      dayOfMonth: number
      endType: 'date'
      endDate: string
    }
  | {
      frequency: 'monthly'
      interval: number
      dayOfMonth: number
      endType: 'count'
      endCount: number
    }

export function getFrequencyLabel(recurrence: Recurrence | null): string | null {
  if (!recurrence) return null
  if (recurrence.frequency === 'weekly') {
    return recurrence.interval === 1 ? 'Semanal' : `A cada ${recurrence.interval} semanas`
  }
  return recurrence.interval === 1 ? 'Mensal' : `A cada ${recurrence.interval} meses`
}

/** Normalize a Date to a UTCDate at 09:00 for consistent comparison */
function toUTC9(date: Date): UTCDate {
  const d = startOfDay(new UTCDate(date))
  return new UTCDate(d.getTime() + 9 * 60 * 60 * 1000)
}

/**
 * Calculate the next occurrence date of an announcement.
 *
 * @param eventDate - The initial event date
 * @param recurrence - Recurrence rules, or null for one-time events
 * @param now - The current date/time reference point
 * @returns The next occurrence date, or null if no future occurrence exists
 */
export function getNextOccurrence(
  eventDate: Date,
  recurrence: Recurrence | null,
  now: Date,
): Date | null {
  const today = startOfDay(new UTCDate(now))

  // One-time event — show on the event day, hide after
  if (!recurrence) {
    const eventDay = startOfDay(new UTCDate(eventDate))
    return eventDay >= today ? eventDate : null
  }

  // Check endDate constraint early
  if (recurrence.endType === 'date') {
    const end = new UTCDate(`${recurrence.endDate}T23:59:59.999Z`)
    if (new UTCDate(now) > end) return null
  }

  if (recurrence.frequency === 'weekly') {
    return getNextWeekly(eventDate, recurrence, now)
  }

  return getNextMonthly(eventDate, recurrence, now)
}

function getNextWeekly(
  eventDate: Date,
  rec: Extract<Recurrence, { frequency: 'weekly' }>,
  now: Date,
): Date | null {
  const { interval, daysOfWeek } = rec
  const eventMonday = startOfWeek(new UTCDate(eventDate), { weekStartsOn: 1 })
  const sortedDays = [...daysOfWeek].sort((a, b) => a - b)

  const effective = eventDate > now ? new UTCDate(eventDate) : new UTCDate(now)
  const effectiveMonday = startOfWeek(effective, { weekStartsOn: 1 })

  const weeksDiff = differenceInWeeks(effectiveMonday, eventMonday)

  const remainder = ((weeksDiff % interval) + interval) % interval
  const weeksToAdd = remainder === 0 ? 0 : interval - remainder
  let currentWeekOffset = weeksDiff + weeksToAdd

  for (let attempt = 0; attempt < 2; attempt++) {
    const weekMonday = addWeeks(eventMonday, currentWeekOffset)

    for (const dayOfWeek of sortedDays) {
      // dayOfWeek: 0=Sun, 1=Mon, ... 6=Sat
      const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const candidate = toUTC9(addDays(weekMonday, offset))

      if (candidate < new UTCDate(eventDate)) continue
      if (candidate < new UTCDate(now)) continue

      if (rec.endType === 'date') {
        const end = new UTCDate(`${rec.endDate}T23:59:59.999Z`)
        if (candidate > end) return null
      }

      if (rec.endType === 'count') {
        const count = countWeeklyOccurrencesBefore(eventDate, rec, candidate)
        if (count >= rec.endCount) return null
      }

      return candidate
    }

    currentWeekOffset += interval
  }

  return null
}

/** Count how many weekly occurrences happened strictly before the candidate date */
function countWeeklyOccurrencesBefore(
  eventDate: Date,
  rec: Extract<Recurrence, { frequency: 'weekly' }>,
  candidate: Date,
): number {
  const { interval, daysOfWeek } = rec
  const eventMonday = startOfWeek(new UTCDate(eventDate), { weekStartsOn: 1 })
  const sortedDays = [...daysOfWeek].sort((a, b) => a - b)

  let count = 0
  let weekOffset = 0

  while (true) {
    const weekMonday = addWeeks(eventMonday, weekOffset)

    for (const dayOfWeek of sortedDays) {
      const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const occ = toUTC9(addDays(weekMonday, offset))

      if (occ < new UTCDate(eventDate)) continue
      if (occ >= new UTCDate(candidate)) return count
      count++
    }

    weekOffset += interval
    if (weekOffset > 520) break
  }

  return count
}

function getNextMonthly(
  eventDate: Date,
  rec: Extract<Recurrence, { frequency: 'monthly' }>,
  now: Date,
): Date | null {
  const { interval, dayOfMonth } = rec
  const utcEvent = new UTCDate(eventDate)
  const utcNow = new UTCDate(now)
  const eventYear = utcEvent.getFullYear()
  const eventMonth = utcEvent.getMonth()

  const effective = utcEvent > utcNow ? utcEvent : utcNow

  const monthsDiff = differenceInMonths(
    new UTCDate(effective.getFullYear(), effective.getMonth(), 1),
    new UTCDate(eventYear, eventMonth, 1),
  )

  const remainder = ((monthsDiff % interval) + interval) % interval
  let monthOffset = monthsDiff + (remainder === 0 ? 0 : interval - remainder)

  for (let attempt = 0; attempt < 2; attempt++) {
    const totalMonth = eventMonth + monthOffset
    const year = eventYear + Math.floor(totalMonth / 12)
    const month = totalMonth % 12

    const maxDay = getDaysInMonth(new UTCDate(year, month, 1))
    const day = Math.min(dayOfMonth, maxDay)
    const candidate = new UTCDate(year, month, day, 9, 0, 0, 0)

    if (candidate >= utcEvent && candidate >= utcNow) {
      if (rec.endType === 'date') {
        const end = new UTCDate(`${rec.endDate}T23:59:59.999Z`)
        if (candidate > end) return null
      }

      if (rec.endType === 'count') {
        const count = monthOffset / interval
        if (count >= rec.endCount) return null
      }

      return candidate
    }

    monthOffset += interval
  }

  return null
}
