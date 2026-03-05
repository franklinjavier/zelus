import { useState } from 'react'
import { Form, redirect, href } from 'react-router'

import type { Route } from './+types/new'
import { orgContext, userContext } from '~/lib/auth/context'
import { createAnnouncement, broadcastAnnouncement } from '~/lib/services/announcements.server'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { Checkbox } from '~/components/ui/checkbox'
import { Field, FieldLabel } from '~/components/ui/field'
import { ErrorBanner } from '~/components/layout/feedback'
import { setToast } from '~/lib/toast.server'
import { announcementSchema, buildRecurrence, parseEventDate } from './_modules/schema'

export async function action({ request, context }: Route.ActionArgs) {
  const { orgId, orgName } = context.get(orgContext)
  const user = context.get(userContext)
  const formData = await request.formData()
  const fields = Object.fromEntries(formData)

  const parsed = announcementSchema.safeParse(fields)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Dados invalidos.'
    return { error: msg }
  }

  const { title, description, eventDate, eventTime } = parsed.data
  const dateTime = parseEventDate(eventDate, eventTime)
  const recurrence = buildRecurrence(parsed.data)
  const notify = parsed.data.notify === 'on'

  const announcement = await createAnnouncement(
    orgId,
    { title, description, eventDate: dateTime, recurrence },
    user.id,
  )

  if (notify) {
    broadcastAnnouncement(orgId, orgName, announcement, user.id).catch(console.error)
  }

  return redirect(href('/admin/announcements'), {
    headers: await setToast('Aviso criado.'),
  })
}

export type AnnouncementFormProps = {
  defaultValues?: {
    title?: string
    description?: string
    eventDate?: string
    eventTime?: string
    recurrenceType?: 'none' | 'custom'
    frequency?: 'weekly' | 'monthly'
    interval?: number
    daysOfWeek?: string
    dayOfMonth?: number
    endType?: 'never' | 'date' | 'count'
    endDate?: string
    endCount?: number
  }
  submitLabel: string
  showNotify?: boolean
  error?: string
}

const DAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

const selectClassName =
  'border-input bg-background ring-foreground/10 h-10 w-full rounded-4xl px-3 text-sm ring-1'

export function AnnouncementForm({
  defaultValues = {},
  submitLabel,
  showNotify = false,
  error,
}: AnnouncementFormProps) {
  const [recurrenceType, setRecurrenceType] = useState(defaultValues.recurrenceType ?? 'none')
  const [frequency, setFrequency] = useState(defaultValues.frequency ?? 'weekly')
  const [selectedDays, setSelectedDays] = useState<number[]>(
    defaultValues.daysOfWeek ? defaultValues.daysOfWeek.split(',').map(Number) : [],
  )

  return (
    <div className="px-6 pb-6">
      {error && <ErrorBanner className="mb-3">{error}</ErrorBanner>}

      <Form method="post" className="grid gap-3">
        <Field>
          <FieldLabel htmlFor="ann-title">
            Titulo <span className="text-destructive">*</span>
          </FieldLabel>
          <Input
            id="ann-title"
            name="title"
            type="text"
            defaultValue={defaultValues.title}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="ann-desc">
            Descricao <span className="text-destructive">*</span>
          </FieldLabel>
          <Textarea
            id="ann-desc"
            name="description"
            defaultValue={defaultValues.description}
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="ann-date">
              Data <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="ann-date"
              name="eventDate"
              type="date"
              defaultValue={defaultValues.eventDate}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="ann-time">Hora</FieldLabel>
            <Input
              id="ann-time"
              name="eventTime"
              type="time"
              defaultValue={defaultValues.eventTime}
              placeholder="Opcional"
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="ann-recurrence">Recorrencia</FieldLabel>
          <select
            id="ann-recurrence"
            name="recurrenceType"
            className={selectClassName}
            value={recurrenceType}
            onChange={(e) => setRecurrenceType(e.target.value as 'none' | 'custom')}
          >
            <option value="none">Nao repete</option>
            <option value="custom">Personalizado</option>
          </select>
        </Field>

        {recurrenceType === 'custom' && (
          <div className="ring-foreground/5 grid gap-3 rounded-2xl p-3 ring-1">
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="ann-interval">Intervalo</FieldLabel>
                <Input
                  id="ann-interval"
                  name="interval"
                  type="number"
                  min={1}
                  defaultValue={defaultValues.interval ?? 1}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="ann-frequency">Frequencia</FieldLabel>
                <select
                  id="ann-frequency"
                  name="frequency"
                  className={selectClassName}
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as 'weekly' | 'monthly')}
                >
                  <option value="weekly">Semana(s)</option>
                  <option value="monthly">Mes(es)</option>
                </select>
              </Field>
            </div>

            {frequency === 'weekly' && (
              <Field>
                <FieldLabel>Dias da semana</FieldLabel>
                <input type="hidden" name="daysOfWeek" value={selectedDays.join(',')} />
                <div className="flex gap-1.5">
                  {DAY_LABELS.map((label, i) => {
                    const active = selectedDays.includes(i)
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() =>
                          setSelectedDays((prev) =>
                            active ? prev.filter((d) => d !== i) : [...prev, i],
                          )
                        }
                        className={`flex size-9 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                          active
                            ? 'bg-primary text-primary-foreground'
                            : 'ring-foreground/10 bg-background hover:bg-accent ring-1'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </Field>
            )}

            {frequency === 'monthly' && (
              <Field>
                <FieldLabel htmlFor="ann-dom">Dia do mes</FieldLabel>
                <Input
                  id="ann-dom"
                  name="dayOfMonth"
                  type="number"
                  min={1}
                  max={31}
                  defaultValue={defaultValues.dayOfMonth ?? 1}
                />
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="ann-end-type">Termina</FieldLabel>
              <select
                id="ann-end-type"
                name="endType"
                className={selectClassName}
                defaultValue={defaultValues.endType ?? 'never'}
              >
                <option value="never">Nunca</option>
                <option value="date">Data</option>
                <option value="count">Apos N ocorrencias</option>
              </select>
            </Field>

            <Field>
              <FieldLabel htmlFor="ann-end-date">Data de fim</FieldLabel>
              <Input
                id="ann-end-date"
                name="endDate"
                type="date"
                defaultValue={defaultValues.endDate}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="ann-end-count">N. de ocorrencias</FieldLabel>
              <Input
                id="ann-end-count"
                name="endCount"
                type="number"
                min={1}
                defaultValue={defaultValues.endCount}
              />
            </Field>
          </div>
        )}

        {showNotify && (
          <Field orientation="horizontal">
            <Checkbox id="ann-notify" name="notify" defaultChecked />
            <FieldLabel htmlFor="ann-notify">Notificar moradores (email + notificacao)</FieldLabel>
          </Field>
        )}

        <Button type="submit" className="mt-1">
          {submitLabel}
        </Button>
      </Form>
    </div>
  )
}

export default function NewAnnouncementPage({ actionData }: Route.ComponentProps) {
  return (
    <AnnouncementForm
      submitLabel="Criar aviso"
      showNotify
      error={actionData && 'error' in actionData ? actionData.error : undefined}
    />
  )
}
