import { data, Form, href } from 'react-router'
import { count } from 'drizzle-orm'
import { z } from 'zod'

import type { Route } from './+types'
import { AzulejoPattern } from '~/components/brand/azulejo-pattern'
import { ZelusLogoTile } from '~/components/brand/zelus-logo-tile'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Field, FieldError } from '~/components/ui/field'
import { db } from '~/lib/db'
import { waitlistLeads } from '~/lib/db/schema'
import { sendEmail } from '~/lib/email/client'
import { waitlistConfirmEmail } from '~/lib/email/templates/waitlist-confirm'
import { waitlistSignupEmail } from '~/lib/email/templates/waitlist-signup'
import { validateForm } from '~/lib/forms'
import { waitUntilContext } from '~/lib/vercel/context'

const waitlistSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido'),
})

export function meta(_args: Route.MetaArgs) {
  const title = 'Zelus | Gestão de condomínios, simplificada.'
  const description =
    'Centralize ocorrências, intervenções e prestadores do condomínio num único lugar. Sem ruído, sem complicações.'

  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'website' },
    { property: 'og:image', content: 'https://zelus.sh/og.png' },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: 'https://zelus.sh/og.png' },
  ]
}

const NOTIFY_EMAIL = process.env.WAITLIST_NOTIFY_EMAIL

export async function loader() {
  const [result] = await db.select({ value: count() }).from(waitlistLeads)
  return data({ waitlistCount: result.value })
}

export async function action({ request, context }: Route.ActionArgs) {
  const formData = await request.formData()
  const result = validateForm(formData, waitlistSchema)
  if ('errors' in result) return data({ errors: result.errors }, { status: 400 })

  const { name, email } = result.data

  try {
    await db.insert(waitlistLeads).values({ name, email })
  } catch (error: unknown) {
    // Drizzle wraps pg errors — check cause for unique constraint violation (code 23505)
    const cause = error instanceof Error && 'cause' in error ? error.cause : null
    const isUniqueViolation =
      (cause && typeof cause === 'object' && 'code' in cause && cause.code === '23505') ||
      (error instanceof Error && error.message.includes('unique'))
    if (isUniqueViolation) {
      return data({ success: true }) // silently accept duplicates
    }
    throw error
  }

  // Send emails in background via Vercel waitUntil
  const backgroundProcess = context.get(waitUntilContext)
  backgroundProcess(
    Promise.all([
      // Notify founder of new signup
      NOTIFY_EMAIL
        ? sendEmail({ to: NOTIFY_EMAIL, ...waitlistSignupEmail({ name, email }) })
        : Promise.resolve(),
      // Confirm to the person who signed up
      sendEmail({ to: email, ...waitlistConfirmEmail({ name }) }),
    ]),
  )

  return data({ success: true })
}

function WaitlistForm({
  actionData,
  waitlistCount,
}: {
  actionData: Route.ComponentProps['actionData']
  waitlistCount?: number
}) {
  const isSuccess = actionData && 'success' in actionData && actionData.success
  const errors = actionData && 'errors' in actionData ? actionData.errors : null

  if (isSuccess) {
    return (
      <div className="bg-primary/5 ring-primary/20 rounded-2xl p-5 text-center ring-1">
        <p className="font-semibold">Obrigado pelo interesse!</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Entraremos em contacto quando o Zelus estiver disponível.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Form method="post" className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Field className="flex-1">
          <Input name="name" placeholder="Nome" required />
          {errors?.name && <FieldError>{errors.name}</FieldError>}
        </Field>
        <Field className="flex-1">
          <Input name="email" type="email" placeholder="E-mail" required />
          {errors?.email && <FieldError>{errors.email}</FieldError>}
        </Field>
        <Button type="submit" size="lg">
          Quero acesso antecipado
        </Button>
      </Form>
      <p className="text-muted-foreground text-center text-sm">
        Gratuito. Sem spam.
        {waitlistCount != null && waitlistCount > 0 && (
          <span>
            {' '}
            &middot; {waitlistCount} pessoa{waitlistCount !== 1 ? 's' : ''} já na lista.
          </span>
        )}
      </p>
    </div>
  )
}

export default function LandingPage({ actionData, loaderData }: Route.ComponentProps) {
  return (
    <div className="scroll-smooth">
      {/* Top bar */}
      <div className="relative z-20 flex justify-end px-6 py-4">
        <a
          href={href('/login')}
          className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
        >
          Já tem conta? Entrar
        </a>
      </div>

      {/* Section 1: Hero */}
      <section className="relative flex min-h-svh items-center justify-center px-6 py-16 md:py-24">
        <AzulejoPattern />

        <div className="relative z-10 flex max-w-3xl flex-col items-center gap-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <ZelusLogoTile size={64} className="text-primary" />
            <span className="text-3xl font-semibold tracking-tight">zelus</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Gestão de condomínios, simplificada.
          </h1>

          <p className="text-muted-foreground text-base">
            Centralize ocorrências, intervenções e prestadores num único lugar. <br /> Sem ruído,
            sem complicações.
          </p>

          <div className="bg-muted/50 ring-foreground/10 flex aspect-video w-full max-w-2xl items-center justify-center rounded-2xl ring-1">
            <span className="text-muted-foreground text-base">Em breve</span>
          </div>

          <div className="w-full max-w-2xl">
            <WaitlistForm actionData={actionData} waitlistCount={loaderData.waitlistCount} />
          </div>

          <p className="text-muted-foreground text-sm italic">
            Do latim zelus: o cuidado vigilante pelo que é de todos.
          </p>

          <a
            href="#problems"
            className="text-muted-foreground hover:text-foreground mt-2 transition-colors"
            aria-label="Ver mais"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-bounce"
            >
              <path d="m7 13 5 5 5-5" />
              <path d="m7 6 5 5 5-5" />
            </svg>
          </a>
        </div>
      </section>

      {/* Section 2: Problems */}
      <section id="problems" className="scroll-mt-8 px-6 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-8 text-center text-xl font-semibold tracking-tight md:text-2xl">
            Gerir um condomínio não devia ser assim 👇
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="bg-card ring-foreground/10 rounded-2xl p-5 ring-1">
              <h3 className="mb-2 text-base font-semibold">Grupos de WhatsApp intermináveis</h3>
              <p className="text-muted-foreground text-sm">
                Quem chamou o canalizador? Quando foi? Ninguém sabe. A mensagem perdeu-se entre 200
                outras.
              </p>
            </div>

            <div className="bg-card ring-foreground/10 rounded-2xl p-5 ring-1">
              <h3 className="mb-2 text-base font-semibold">
                E-mails e planilhas que ninguém encontra
              </h3>
              <p className="text-muted-foreground text-sm">
                O orçamento está no e-mail do antigo administrador. A ata está numa pasta no Drive.
                Ou era no Dropbox?
              </p>
            </div>

            <div className="bg-card ring-foreground/10 rounded-2xl p-5 ring-1">
              <h3 className="mb-2 text-base font-semibold">Moradores sem visibilidade</h3>
              <p className="text-muted-foreground text-sm">
                O que foi decidido na última assembleia? O que está em curso? Sem respostas, cresce
                a desconfiança.
              </p>
            </div>

            <div className="bg-card ring-foreground/10 rounded-2xl p-5 ring-1">
              <h3 className="mb-2 text-base font-semibold">
                Cada troca de administração, recomeça-se do zero
              </h3>
              <p className="text-muted-foreground text-sm">
                Três anos, três administradoras. De cada vez, perde-se contactos, historial,
                contexto. Como se o prédio não tivesse memória.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Solution */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-8 text-center text-xl font-semibold tracking-tight md:text-2xl">
            Um lugar para tudo o que acontece no vosso prédio.
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="bg-card ring-foreground/10 rounded-2xl p-5 ring-1">
              <h3 className="mb-2 text-base font-semibold">
                Ocorrências organizadas, do início ao fim
              </h3>
              <p className="text-muted-foreground text-sm">
                Reportar problemas, acompanhar o estado, ver quem tratou e quando. Sem perseguir
                ninguém.
              </p>
            </div>

            <div className="bg-card ring-foreground/10 rounded-2xl p-5 ring-1">
              <h3 className="mb-2 text-base font-semibold">Historial que não desaparece</h3>
              <p className="text-muted-foreground text-sm">
                Manutenções, intervenções, fornecedores. Tudo registado. Muda a administração, o
                conhecimento fica.
              </p>
            </div>

            <div className="bg-card ring-foreground/10 rounded-2xl p-5 ring-1">
              <h3 className="mb-2 text-base font-semibold">
                Perguntas respondidas sem incomodar ninguém
              </h3>
              <p className="text-muted-foreground text-sm">
                O regulamento permite obras no terraço? Quando foi a última inspeção do elevador? O
                assistente encontra a resposta nos documentos do condomínio.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: CTA Repeat */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <p className="text-lg italic">Do latim zelus: o cuidado vigilante pelo que é de todos.</p>
          <p className="text-muted-foreground">
            O Zelus está em fase de acesso antecipado. Deixe o seu nome para ser dos primeiros a
            experimentar.
          </p>
          <div className="w-full max-w-2xl">
            <WaitlistForm actionData={actionData} waitlistCount={loaderData.waitlistCount} />
          </div>
        </div>
      </section>

      {/* Section 5: Footer */}
      <footer className="bg-background/80 text-muted-foreground relative z-10 border-t px-6 py-4 text-center text-sm backdrop-blur-sm">
        Zelus &copy; {new Date().getFullYear()}
      </footer>
    </div>
  )
}
