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

/** Get the Monday of the UTC week containing the given date (Mon=1, Sun=7 ISO style) */
function getMondayUTC(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay() // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(9, 0, 0, 0)
  return d
}

function daysInMonthUTC(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

function makeDateUTC(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 9, 0, 0, 0))
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
  // One-time event
  if (!recurrence) {
    return eventDate >= now ? eventDate : null
  }

  // Check endDate constraint early
  if (recurrence.endType === 'date') {
    const end = new Date(`${recurrence.endDate}T23:59:59.999Z`)
    if (now > end) return null
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
  const eventMonday = getMondayUTC(eventDate)
  const sortedDays = [...daysOfWeek].sort((a, b) => a - b)

  // Determine the effective start: max(eventDate, now)
  const effective = eventDate > now ? eventDate : now

  // Find the Monday of the effective date's week
  const effectiveMonday = getMondayUTC(effective)

  // Calculate weeks between event start Monday and effective Monday
  const msDiff = effectiveMonday.getTime() - eventMonday.getTime()
  const weeksDiff = Math.round(msDiff / (7 * 24 * 60 * 60 * 1000))

  // Find the nearest valid week >= effective that aligns with interval
  const remainder = ((weeksDiff % interval) + interval) % interval
  const weeksToAdd = remainder === 0 ? 0 : interval - remainder
  let currentWeekOffset = weeksDiff + weeksToAdd

  // Check this week and the next valid week
  for (let attempt = 0; attempt < 2; attempt++) {
    const weekMonday = new Date(eventMonday)
    weekMonday.setUTCDate(weekMonday.getUTCDate() + currentWeekOffset * 7)

    for (const dayOfWeek of sortedDays) {
      // dayOfWeek: 0=Sun, 1=Mon, ... 6=Sat
      const candidate = new Date(weekMonday)
      const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // offset from Monday
      candidate.setUTCDate(candidate.getUTCDate() + offset)
      candidate.setUTCHours(9, 0, 0, 0)

      if (candidate < eventDate) continue
      if (candidate < now) continue

      // Check end constraints
      if (rec.endType === 'date') {
        const end = new Date(`${rec.endDate}T23:59:59.999Z`)
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
  const eventMonday = getMondayUTC(eventDate)
  const sortedDays = [...daysOfWeek].sort((a, b) => a - b)

  let count = 0
  let weekOffset = 0

  // Iterate through valid weeks until we reach the candidate
  while (true) {
    const weekMonday = new Date(eventMonday)
    weekMonday.setUTCDate(weekMonday.getUTCDate() + weekOffset * 7)

    for (const dayOfWeek of sortedDays) {
      const occ = new Date(weekMonday)
      const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      occ.setUTCDate(occ.getUTCDate() + offset)
      occ.setUTCHours(9, 0, 0, 0)

      if (occ < eventDate) continue
      if (occ >= candidate) return count
      count++
    }

    weekOffset += interval
    // Safety: don't loop more than ~520 weeks (10 years)
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
  const eventYear = eventDate.getUTCFullYear()
  const eventMonth = eventDate.getUTCMonth()

  // Determine effective start
  const effective = eventDate > now ? eventDate : now
  const effYear = effective.getUTCFullYear()
  const effMonth = effective.getUTCMonth()

  // Calculate months from event start to effective
  const monthsDiff = (effYear - eventYear) * 12 + (effMonth - eventMonth)

  // Find nearest aligned month >= effective
  const remainder = ((monthsDiff % interval) + interval) % interval
  let monthOffset = monthsDiff + (remainder === 0 ? 0 : interval - remainder)

  // Try this month and the next valid month
  for (let attempt = 0; attempt < 2; attempt++) {
    const totalMonth = eventMonth + monthOffset
    const year = eventYear + Math.floor(totalMonth / 12)
    const month = totalMonth % 12

    const maxDay = daysInMonthUTC(year, month)
    const day = Math.min(dayOfMonth, maxDay)
    const candidate = makeDateUTC(year, month, day)

    if (candidate >= eventDate && candidate >= now) {
      // Check end constraints
      if (rec.endType === 'date') {
        const end = new Date(`${rec.endDate}T23:59:59.999Z`)
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
