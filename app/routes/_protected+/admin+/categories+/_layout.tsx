import { data, Form, Link, Outlet, useMatches, useNavigate, href } from 'react-router'

import type { Route } from './+types/_layout'
import { orgContext, userContext } from '~/lib/auth/context'
import { listCategories, deleteCategory } from '~/lib/services/categories'
import { translateCategory } from '~/lib/category-labels'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { ErrorBanner } from '~/components/layout/feedback'
import { setToast } from '~/lib/toast.server'
import {
  Drawer,
  DrawerPopup,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '~/components/ui/drawer'

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'Categorias — Zelus' }]
}

export async function loader() {
  const categories = await listCategories()
  return { categories }
}

export async function action({ request, context }: Route.ActionArgs) {
  const { orgId } = context.get(orgContext)
  const user = context.get(userContext)
  const formData = await request.formData()
  const fields = Object.fromEntries(formData)

  if (fields.intent === 'delete') {
    const key = String(fields.key)

    try {
      await deleteCategory(key, user.id, orgId)
      return data({ success: true }, { headers: await setToast('Alterações guardadas.') })
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Erro ao apagar categoria.' }
    }
  }

  return { error: 'Ação desconhecida.' }
}

export default function CategoriesLayout({ loaderData, actionData }: Route.ComponentProps) {
  const { categories } = loaderData
  const navigate = useNavigate()
  const matches = useMatches()
  const isDrawerOpen = matches.some((m) => m.pathname.endsWith('/new'))

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Categorias</h1>
        <Button render={<Link to={href('/admin/categories/new')} />}>Nova categoria</Button>
      </div>

      {actionData && 'error' in actionData && (
        <ErrorBanner className="mt-4">{actionData.error}</ErrorBanner>
      )}

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Categorias</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {categories.length === 0 ? (
              <p className="text-muted-foreground px-4 py-6 text-center text-sm">
                Nenhuma categoria criada.
              </p>
            ) : (
              <div className="divide-y">
                {categories.map((cat) => (
                  <div key={cat.key} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{translateCategory(cat.key)}</p>
                      <p className="text-muted-foreground text-sm">{cat.key}</p>
                    </div>
                    <Form method="post">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="key" value={cat.key} />
                      <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                        Apagar
                      </Button>
                    </Form>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Drawer
        open={isDrawerOpen}
        onOpenChange={(open) => {
          if (!open) navigate(href('/admin/categories'))
        }}
      >
        <DrawerPopup>
          <DrawerHeader>
            <DrawerTitle>Nova categoria</DrawerTitle>
            <DrawerDescription>Adicione uma nova categoria de ticket.</DrawerDescription>
          </DrawerHeader>
          <Outlet />
        </DrawerPopup>
      </Drawer>
    </div>
  )
}
