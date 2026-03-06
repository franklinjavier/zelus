import { data, Form, href } from 'react-router'
import { count } from 'drizzle-orm'
import { z } from 'zod'

import type { Route } from './+types'
import { lazy, Suspense, useId } from 'react'

const AzulejoPattern = lazy(() =>
  import('~/components/brand/azulejo-pattern').then((m) => ({ default: m.AzulejoPattern })),
)
import { ImagePreview } from '~/components/tickets/timeline-entry'
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

  const url = 'https://zelus.sh'
  const image = `${url}/og.jpg`

  return [
    { title },
    { name: 'description', content: description },
    // Open Graph
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: url },
    { property: 'og:site_name', content: 'Zelus' },
    { property: 'og:locale', content: 'pt_PT' },
    { property: 'og:image', content: image },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:type', content: 'image/jpeg' },
    // Twitter
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
    { name: 'theme-color', content: '#ffffff' },
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

  const id = useId()

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
          <label htmlFor={`${id}-name`} className="sr-only">
            Nome
          </label>
          <Input id={`${id}-name`} name="name" placeholder="Nome" required />
          {errors?.name && <FieldError>{errors.name}</FieldError>}
        </Field>
        <Field className="flex-1">
          <label htmlFor={`${id}-email`} className="sr-only">
            E-mail
          </label>
          <Input id={`${id}-email`} name="email" type="email" placeholder="E-mail" required />
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

const features = [
  {
    title: 'Tudo começa na página inicial',
    description:
      'Avisos do condomínio, atalhos para as funcionalidades principais e documentos importantes — tudo visível assim que entra.',
    screenshot: '/screenshots/01-home.png',
    thumbnail: '/screenshots/01-home-thumb.webp',
    alt: 'Página inicial do Zelus com avisos e atalhos',
  },
  {
    title: 'Ocorrências organizadas, do início ao fim',
    description:
      'Reporte problemas, acompanhe o estado e veja quem tratou e quando. Sem perseguir ninguém por mensagem.',
    screenshot: '/screenshots/02-tickets.png',
    thumbnail: '/screenshots/02-tickets-thumb.webp',
    alt: 'Lista de ocorrências do condomínio no Zelus',
  },
  {
    title: 'Perguntas respondidas sem incomodar ninguém',
    description:
      'O assistente IA encontra respostas nos documentos e dados do condomínio. Regulamentos, contactos, historial — tudo acessível numa conversa.',
    screenshot: '/screenshots/03-assistant.png',
    thumbnail: '/screenshots/03-assistant-thumb.webp',
    alt: 'Assistente IA do Zelus a responder sobre ocorrências',
  },
  {
    title: 'Prestadores sempre à mão',
    description:
      'Canalizador, eletricista, empresa de elevadores — todos os contactos organizados por categoria, sem depender da memória de ninguém.',
    screenshot: '/screenshots/04-suppliers.png',
    thumbnail: '/screenshots/04-suppliers-thumb.webp',
    alt: 'Diretório de prestadores de serviço no Zelus',
  },
]

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
        <Suspense>
          <AzulejoPattern />
        </Suspense>

        <div className="relative z-10 flex w-full max-w-5xl flex-col items-center gap-6 text-center">
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

          <div className="ring-foreground/10 aspect-video w-full overflow-hidden rounded-2xl shadow-xl ring-1">
            <video autoPlay muted loop playsInline controls className="h-full w-full object-cover">
              <source src="/hero.webm" type="video/webm" />
              <source src="/hero.mp4" type="video/mp4" />
              Vídeo demonstrativo do Zelus — gestão de condomínios simplificada.
            </video>
          </div>

          <div className="mt-6 w-full max-w-2xl">
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

      {/* Section 2: Before / After comparison */}
      <section id="problems" className="scroll-mt-8 px-6 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            {/* --- BEFORE column --- */}
            <div>
              <div className="mb-6 flex items-center gap-2">
                <span className="bg-destructive/10 text-destructive inline-flex size-7 items-center justify-center rounded-full text-sm font-bold">
                  &times;
                </span>
                <h2 className="text-lg font-semibold tracking-tight">Sem o Zelus</h2>
              </div>

              <div className="flex flex-col gap-3">
                {/* Mock WhatsApp chaos */}
                <div className="bg-destructive/5 ring-destructive/10 rounded-2xl p-5 ring-1">
                  <h3 className="text-destructive mb-2 text-sm font-semibold">
                    Grupos de WhatsApp intermináveis
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    <div className="bg-background/60 w-fit max-w-[80%] rounded-xl rounded-tl-sm px-3 py-1.5 text-sm">
                      Quem chamou o canalizador?
                    </div>
                    <div className="bg-background/60 w-fit max-w-[80%] self-end rounded-xl rounded-tr-sm px-3 py-1.5 text-sm">
                      Não fui eu, perguntem à D. Maria
                    </div>
                    <div className="bg-background/60 w-fit max-w-[80%] rounded-xl rounded-tl-sm px-3 py-1.5 text-sm">
                      Já liguei 3 vezes, ninguém atende
                    </div>
                    <p className="text-destructive/60 mt-1 text-sm italic">
                      +47 mensagens não lidas...
                    </p>
                  </div>
                </div>

                {/* Scattered files */}
                <div className="bg-destructive/5 ring-destructive/10 rounded-2xl p-5 ring-1">
                  <h3 className="text-destructive mb-2 text-sm font-semibold">
                    Ficheiros espalhados por todo o lado
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="bg-background/60 rounded-lg px-2.5 py-1 text-sm">
                      orcamento_2024_v3_FINAL.xlsx
                    </span>
                    <span className="bg-background/60 rounded-lg px-2.5 py-1 text-sm">
                      ata_assembleia (2).pdf
                    </span>
                    <span className="bg-background/60 rounded-lg px-2.5 py-1 text-sm">
                      IMG_4392.jpg
                    </span>
                    <span className="bg-background/60 rounded-lg px-2.5 py-1 text-sm">
                      regulamento_antigo.doc
                    </span>
                  </div>
                  <p className="text-destructive/60 mt-2 text-sm italic">
                    Está no e-mail do antigo administrador. Ou era no Drive?
                  </p>
                </div>

                {/* No visibility */}
                <div className="bg-destructive/5 ring-destructive/10 rounded-2xl p-5 ring-1">
                  <h3 className="text-destructive mb-2 text-sm font-semibold">
                    Moradores sem respostas
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    <div className="bg-background/60 w-fit rounded-xl px-3 py-1.5 text-sm">
                      O que foi decidido na assembleia?
                    </div>
                    <div className="bg-background/60 w-fit rounded-xl px-3 py-1.5 text-sm">
                      Quando é que arranjam o elevador?
                    </div>
                    <div className="bg-background/60 w-fit rounded-xl px-3 py-1.5 text-sm">
                      Quem é o contacto do eletricista?
                    </div>
                  </div>
                  <p className="text-destructive/60 mt-2 text-sm italic">
                    Sem respostas, cresce a desconfiança.
                  </p>
                </div>

                {/* Admin turnover */}
                <div className="bg-destructive/5 ring-destructive/10 rounded-2xl p-5 ring-1">
                  <h3 className="text-destructive mb-2 text-sm font-semibold">
                    Cada troca de administração, recomeça-se do zero
                  </h3>
                  <div className="text-muted-foreground flex items-center gap-3 text-sm">
                    <span className="line-through">2022 — Gestcond</span>
                    <span>&rarr;</span>
                    <span className="line-through">2024 — Sr. Manuel</span>
                    <span>&rarr;</span>
                    <span>2026 — ?</span>
                  </div>
                  <p className="text-destructive/60 mt-2 text-sm italic">
                    Contactos, historial, contexto — tudo perdido.
                  </p>
                </div>
              </div>
            </div>

            {/* --- AFTER column --- */}
            <div>
              <div className="mb-6 flex items-center gap-2">
                <span className="bg-primary/10 text-primary inline-flex size-7 items-center justify-center rounded-full text-sm font-bold">
                  &check;
                </span>
                <h2 className="text-lg font-semibold tracking-tight">Com o Zelus</h2>
              </div>

              <div className="flex flex-col gap-3">
                {/* Organized tickets */}
                <div className="bg-primary/5 ring-primary/10 rounded-2xl p-5 ring-1">
                  <h3 className="text-primary mb-2 text-sm font-semibold">
                    Ocorrências organizadas, do início ao fim
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    <div className="bg-background/60 flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm">
                      <span className="bg-destructive/20 text-destructive size-2 rounded-full" />
                      Fuga de água na garagem
                      <span className="text-muted-foreground ml-auto text-sm">Resolvido</span>
                    </div>
                    <div className="bg-background/60 flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm">
                      <span className="bg-primary/30 text-primary size-2 rounded-full" />
                      Elevador parado no 3.º
                      <span className="text-muted-foreground ml-auto text-sm">Em curso</span>
                    </div>
                    <div className="bg-background/60 flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm">
                      <span className="size-2 rounded-full bg-amber-400/50" />
                      Porta da entrada não fecha
                      <span className="text-muted-foreground ml-auto text-sm">Aberto</span>
                    </div>
                  </div>
                  <p className="text-primary/60 mt-2 text-sm">
                    Cada problema acompanhado com estado, prioridade e histórico.
                  </p>
                </div>

                {/* Documents + announcements */}
                <div className="bg-primary/5 ring-primary/10 rounded-2xl p-5 ring-1">
                  <h3 className="text-primary mb-2 text-sm font-semibold">
                    Documentos e avisos centralizados
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    <div className="bg-background/60 flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm">
                      <span className="text-muted-foreground">PDF</span>
                      Ata da assembleia — Jan 2026
                    </div>
                    <div className="bg-background/60 flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm">
                      <span className="text-muted-foreground">PDF</span>
                      Regulamento interno
                    </div>
                    <div className="bg-background/60 flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm">
                      <span className="text-primary">Aviso</span>
                      Limpeza da garagem — sábado
                      <span className="bg-primary/10 text-primary ml-auto rounded-full px-2 py-0.5 text-sm">
                        Semanal
                      </span>
                    </div>
                  </div>
                  <p className="text-primary/60 mt-2 text-sm">
                    Atas, regulamentos e avisos agendados num único lugar.
                  </p>
                </div>

                {/* AI Assistant answers */}
                <div className="bg-primary/5 ring-primary/10 rounded-2xl p-5 ring-1">
                  <h3 className="text-primary mb-2 text-sm font-semibold">
                    Respostas imediatas com o assistente IA
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    <div className="bg-background/60 w-fit max-w-[80%] self-end rounded-xl rounded-tr-sm px-3 py-1.5 text-sm">
                      Quem é o contacto do eletricista?
                    </div>
                    <div className="bg-primary/10 w-fit max-w-[85%] rounded-xl rounded-tl-sm px-3 py-1.5 text-sm">
                      O prestador registado é a <strong>ElétricoLuz</strong>. Contacto: Pedro Nunes,
                      914 567 890.
                    </div>
                  </div>
                  <p className="text-primary/60 mt-2 text-sm">
                    Encontra respostas nos documentos e dados do condomínio.
                  </p>
                </div>

                {/* Persistent history */}
                <div className="bg-primary/5 ring-primary/10 rounded-2xl p-5 ring-1">
                  <h3 className="text-primary mb-2 text-sm font-semibold">
                    Historial que sobrevive a qualquer mudança
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    <div className="bg-background/60 flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm">
                      <span className="text-muted-foreground">2024</span>
                      Revisão do elevador — ElevaTécnica — 450&euro;
                    </div>
                    <div className="bg-background/60 flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm">
                      <span className="text-muted-foreground">2025</span>
                      Pintura da escadaria — PintaFácil — 1.200&euro;
                    </div>
                    <div className="bg-background/60 flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm">
                      <span className="text-muted-foreground">2026</span>
                      Desentupimento coluna — Canalizações Silva — 280&euro;
                    </div>
                  </div>
                  <p className="text-primary/60 mt-2 text-sm">
                    Muda a administração, o conhecimento fica.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3b: Feature Showcase */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-xl font-semibold tracking-tight md:text-2xl">
            Tudo o que precisa, num só lugar.
          </h2>

          <div className="flex flex-col gap-16 md:gap-24">
            {features.map((feature, i) => (
              <div
                key={feature.screenshot}
                className={`flex flex-col items-center gap-6 md:gap-10 ${
                  i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                }`}
              >
                <div className="flex-1 space-y-3">
                  <h3 className="text-lg font-semibold tracking-tight">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
                <div className="w-full flex-1">
                  <ImagePreview
                    src={feature.screenshot}
                    thumbnailSrc={feature.thumbnail}
                    alt={feature.alt}
                    className="ring-foreground/10 block w-full cursor-zoom-in overflow-hidden rounded-2xl shadow-xl ring-1"
                    imgClassName="h-auto w-full"
                  />
                </div>
              </div>
            ))}
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
