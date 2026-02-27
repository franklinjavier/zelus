export type ColumnMapping = {
  csvHeader: string
  ticketField: 'title' | 'description' | 'status' | 'category' | 'priority' | 'unmapped'
  confidence: number
}

const STATUS_MAP: Record<string, 'open' | 'in_progress' | 'resolved' | 'closed'> = {
  '': 'open',
  'em curso': 'in_progress',
  notificado: 'in_progress',
  resolvido: 'resolved',
  resolved: 'resolved',
  open: 'open',
  aberto: 'open',
  fechado: 'closed',
  closed: 'closed',
  in_progress: 'in_progress',
  'in progress': 'in_progress',
}

const PRIORITY_MAP: Record<string, 'urgent' | 'high' | 'medium' | 'low'> = {
  urgente: 'urgent',
  urgent: 'urgent',
  alta: 'high',
  high: 'high',
  média: 'medium',
  media: 'medium',
  medium: 'medium',
  baixa: 'low',
  low: 'low',
}

export function parseStatus(raw: string): 'open' | 'in_progress' | 'resolved' | 'closed' {
  return STATUS_MAP[raw.trim().toLowerCase()] ?? 'open'
}

export function parsePriority(raw: string): 'urgent' | 'high' | 'medium' | 'low' | null {
  return PRIORITY_MAP[raw.trim().toLowerCase()] ?? null
}
