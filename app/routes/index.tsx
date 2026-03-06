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
      <section id="problems" className="scroll-mt-8 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 overflow-hidden rounded-3xl md:grid-cols-2">
            {/* --- BEFORE column --- */}
            <div className="relative bg-gray-950 px-6 py-10 text-white md:px-10 md:py-14">
              {/* Noise texture overlay */}
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.03]"
                style={{
                  backgroundImage:
                    'url("data:image/svg+xml,%3Csvg viewBox=%270 0 256 256%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27noise%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23noise)%27/%3E%3C/svg%3E")',
                }}
              />

              <p className="relative mb-8 text-sm font-medium tracking-widest text-red-400 uppercase">
                Sem o Zelus
              </p>

              <div className="relative flex flex-col gap-5">
                {/* WhatsApp chaos */}
                <div>
                  <p className="mb-3 text-sm font-medium text-white/50">
                    Grupo &ldquo;Condomínio São Tomé&rdquo; &middot; 47 não lidas
                  </p>
                  <div className="flex flex-col gap-2">
                    <div className="w-fit max-w-[85%] rounded-2xl rounded-tl-md bg-white/10 px-4 py-2.5 text-sm text-white/80 backdrop-blur-sm">
                      Quem chamou o canalizador? Já está a pingar há 3 dias
                    </div>
                    <div className="w-fit max-w-[85%] self-end rounded-2xl rounded-tr-md bg-white/10 px-4 py-2.5 text-sm text-white/80 backdrop-blur-sm">
                      Não fui eu, perguntem à D. Maria
                    </div>
                    <div className="w-fit max-w-[85%] rounded-2xl rounded-tl-md bg-white/10 px-4 py-2.5 text-sm text-white/80 backdrop-blur-sm">
                      Já liguei 3 vezes, ninguém atende
                    </div>
                    <div className="w-fit max-w-[85%] self-end rounded-2xl rounded-tr-md bg-white/10 px-4 py-2.5 text-sm text-white/80 backdrop-blur-sm">
                      Alguém tem o contacto do eletricista?
                    </div>
                    <div className="w-fit max-w-[85%] rounded-2xl rounded-tl-md bg-white/10 px-4 py-2.5 text-sm text-white/80 backdrop-blur-sm">
                      Bom dia, quando é a próxima assembleia?
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-red-400/70">
                    A mensagem perdeu-se entre 200 outras.
                  </p>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/10" />

                {/* Scattered files */}
                <div>
                  <p className="mb-3 text-sm font-medium text-white/50">Ficheiros do condomínio</p>
                  <div className="relative flex flex-wrap gap-2">
                    <span className="-rotate-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white/60">
                      orcamento_2024_v3_FINAL.xlsx
                    </span>
                    <span className="rotate-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white/60">
                      ata_assembleia (2).pdf
                    </span>
                    <span className="-rotate-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white/60">
                      IMG_4392.jpg
                    </span>
                    <span className="rotate-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white/60 line-through decoration-red-400/50">
                      regulamento_antigo.doc
                    </span>
                    <span className="-rotate-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white/60">
                      conta_luz_mar.pdf
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-red-400/70">
                    No e-mail do antigo administrador. Ou era no Drive?
                  </p>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/10" />

                {/* Admin turnover */}
                <div>
                  <p className="mb-3 text-sm font-medium text-white/50">
                    Historial de administração
                  </p>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-white/30 line-through">2022 — Gestcond</span>
                    <span className="text-white/20">&rarr;</span>
                    <span className="text-white/30 line-through">2024 — Sr. Manuel</span>
                    <span className="text-white/20">&rarr;</span>
                    <span className="text-white/50">2026 — ???</span>
                  </div>
                  <p className="mt-3 text-sm text-red-400/70">
                    Contactos, historial, contexto — tudo perdido. Recomeça-se do zero.
                  </p>
                </div>
              </div>
            </div>

            {/* --- AFTER column --- */}
            <div className="bg-primary/[0.03] ring-foreground/5 px-6 py-10 ring-1 ring-inset md:px-10 md:py-14">
              <p className="text-primary mb-8 text-sm font-medium tracking-widest uppercase">
                Com o Zelus
              </p>

              <div className="flex flex-col gap-5">
                {/* Organized tickets */}
                <div>
                  <p className="text-foreground/40 mb-3 text-sm font-medium">Ocorrências</p>
                  <div className="flex flex-col gap-1.5">
                    <div className="bg-card ring-foreground/5 flex items-center gap-3 rounded-xl px-4 py-2.5 ring-1">
                      <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
                      <span className="text-sm">Fuga de água na garagem</span>
                      <span className="text-muted-foreground ml-auto text-sm">Resolvido</span>
                    </div>
                    <div className="bg-card ring-foreground/5 flex items-center gap-3 rounded-xl px-4 py-2.5 ring-1">
                      <span className="bg-primary size-2 shrink-0 rounded-full" />
                      <span className="text-sm">Elevador parado no 3.º andar</span>
                      <span className="text-muted-foreground ml-auto text-sm">Em curso</span>
                    </div>
                    <div className="bg-card ring-foreground/5 flex items-center gap-3 rounded-xl px-4 py-2.5 ring-1">
                      <span className="size-2 shrink-0 rounded-full bg-amber-500" />
                      <span className="text-sm">Porta da entrada não fecha</span>
                      <span className="text-muted-foreground ml-auto text-sm">Aberto</span>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="bg-foreground/5 h-px" />

                {/* Documents + announcements */}
                <div>
                  <p className="text-foreground/40 mb-3 text-sm font-medium">
                    Documentos &amp; Avisos
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <div className="bg-card ring-foreground/5 flex items-center gap-3 rounded-xl px-4 py-2.5 ring-1">
                      <span className="text-muted-foreground text-sm font-medium">PDF</span>
                      <span className="text-sm">Ata da assembleia — Jan 2026</span>
                    </div>
                    <div className="bg-card ring-foreground/5 flex items-center gap-3 rounded-xl px-4 py-2.5 ring-1">
                      <span className="text-muted-foreground text-sm font-medium">PDF</span>
                      <span className="text-sm">Regulamento interno</span>
                    </div>
                    <div className="bg-primary/5 ring-primary/10 flex items-center gap-3 rounded-xl px-4 py-2.5 ring-1">
                      <span className="text-primary text-sm font-medium">Aviso</span>
                      <span className="text-sm">Limpeza da garagem — sábado</span>
                      <span className="bg-primary/10 text-primary ml-auto rounded-full px-2.5 py-0.5 text-sm font-medium">
                        Quinzenal
                      </span>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="bg-foreground/5 h-px" />

                {/* AI Assistant */}
                <div>
                  <p className="text-foreground/40 mb-3 text-sm font-medium">Assistente IA</p>
                  <div className="flex flex-col gap-1.5">
                    <div className="bg-card ring-foreground/5 w-fit max-w-[80%] self-end rounded-2xl rounded-tr-md px-4 py-2.5 text-sm ring-1">
                      Quem é o contacto do eletricista?
                    </div>
                    <div className="bg-primary/5 ring-primary/10 w-fit max-w-[90%] rounded-2xl rounded-tl-md px-4 py-2.5 text-sm ring-1">
                      O prestador registado é a <strong>ElétricoLuz</strong>. Contacto: Pedro Nunes,
                      914&nbsp;567&nbsp;890.
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="bg-foreground/5 h-px" />

                {/* Maintenance history */}
                <div>
                  <p className="text-foreground/40 mb-3 text-sm font-medium">
                    Historial de intervenções
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <div className="bg-card ring-foreground/5 flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm ring-1">
                      <span className="text-muted-foreground font-medium">2024</span>
                      <span>Revisão do elevador — ElevaTécnica</span>
                      <span className="text-muted-foreground ml-auto">450&thinsp;&euro;</span>
                    </div>
                    <div className="bg-card ring-foreground/5 flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm ring-1">
                      <span className="text-muted-foreground font-medium">2025</span>
                      <span>Pintura da escadaria — PintaFácil</span>
                      <span className="text-muted-foreground ml-auto">1.200&thinsp;&euro;</span>
                    </div>
                    <div className="bg-card ring-foreground/5 flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm ring-1">
                      <span className="text-muted-foreground font-medium">2026</span>
                      <span>Desentupimento — Canalizações Silva</span>
                      <span className="text-muted-foreground ml-auto">280&thinsp;&euro;</span>
                    </div>
                  </div>
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
