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
