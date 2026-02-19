import { data, href, redirect, Form, useFetcher, Link } from 'react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Calendar03Icon } from '@hugeicons/core-free-icons'

import type { Route } from './+types/$id'
import { orgContext, userContext } from '~/lib/auth/context'
import { getRecord, updateRecord, deleteRecord } from '~/lib/services/maintenance'
import { listSuppliers } from '~/lib/services/suppliers'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Field, FieldLabel } from '~/components/ui/field'
import { Textarea } from '~/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { AlertDialogAction } from '~/components/ui/alert-dialog'
import { formatCost, formatDate, toInputDate } from '~/lib/format'
import { BackButton } from '~/components/layout/back-button'
import { ErrorBanner } from '~/components/layout/feedback'
import { setToast } from '~/lib/toast.server'
import { DeleteConfirmDialog } from '~/components/shared/delete-dialog'

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData?.record?.title ?? 'Intervenção'
  return [{ title: `${title} — Zelus` }]
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)

  const [record, suppliers] = await Promise.all([getRecord(orgId, params.id), listSuppliers(orgId)])

  if (!record) throw new Response('Not Found', { status: 404 })

  return { record, suppliers, effectiveRole }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)
  const user = context.get(userContext)
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (effectiveRole !== 'org_admin') {
    throw new Response('Forbidden', { status: 403 })
  }

  if (intent === 'update') {
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const performedAtStr = formData.get('performedAt') as string

    if (!title?.trim()) return { error: 'Título obrigatório.' }
    if (!description?.trim()) return { error: 'Descrição obrigatória.' }
    if (!performedAtStr) return { error: 'Data obrigatória.' }

    await updateRecord(
      orgId,
      params.id,
      {
        title,
        description,
        supplierId: (formData.get('supplierId') as string) || null,
        performedAt: new Date(performedAtStr),
        cost: (formData.get('cost') as string) || null,
      },
      user.id,
    )
    return data({ success: true }, { headers: await setToast('Alterações guardadas.') })
  }

  if (intent === 'delete') {
    try {
      await deleteRecord(orgId, params.id, user.id)
      return redirect(href('/maintenance'))
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erro ao apagar registo.' }
    }
  }

  return { error: 'Ação desconhecida.' }
}

export default function MaintenanceDetailPage({ loaderData, actionData }: Route.ComponentProps) {
  const { record, suppliers, effectiveRole } = loaderData
  const isAdmin = effectiveRole === 'org_admin'
  const fetcher = useFetcher()

  const supplierItems = [
    { label: '— Nenhum —', value: '' },
    ...suppliers.map((s) => ({ label: s.name, value: s.id })),
  ]

  const formattedDate = formatDate(record.performedAt)

  return (
    <div>
      <BackButton to={href('/maintenance')} />

      {actionData && 'error' in actionData && (
        <ErrorBanner className="mt-4">{actionData.error}</ErrorBanner>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-5">
        {/* Left column: Description + details */}
        <div className="flex flex-col gap-5 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>{record.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{record.description}</p>

              <dl className="mt-6 flex flex-col gap-4 border-t pt-5">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <HugeiconsIcon
                        icon={Calendar03Icon}
                        size={14}
                        strokeWidth={2}
                        className="text-muted-foreground"
                      />
                      Data
                    </span>
                  </dt>
                  <dd className="text-sm">{formattedDate}</dd>
                </div>

                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground text-sm">Prestador</dt>
                  <dd className="text-sm">
                    {record.supplierName && record.supplierId ? (
                      <Link
                        to={href('/suppliers/:id', { id: record.supplierId })}
                        className="text-primary"
                      >
                        {record.supplierName}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">&mdash;</span>
                    )}
                  </dd>
                </div>

                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground text-sm">Custo</dt>
                  <dd className="text-sm font-medium tabular-nums">
                    {formatCost(record.cost) ?? (
                      <span className="text-muted-foreground font-normal">&mdash;</span>
                    )}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Edit form (admin) or read-only details */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          {isAdmin ? (
            <Card>
              <CardHeader>
                <CardTitle>Editar registo</CardTitle>
              </CardHeader>
              <CardContent>
                <Form method="post" className="grid gap-4">
                  <input type="hidden" name="intent" value="update" />

                  <Field>
                    <FieldLabel htmlFor="title">
                      Título <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input id="title" name="title" defaultValue={record.title} required />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="description">
                      Descrição <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Textarea
                      id="description"
                      name="description"
                      defaultValue={record.description}
                      rows={4}
                      required
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="supplierId">Prestador</FieldLabel>
                    <Select
                      name="supplierId"
                      defaultValue={record.supplierId ?? ''}
                      items={supplierItems}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {supplierItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="performedAt">
                      Data <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      id="performedAt"
                      name="performedAt"
                      type="date"
                      defaultValue={toInputDate(record.performedAt)}
                      required
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="cost">Custo</FieldLabel>
                    <Input
                      id="cost"
                      name="cost"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={record.cost ?? ''}
                    />
                  </Field>

                  <div className="flex items-center justify-between pt-2">
                    <DeleteConfirmDialog
                      title="Apagar registo?"
                      description="Esta ação não pode ser revertida. O registo de intervenção será apagado."
                    >
                      <fetcher.Form method="post">
                        <input type="hidden" name="intent" value="delete" />
                        <AlertDialogAction type="submit">Apagar</AlertDialogAction>
                      </fetcher.Form>
                    </DeleteConfirmDialog>
                    <Button type="submit">Guardar</Button>
                  </div>
                </Form>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Detalhes</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground text-sm">Data</dt>
                    <dd className="text-sm">{formattedDate}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground text-sm">Prestador</dt>
                    <dd className="text-sm">
                      {record.supplierName && record.supplierId ? (
                        <Link
                          to={href('/suppliers/:id', { id: record.supplierId })}
                          className="text-primary"
                        >
                          {record.supplierName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground text-sm">Custo</dt>
                    <dd className="text-sm font-medium tabular-nums">
                      {formatCost(record.cost) ?? (
                        <span className="text-muted-foreground font-normal">&mdash;</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
