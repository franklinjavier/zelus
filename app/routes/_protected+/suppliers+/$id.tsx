import { data, redirect, Form, useFetcher, Link } from 'react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { WrenchIcon } from '@hugeicons/core-free-icons'

import type { Route } from './+types/$id'
import { orgContext, userContext } from '~/lib/auth/context'
import {
  getSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierMaintenanceCount,
} from '~/lib/services/suppliers'
import { listCategories } from '~/lib/services/categories'
import { translateCategory } from '~/lib/category-labels'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
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
import { formatDate } from '~/lib/format'
import { BackButton } from '~/components/layout/back-button'
import { ErrorBanner } from '~/components/layout/feedback'
import { setToast } from '~/lib/toast.server'
import { DeleteConfirmDialog } from '~/components/shared/delete-dialog'

export function meta({ loaderData }: Route.MetaArgs) {
  const name = loaderData?.supplier?.name ?? 'Fornecedor'
  return [{ title: `${name} — Zelus` }]
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const { orgId, effectiveRole } = context.get(orgContext)

  const [supplier, maintenanceCount, categories] = await Promise.all([
    getSupplier(orgId, params.id),
    getSupplierMaintenanceCount(orgId, params.id),
    listCategories(),
  ])

  if (!supplier) throw new Response('Not Found', { status: 404 })

  return { supplier, maintenanceCount, categories, effectiveRole }
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
    const name = formData.get('name') as string
    const category = formData.get('category') as string

    if (!name?.trim()) return { error: 'Nome obrigatório.' }
    if (!category?.trim()) return { error: 'Categoria obrigatória.' }

    await updateSupplier(
      orgId,
      params.id,
      {
        name,
        category,
        phone: (formData.get('phone') as string) || null,
        email: (formData.get('email') as string) || null,
        website: (formData.get('website') as string) || null,
        address: (formData.get('address') as string) || null,
        notes: (formData.get('notes') as string) || null,
      },
      user.id,
    )
    return data({ success: true }, { headers: await setToast('Alterações guardadas.') })
  }

  if (intent === 'delete') {
    try {
      await deleteSupplier(orgId, params.id, user.id)
      return redirect('/suppliers')
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erro ao apagar fornecedor.' }
    }
  }

  return { error: 'Ação desconhecida.' }
}

export default function SupplierDetailPage({ loaderData, actionData }: Route.ComponentProps) {
  const { supplier, maintenanceCount, categories, effectiveRole } = loaderData
  const isAdmin = effectiveRole === 'org_admin'
  const fetcher = useFetcher()

  const categoryItems = categories.map((c) => ({ label: translateCategory(c.key), value: c.key }))

  return (
    <div>
      <BackButton to="/suppliers" />

      {actionData && 'error' in actionData && (
        <ErrorBanner className="mt-4">{actionData.error}</ErrorBanner>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-5">
        {/* Left column: Edit form (admin) or read-only info */}
        <div className="flex flex-col gap-5 lg:col-span-3">
          {isAdmin ? (
            <Card>
              <CardHeader>
                <CardTitle>Dados do fornecedor</CardTitle>
              </CardHeader>
              <CardContent>
                <Form method="post" className="grid gap-4">
                  <input type="hidden" name="intent" value="update" />

                  <Field>
                    <FieldLabel htmlFor="name">
                      Nome <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input id="name" name="name" defaultValue={supplier.name} required />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="category">
                      Categoria <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Select name="category" defaultValue={supplier.category} items={categoryItems}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="phone">Telefone</FieldLabel>
                    <Input id="phone" name="phone" type="tel" defaultValue={supplier.phone ?? ''} />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="email">E-mail</FieldLabel>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      defaultValue={supplier.email ?? ''}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="website">Website</FieldLabel>
                    <Input id="website" name="website" defaultValue={supplier.website ?? ''} />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="address">Morada</FieldLabel>
                    <Input id="address" name="address" defaultValue={supplier.address ?? ''} />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="notes">Notas</FieldLabel>
                    <Textarea
                      id="notes"
                      name="notes"
                      defaultValue={supplier.notes ?? ''}
                      rows={3}
                    />
                  </Field>

                  <div className="flex items-center justify-between pt-2">
                    <DeleteConfirmDialog
                      title="Apagar fornecedor?"
                      description="Esta ação não pode ser revertida. Todos os dados do fornecedor serão apagados."
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
                <CardTitle>{supplier.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground text-sm">Categoria</dt>
                    <dd>
                      <Badge variant="secondary">{translateCategory(supplier.category)}</Badge>
                    </dd>
                  </div>
                  {supplier.phone && (
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground text-sm">Telefone</dt>
                      <dd className="text-sm">{supplier.phone}</dd>
                    </div>
                  )}
                  {supplier.email && (
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground text-sm">E-mail</dt>
                      <dd className="text-sm">{supplier.email}</dd>
                    </div>
                  )}
                  {supplier.website && (
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground text-sm">Website</dt>
                      <dd className="text-sm">{supplier.website}</dd>
                    </div>
                  )}
                  {supplier.address && (
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground text-sm">Morada</dt>
                      <dd className="text-sm">{supplier.address}</dd>
                    </div>
                  )}
                  {supplier.notes && (
                    <div>
                      <dt className="text-muted-foreground text-sm">Notas</dt>
                      <dd className="mt-1 text-sm whitespace-pre-wrap">{supplier.notes}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: Info card */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Informação</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <HugeiconsIcon
                        icon={WrenchIcon}
                        size={14}
                        strokeWidth={2}
                        className="text-muted-foreground"
                      />
                      Manutenções
                    </span>
                  </dt>
                  <dd className="text-sm">
                    {maintenanceCount > 0 ? (
                      <Link to={`/maintenance?supplierId=${supplier.id}`} className="text-primary">
                        {maintenanceCount} {maintenanceCount === 1 ? 'registo' : 'registos'}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Sem registos</span>
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground text-sm">Criado em</dt>
                  <dd className="text-sm">{formatDate(supplier.createdAt)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
