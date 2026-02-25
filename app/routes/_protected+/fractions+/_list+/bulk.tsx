import { useState } from 'react'
import { data, Form, href, redirect, useNavigation } from 'react-router'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import type { Route } from './+types/bulk'
import { orgContext, userContext } from '~/lib/auth/context'
import { createFraction } from '~/lib/services/fractions'
import { generateFractionLabels } from '~/lib/fractions-generator'
import { setToast } from '~/lib/toast.server'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Field, FieldLabel } from '~/components/ui/field'
import { ErrorBanner } from '~/components/layout/feedback'

export async function action({ request, context }: Route.ActionArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  const user = context.get(userContext)

  if (effectiveRole !== 'org_admin') {
    throw new Response('Forbidden', { status: 403 })
  }

  const formData = await request.formData()
  const labels = formData.getAll('label') as string[]
  const trimmed = labels.map((l) => l.trim()).filter(Boolean)

  if (trimmed.length === 0) {
    return data({ error: 'Nenhuma fração para criar.' }, { status: 400 })
  }

  let created = 0
  let skipped = 0

  for (const label of trimmed) {
    try {
      await createFraction(orgId, { label }, user.id)
      created++
    } catch (e) {
      if (e instanceof Error && e.message === 'Já existe uma fração com este nome.') {
        skipped++
      } else {
        throw e
      }
    }
  }

  const message =
    skipped > 0
      ? `${created} ${created === 1 ? 'fração criada' : 'frações criadas'}. ${skipped} já existiam e foram ignoradas.`
      : `${created} ${created === 1 ? 'fração criada' : 'frações criadas'}.`

  const variant = skipped > 0 ? 'warning' : 'success'
  throw redirect(href('/fractions'), { headers: await setToast(message, variant) })
}

const PRESET_POSITIONS = ['Esq', 'Dir', 'Frente', 'Fundo']

export default function BulkFractionsDrawer({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'

  const [floorFrom, setFloorFrom] = useState(1)
  const [floorTo, setFloorTo] = useState(5)
  const [includeRC, setIncludeRC] = useState(false)
  const [positions, setPositions] = useState<string[]>(['Esq', 'Dir'])
  const [customPosition, setCustomPosition] = useState('')
  const [suffix, setSuffix] = useState('')

  const preview = generateFractionLabels({ floorFrom, floorTo, includeRC, positions, suffix })
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const visible = preview.filter((l) => !removed.has(l))

  const togglePosition = (pos: string) => {
    setPositions((prev) => (prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]))
    setRemoved(new Set())
  }

  const addCustomPosition = () => {
    const pos = customPosition.trim()
    if (pos && !positions.includes(pos)) {
      setPositions((prev) => [...prev, pos])
      setRemoved(new Set())
    }
    setCustomPosition('')
  }

  const removeLabel = (label: string) => {
    setRemoved((prev) => new Set([...prev, label]))
  }

  return (
    <div className="px-6 pb-6">
      {actionData && 'error' in actionData && (
        <ErrorBanner className="mb-4">{actionData.error}</ErrorBanner>
      )}

      <div className="grid gap-4">
        {/* Floor range */}
        <div className="flex gap-3">
          <Field className="flex-1">
            <FieldLabel htmlFor="floor-from">Andar inicial</FieldLabel>
            <Input
              id="floor-from"
              type="number"
              min={0}
              max={100}
              step={1}
              value={floorFrom}
              onChange={(e) => {
                setFloorFrom(Number(e.target.value))
                setRemoved(new Set())
              }}
            />
          </Field>
          <Field className="flex-1">
            <FieldLabel htmlFor="floor-to">Andar final</FieldLabel>
            <Input
              id="floor-to"
              type="number"
              min={0}
              max={100}
              step={1}
              value={floorTo}
              onChange={(e) => {
                setFloorTo(Number(e.target.value))
                setRemoved(new Set())
              }}
            />
          </Field>
        </div>

        {/* RC checkbox */}
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeRC}
            onChange={(e) => {
              setIncludeRC(e.target.checked)
              setRemoved(new Set())
            }}
            className="h-4 w-4 rounded"
          />
          Incluir rés-do-chão (RC)
        </label>

        {/* Positions */}
        <Field>
          <FieldLabel>Posições</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {PRESET_POSITIONS.map((pos) => (
              <button
                key={pos}
                type="button"
                aria-pressed={positions.includes(pos)}
                onClick={() => togglePosition(pos)}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  positions.includes(pos)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-foreground'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              placeholder="Posição personalizada"
              value={customPosition}
              onChange={(e) => setCustomPosition(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCustomPosition()
                }
              }}
              className="flex-1"
            />
            <Button type="button" variant="outline" onClick={addCustomPosition}>
              Adicionar
            </Button>
          </div>
          {positions.filter((p) => !PRESET_POSITIONS.includes(p)).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {positions
                .filter((p) => !PRESET_POSITIONS.includes(p))
                .map((pos) => (
                  <span
                    key={pos}
                    className="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm"
                  >
                    {pos}
                    <button
                      type="button"
                      aria-label={`Remover posição ${pos}`}
                      onClick={() => togglePosition(pos)}
                      className="ml-1 flex size-5 items-center justify-center opacity-70 hover:opacity-100"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} size={12} />
                    </button>
                  </span>
                ))}
            </div>
          )}
        </Field>

        {/* Suffix */}
        <Field>
          <FieldLabel htmlFor="suffix">Tipo / sufixo (opcional)</FieldLabel>
          <Input
            id="suffix"
            placeholder="Ex: T3, T2, Garagem"
            value={suffix}
            onChange={(e) => {
              setSuffix(e.target.value)
              setRemoved(new Set())
            }}
          />
        </Field>

        {/* Preview */}
        {visible.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-2 text-sm">
              Pré-visualização — {visible.length} {visible.length === 1 ? 'fração' : 'frações'}
            </p>
            <div className="border-border max-h-40 overflow-y-auto rounded-xl border p-3">
              <div className="flex flex-wrap gap-2">
                {visible.map((label) => (
                  <span
                    key={label}
                    className="bg-muted inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm"
                  >
                    {label}
                    <button
                      type="button"
                      aria-label={`Remover ${label}`}
                      onClick={() => removeLabel(label)}
                      className="text-muted-foreground hover:text-foreground ml-1 flex size-5 items-center justify-center"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Hidden inputs + submit */}
        <Form method="post">
          {visible.map((label) => (
            <input key={label} type="hidden" name="label" value={label} />
          ))}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isSubmitting || visible.length === 0}
          >
            {isSubmitting
              ? 'A criar…'
              : visible.length > 0
                ? `Criar ${visible.length} ${visible.length === 1 ? 'fração' : 'frações'}`
                : 'Criar frações'}
          </Button>
        </Form>
      </div>
    </div>
  )
}
