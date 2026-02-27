import { useCallback, useEffect, useRef, useState } from 'react'
import { data, href, useFetcher } from 'react-router'
import { z } from 'zod'
import Papa from 'papaparse'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Upload04Icon,
  FileImportIcon,
  Tick02Icon,
  Cancel01Icon,
  AlertCircleIcon,
  ArrowLeft02Icon,
} from '@hugeicons/core-free-icons'

import type { Route } from './+types/import-tickets'
import { orgContext, userContext } from '~/lib/auth/context'
import { parseStatus, parsePriority, type ColumnMapping } from '~/lib/csv-import'
import { mapColumnsWithAI } from '~/lib/services/csv-import.server'
import { bulkCreateTickets } from '~/lib/services/tickets.server'
import { setToast } from '~/lib/toast.server'
import { BackButton } from '~/components/layout/back-button'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { Badge } from '~/components/ui/badge'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Importar Ocorrências — Zelus' }]
}

const importRowSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  status: z.string().default(''),
  category: z.string().default(''),
  priority: z.string().default(''),
  comment: z.string().default(''),
})

export async function action({ request, context }: Route.ActionArgs) {
  const { orgId } = context.get(orgContext)
  const user = context.get(userContext)
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'map-columns') {
    const headersRaw = formData.get('headers')
    if (typeof headersRaw !== 'string') {
      return data({ error: 'Headers em falta.' }, { status: 400 })
    }

    try {
      const headers = JSON.parse(headersRaw) as string[]
      const mappings = await mapColumnsWithAI(headers)
      return { mappings }
    } catch (e) {
      return data(
        { error: e instanceof Error ? e.message : 'Erro ao mapear colunas.' },
        { status: 500 },
      )
    }
  }

  if (intent === 'import') {
    const rowsRaw = formData.get('rows')
    if (typeof rowsRaw !== 'string') {
      return data({ error: 'Dados em falta.' }, { status: 400 })
    }

    try {
      const rawRows = JSON.parse(rowsRaw) as Array<Record<string, string>>
      const parsed = rawRows.map((r) => importRowSchema.parse(r))

      const tickets = parsed.map((r) => ({
        title: r.title,
        description: r.description,
        status: parseStatus(r.status),
        category: r.category || null,
        priority: parsePriority(r.priority),
        comment: r.comment || null,
      }))

      const results = await bulkCreateTickets(orgId, tickets, user.id)
      const created = results.filter((r) => r.ticketId).length
      const errors = results.filter((r) => r.error)

      return data(
        { created, errors, total: results.length },
        { headers: await setToast(`${created} ocorrências importadas com sucesso.`) },
      )
    } catch (e) {
      return data({ error: e instanceof Error ? e.message : 'Erro ao importar.' }, { status: 500 })
    }
  }

  return data({ error: 'Intent inválido.' }, { status: 400 })
}

// --- Ticket field options for the mapping dropdowns ---

const TICKET_FIELD_OPTIONS = [
  { label: 'Título', value: 'title' },
  { label: 'Descrição', value: 'description' },
  { label: 'Estado', value: 'status' },
  { label: 'Categoria', value: 'category' },
  { label: 'Prioridade', value: 'priority' },
  { label: '— Não mapear —', value: 'unmapped' },
]

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em Curso',
  resolved: 'Resolvido',
  closed: 'Fechado',
}

// --- Helpers ---

/**
 * Auto-detect the header row in a CSV. Skips junk rows (notes, URLs, mostly-empty).
 * A header row has 2+ non-empty short-text cells and no URLs.
 */
function detectHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i]
    const nonEmpty = row.filter((cell) => cell.trim() !== '')

    // Need at least 2 filled cells to be a header
    if (nonEmpty.length < 2) continue

    // Header cells should be short text, not URLs or long content
    const looksLikeHeaders = nonEmpty.every((cell) => cell.length < 80 && !cell.startsWith('http'))
    if (looksLikeHeaders) return i
  }

  return 0
}

// --- Component ---

type Step = 'upload' | 'mapping' | 'preview' | 'done'

export default function ImportTicketsPage({ actionData }: Route.ComponentProps) {
  const [step, setStep] = useState<Step>('upload')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [mappings, setMappings] = useState<Record<string, string>>({})
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState('')

  const mapFetcher = useFetcher<{ mappings?: ColumnMapping[]; error?: string }>()
  const importFetcher = useFetcher<{
    created?: number
    errors?: Array<{ row: number; error: string }>
    total?: number
    error?: string
  }>()

  const isMapping = mapFetcher.state !== 'idle'
  const isImporting = importFetcher.state !== 'idle'

  // Handle CSV file selection — parse without headers first, then auto-detect the header row
  const handleFile = useCallback(
    (file: File) => {
      setParseError('')
      setFileName(file.name)
      setMappings({})

      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          const rawRows = results.data as string[][]
          if (rawRows.length < 2) {
            setParseError('O ficheiro não contém dados suficientes.')
            return
          }

          // Auto-detect header row: first row with 2+ non-empty short text cells
          const headerIdx = detectHeaderRow(rawRows)
          const headerRow = rawRows[headerIdx]
          const dataRows = rawRows.slice(headerIdx + 1)

          // Filter out empty column names and build clean headers
          const headers = headerRow.map((h, i) => h.trim() || `Coluna ${i + 1}`)

          if (dataRows.length === 0) {
            setParseError('O ficheiro não contém dados após o cabeçalho.')
            return
          }

          // Convert data rows to objects keyed by header
          const rows = dataRows
            .filter((row) => row.some((cell) => cell.trim() !== ''))
            .map((row) => {
              const obj: Record<string, string> = {}
              for (let i = 0; i < headers.length; i++) {
                obj[headers[i]] = (row[i] ?? '').trim()
              }
              return obj
            })

          setCsvHeaders(headers)
          setCsvRows(rows)
          setStep('mapping')

          // Ask AI to map columns
          const formData = new FormData()
          formData.set('intent', 'map-columns')
          formData.set('headers', JSON.stringify(headers))
          mapFetcher.submit(formData, { method: 'post' })
        },
        error: () => {
          setParseError('Erro ao ler o ficheiro CSV.')
        },
      })
    },
    [mapFetcher],
  )

  // When AI mapping results arrive, populate the mapping state
  const mappingsAppliedRef = useRef(false)
  useEffect(() => {
    const aiMappings = mapFetcher.data?.mappings
    if (aiMappings && !mappingsAppliedRef.current) {
      mappingsAppliedRef.current = true
      const initial: Record<string, string> = {}
      for (const m of aiMappings) {
        initial[m.csvHeader] = m.ticketField
      }
      setMappings(initial)
    }
  }, [mapFetcher.data])

  // Reset the applied ref when a new file is uploaded
  useEffect(() => {
    if (step === 'upload') {
      mappingsAppliedRef.current = false
    }
  }, [step])

  // Update a single column mapping
  const updateMapping = (header: string, field: string) => {
    setMappings((prev) => ({ ...prev, [header]: field }))
  }

  // Build the preview rows from CSV data + mappings
  const previewRows = csvRows.map((row) => {
    const mapped: Record<string, string> = {
      title: '',
      description: '',
      status: '',
      category: '',
      priority: '',
      comment: '',
    }

    const unmappedParts: string[] = []

    for (const header of csvHeaders) {
      const field = mappings[header] ?? 'unmapped'
      const value = (row[header] ?? '').trim()

      if (!value) continue

      if (field === 'unmapped') {
        unmappedParts.push(`${header}: ${value}`)
      } else {
        mapped[field] = value
      }
    }

    if (unmappedParts.length > 0) {
      mapped.comment = unmappedParts.join('\n')
    }

    return mapped
  })

  const validRows = previewRows.filter((r) => r.title)
  const invalidRows = previewRows.filter((r) => !r.title)
  const hasTitleMapping = Object.values(mappings).includes('title')

  // Handle import submission
  const handleImport = () => {
    const formData = new FormData()
    formData.set('intent', 'import')
    formData.set('rows', JSON.stringify(validRows))
    importFetcher.submit(formData, { method: 'post' })
  }

  // Check import results
  useEffect(() => {
    if (importFetcher.data?.created != null && importFetcher.state === 'idle') {
      setStep('done')
    }
  }, [importFetcher.data, importFetcher.state])

  const reset = () => {
    setStep('upload')
    setCsvHeaders([])
    setCsvRows([])
    setMappings({})
    setFileName('')
    setParseError('')
  }

  return (
    <div>
      <BackButton to={href('/admin/dashboard')} />

      <h1 className="mt-3 text-lg font-semibold tracking-tight">Importar Ocorrências</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Importe ocorrências a partir de um ficheiro CSV exportado de uma folha de cálculo.
      </p>

      <div className="mt-6">
        {step === 'upload' && (
          <UploadStep onFile={handleFile} error={parseError} fileName={fileName} />
        )}

        {step === 'mapping' && (
          <MappingStep
            headers={csvHeaders}
            mappings={mappings}
            onUpdateMapping={updateMapping}
            onBack={reset}
            onNext={() => setStep('preview')}
            isLoading={isMapping}
            hasTitleMapping={hasTitleMapping}
            error={mapFetcher.data?.error}
          />
        )}

        {step === 'preview' && (
          <PreviewStep
            rows={previewRows}
            validCount={validRows.length}
            invalidCount={invalidRows.length}
            onBack={() => setStep('mapping')}
            onImport={handleImport}
            isImporting={isImporting}
          />
        )}

        {step === 'done' && (
          <DoneStep
            created={importFetcher.data?.created ?? 0}
            errors={importFetcher.data?.errors ?? []}
            total={importFetcher.data?.total ?? 0}
            onReset={reset}
          />
        )}
      </div>
    </div>
  )
}

// --- Step 1: Upload ---

function UploadStep({
  onFile,
  error,
  fileName,
}: {
  onFile: (file: File) => void
  error: string
  fileName: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFile(file)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Carregar ficheiro CSV</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
        >
          <HugeiconsIcon
            icon={Upload04Icon}
            size={32}
            strokeWidth={1.5}
            className="text-muted-foreground"
          />
          <div className="text-center">
            <p className="font-medium">Arraste um ficheiro CSV ou clique para selecionar</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Ficheiros .csv exportados do Excel ou Google Sheets
            </p>
          </div>
          {fileName && (
            <Badge variant="secondary" className="mt-2">
              {fileName}
            </Badge>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleChange}
            className="hidden"
          />
        </div>

        {error && (
          <div className="text-destructive mt-3 flex items-center gap-2 text-sm">
            <HugeiconsIcon icon={AlertCircleIcon} size={16} strokeWidth={2} />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// --- Step 2: Column Mapping ---

function MappingStep({
  headers,
  mappings,
  onUpdateMapping,
  onBack,
  onNext,
  isLoading,
  hasTitleMapping,
  error,
}: {
  headers: string[]
  mappings: Record<string, string>
  onUpdateMapping: (header: string, field: string) => void
  onBack: () => void
  onNext: () => void
  isLoading: boolean
  hasTitleMapping: boolean
  error?: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mapear colunas</CardTitle>
        <p className="text-muted-foreground text-sm">
          {isLoading
            ? 'A analisar colunas com IA…'
            : 'Verifique o mapeamento sugerido e ajuste se necessário.'}
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
            <span className="text-muted-foreground ml-3 text-sm">A mapear colunas…</span>
          </div>
        ) : (
          <>
            {error && (
              <div className="text-destructive mb-4 flex items-center gap-2 text-sm">
                <HugeiconsIcon icon={AlertCircleIcon} size={16} strokeWidth={2} />
                {error}
              </div>
            )}
            <div className="grid gap-3">
              {headers.map((header) => {
                const currentValue = mappings[header] ?? 'unmapped'
                const items = TICKET_FIELD_OPTIONS.map((o) => ({
                  label: o.label,
                  value: o.value,
                }))

                return (
                  <div key={header} className="flex items-center gap-3">
                    <span className="w-48 shrink-0 truncate text-sm font-medium">{header}</span>
                    <HugeiconsIcon
                      icon={ArrowLeft02Icon}
                      size={16}
                      strokeWidth={2}
                      className="text-muted-foreground shrink-0 rotate-180"
                    />
                    <Select
                      key={`${header}-${currentValue}`}
                      defaultValue={currentValue}
                      onValueChange={(val) => onUpdateMapping(header, val as string)}
                      items={items}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {items.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              })}
            </div>

            {!hasTitleMapping && (
              <div className="text-destructive mt-4 flex items-center gap-2 text-sm">
                <HugeiconsIcon icon={AlertCircleIcon} size={16} strokeWidth={2} />É necessário
                mapear pelo menos uma coluna para &quot;Título&quot;.
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={onBack}>
                Voltar
              </Button>
              <Button onClick={onNext} disabled={!hasTitleMapping}>
                Pré-visualizar
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// --- Step 3: Preview ---

function PreviewStep({
  rows,
  validCount,
  invalidCount,
  onBack,
  onImport,
  isImporting,
}: {
  rows: Array<Record<string, string>>
  validCount: number
  invalidCount: number
  onBack: () => void
  onImport: () => void
  isImporting: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pré-visualização</CardTitle>
        <p className="text-muted-foreground text-sm">
          {validCount} ocorrências prontas para importar
          {invalidCount > 0 && (
            <span className="text-destructive"> · {invalidCount} sem título (serão ignoradas)</span>
          )}
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Notas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const status = parseStatus(row.status)
              const hasTitle = !!row.title

              return (
                <TableRow key={i} className={hasTitle ? '' : 'opacity-50'}>
                  <TableCell className="max-w-64 truncate font-medium">
                    {row.title || <span className="text-destructive italic">Sem título</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{STATUS_LABELS[status] ?? status}</Badge>
                  </TableCell>
                  <TableCell className="max-w-80 truncate">{row.description}</TableCell>
                  <TableCell className="text-muted-foreground max-w-60 truncate">
                    {row.comment}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={onBack} disabled={isImporting}>
            Voltar
          </Button>
          <Button onClick={onImport} disabled={isImporting || validCount === 0}>
            <HugeiconsIcon
              icon={FileImportIcon}
              size={16}
              strokeWidth={2}
              data-icon="inline-start"
            />
            {isImporting ? 'A importar…' : `Importar ${validCount} ocorrências`}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// --- Step 4: Done ---

function DoneStep({
  created,
  errors,
  total,
  onReset,
}: {
  created: number
  errors: Array<{ row: number; error: string }>
  total: number
  onReset: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Importação concluída</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full">
              <HugeiconsIcon icon={Tick02Icon} size={20} strokeWidth={2} className="text-primary" />
            </div>
            <div>
              <p className="font-medium">{created} ocorrências importadas</p>
              {errors.length > 0 && (
                <p className="text-destructive text-sm">{errors.length} com erro</p>
              )}
            </div>
          </div>

          {errors.length > 0 && (
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium">Erros:</p>
              {errors.map((err, i) => (
                <p key={i} className="text-destructive text-sm">
                  Linha {err.row + 1}: {err.error}
                </p>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={onReset}>
              Importar outro ficheiro
            </Button>
            <Button render={<a href={href('/tickets')} />} nativeButton={false}>
              Ver ocorrências
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
