export function formatCost(cost: string | null): string | null {
  if (!cost) return null
  const num = parseFloat(cost)
  if (isNaN(num)) return null
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(num)
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

export function toInputDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().split('T')[0]
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

/**
 * Format a phone number for display.
 * Handles Portuguese numbers (9 digits) with optional +351 prefix.
 * Examples: "912345678" → "912 345 678", "+351912345678" → "+351 912 345 678"
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')

  // Portuguese number with country code (351 + 9 digits)
  if (digits.length === 12 && digits.startsWith('351')) {
    const local = digits.slice(3)
    return `+351 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
  }

  // 9-digit Portuguese number
  if (digits.length === 9) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
  }

  // Other international numbers — just return cleaned with spaces every 3
  if (digits.length > 9 && phone.startsWith('+')) {
    // Keep the + prefix and country code, format the rest
    const match = phone.match(/^\+(\d{1,3})/)
    if (match) {
      const cc = match[1]
      const rest = digits.slice(cc.length)
      return `+${cc} ${rest.replace(/(\d{3})(?=\d)/g, '$1 ')}`.trim()
    }
  }

  return phone
}

export function formatRelativeTime(date: Date | string): string {
  const now = Date.now()
  const then = (typeof date === 'string' ? new Date(date) : date).getTime()
  const diffMs = now - then

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)

  if (seconds < 60) return 'agora'
  if (minutes === 1) return 'há 1 minuto'
  if (minutes < 60) return `há ${minutes} minutos`
  if (hours === 1) return 'há 1 hora'
  if (hours < 24) return `há ${hours} horas`
  if (days === 1) return 'há 1 dia'
  if (days < 7) return `há ${days} dias`
  if (weeks === 1) return 'há 1 semana'
  if (weeks < 4) return `há ${weeks} semanas`
  if (months === 1) return 'há 1 mês'
  return `há ${months} meses`
}
