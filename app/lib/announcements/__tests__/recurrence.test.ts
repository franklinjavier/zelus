import { describe, it, expect } from 'vitest'
import { getNextOccurrence, type Recurrence } from '../recurrence'

describe('getNextOccurrence', () => {
  const d = (s: string) => new Date(`${s}T09:00:00.000Z`)

  it('returns eventDate for one-time future event', () => {
    const result = getNextOccurrence(d('2026-04-01'), null, d('2026-03-01'))
    expect(result).toEqual(d('2026-04-01'))
  })

  it('returns null for one-time past event', () => {
    const result = getNextOccurrence(d('2026-02-01'), null, d('2026-03-01'))
    expect(result).toBeNull()
  })

  it('returns next weekly occurrence — same day of week in future', () => {
    const rec: Recurrence = {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [5],
      endType: 'never',
    }
    const result = getNextOccurrence(d('2026-03-06'), rec, d('2026-03-11'))
    expect(result).toEqual(d('2026-03-13'))
  })

  it('returns today if today matches a recurring day', () => {
    const rec: Recurrence = {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [3],
      endType: 'never',
    }
    const result = getNextOccurrence(d('2026-03-04'), rec, d('2026-03-11'))
    expect(result).toEqual(d('2026-03-11'))
  })

  it('handles biweekly recurrence', () => {
    const rec: Recurrence = {
      frequency: 'weekly',
      interval: 2,
      daysOfWeek: [5],
      endType: 'never',
    }
    const result = getNextOccurrence(d('2026-03-06'), rec, d('2026-03-07'))
    expect(result).toEqual(d('2026-03-20'))
  })

  it('returns null when endDate has passed', () => {
    const rec: Recurrence = {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [5],
      endType: 'date',
      endDate: '2026-03-01',
    }
    const result = getNextOccurrence(d('2026-02-01'), rec, d('2026-03-05'))
    expect(result).toBeNull()
  })

  it('returns null when endCount is exhausted', () => {
    const rec: Recurrence = {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [5],
      endType: 'count',
      endCount: 2,
    }
    const result = getNextOccurrence(d('2026-03-06'), rec, d('2026-03-14'))
    expect(result).toBeNull()
  })

  it('handles monthly recurrence on specific day', () => {
    const rec: Recurrence = {
      frequency: 'monthly',
      interval: 1,
      dayOfMonth: 15,
      endType: 'never',
    }
    const result = getNextOccurrence(d('2026-01-15'), rec, d('2026-03-20'))
    expect(result).toEqual(d('2026-04-15'))
  })

  it('returns current month if day has not passed yet', () => {
    const rec: Recurrence = {
      frequency: 'monthly',
      interval: 1,
      dayOfMonth: 15,
      endType: 'never',
    }
    const result = getNextOccurrence(d('2026-01-15'), rec, d('2026-03-10'))
    expect(result).toEqual(d('2026-03-15'))
  })

  it('does not return occurrence before eventDate', () => {
    const rec: Recurrence = {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [1],
      endType: 'never',
    }
    const result = getNextOccurrence(d('2026-03-11'), rec, d('2026-03-09'))
    expect(result).toEqual(d('2026-03-16'))
  })
})
