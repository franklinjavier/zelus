import { useState } from 'react'
import { redirect, useFetcher, useSearchParams, Link } from 'react-router'

import type { Route } from './+types/fractions'
import { requireAuth } from '~/lib/auth/rbac'
import { db } from '~/lib/db'
import { fractions } from '~/lib/db/schema'

import { Button, buttonVariants } from '~/components/ui/button'
import { Input } from '~/components/ui/input'

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const orgId = url.searchParams.get('orgId')
  if (!orgId) throw redirect('/onboarding/org')
  return { orgId }
}

export async function action({ request, context }: Route.ActionArgs) {
  requireAuth(context)
  const formData = await request.formData()
  const orgId = formData.get('orgId') as string
  const labels = formData.getAll('label') as string[]

  if (!orgId) throw redirect('/onboarding/org')

  for (const label of labels) {
    if (label.trim()) {
      await db.insert(fractions).values({
        orgId,
        label: label.trim(),
      })
    }
  }

  throw redirect(`/onboarding/done?orgId=${orgId}`)
}

export default function OnboardingFractions() {
  const [searchParams] = useSearchParams()
  const orgId = searchParams.get('orgId')!
  const fetcher = useFetcher<typeof action>()
  const isSubmitting = fetcher.state === 'submitting'
  const [fractionLabels, setFractionLabels] = useState([''])

  return (
    <fetcher.Form method="post" className="grid gap-4">
      <input type="hidden" name="orgId" value={orgId} />
      <p className="text-muted-foreground text-sm">
        Adicione as frações do edifício. Pode usar nomes livres (ex: &quot;T3 – 2º Esq.&quot;).
      </p>
      {fractionLabels.map((value, index) => (
        <div key={index} className="flex gap-2">
          <Input
            name="label"
            value={value}
            onChange={(e) => {
              const next = [...fractionLabels]
              next[index] = e.target.value
              setFractionLabels(next)
            }}
            placeholder={`Fração ${index + 1}`}
            className="flex-1"
          />
          {fractionLabels.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setFractionLabels(fractionLabels.filter((_, i) => i !== index))}
            >
              ✕
            </Button>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => setFractionLabels([...fractionLabels, ''])}
      >
        + Adicionar fração
      </Button>
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? 'A guardar…' : 'Continuar'}
        </Button>
        <Link
          to={`/onboarding/done?orgId=${orgId}`}
          className={buttonVariants({ variant: 'ghost' })}
        >
          Saltar
        </Link>
      </div>
    </fetcher.Form>
  )
}
