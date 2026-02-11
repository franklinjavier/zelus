import { describe, expect, it } from 'vitest'
import { formatCost, formatDate, formatShortDate, toInputDate, getInitials } from '../format'

describe('formatCost', () => {
  it('formats a valid cost string as EUR currency', () => {
    expect(formatCost('150.5')).toMatch(/150,50/)
  })

  it('returns null for null input', () => {
    expect(formatCost(null)).toBeNull()
  })

  it('returns null for non-numeric string', () => {
    expect(formatCost('abc')).toBeNull()
  })
})

describe('formatDate', () => {
  it('formats a date with long month in pt-PT', () => {
    const result = formatDate(new Date('2024-03-15'))
    expect(result).toContain('15')
    expect(result).toContain('2024')
  })

  it('accepts a string date', () => {
    const result = formatDate('2024-01-01')
    expect(result).toContain('2024')
  })
})

describe('formatShortDate', () => {
  it('returns DD/MM format', () => {
    expect(formatShortDate(new Date('2024-03-05'))).toBe('05/03')
  })
})

describe('toInputDate', () => {
  it('returns YYYY-MM-DD format', () => {
    expect(toInputDate('2024-03-15T12:00:00Z')).toBe('2024-03-15')
  })
})

describe('getInitials', () => {
  it('returns initials from first two words', () => {
    expect(getInitials('João Silva')).toBe('JS')
  })

  it('returns single initial for one word', () => {
    expect(getInitials('João')).toBe('J')
  })

  it('caps at two initials for three words', () => {
    expect(getInitials('Ana Maria Costa')).toBe('AM')
  })
})
