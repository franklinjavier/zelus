# Landing Page Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the minimal splash-screen landing page with a multi-section marketing page that captures waitlist signups (name + email).

**Architecture:** New `waitlist_leads` DB table, route action on `index.tsx` to handle form submission, multi-section scrolling page using existing brand components and shadcn/ui primitives. No new dependencies needed.

**Tech Stack:** React Router v7 (loader/action), Drizzle ORM, Zod, Tailwind v4, shadcn/ui (base-maia), existing brand components.

**Design doc:** `docs/plans/2026-02-20-landing-page-redesign.md`

---

## Task 1: Create waitlist_leads DB schema

**Files:**

- Create: `app/lib/db/schema/waitlist.ts`
- Modify: `app/lib/db/schema/index.ts`

**Step 1: Create the schema file**

```ts
// app/lib/db/schema/waitlist.ts
import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const waitlistLeads = pgTable(
  'waitlist_leads',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    email: text('email').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('waitlist_leads_email_idx').on(t.email)],
)
```

**Step 2: Add export to schema index**

Add `export * from './waitlist'` to `app/lib/db/schema/index.ts`.

**Step 3: Generate migration**

Run: `bun run db:generate waitlist-leads`
Expected: Migration file created in `app/lib/db/migrations/`

**Step 4: Apply migration**

Run: `bun run db:migrate`
Expected: Migration applied successfully (local DB)

**Step 5: Verify with typecheck**

Run: `bun run typecheck`
Expected: No type errors

**Step 6: Commit**

```
feat: add waitlist_leads schema and migration
```

---

## Task 2: Build the landing page route (hero + waitlist form + action)

**Files:**

- Modify: `app/routes/index.tsx`

This is the core task. Replace the current single-screen splash with the full multi-section page. The form action handles waitlist signups.

**Step 1: Rewrite `app/routes/index.tsx`**

The route needs:

- `meta` export (update description for SEO)
- `action` export that validates name + email with Zod, inserts into `waitlist_leads`, handles duplicate emails gracefully
- `default` export with 5 sections: Hero, Problems, Solution, CTA repeat, Footer

Key patterns to follow:

- Use `validateForm` from `~/lib/forms` for Zod validation
- Use `Form` from `react-router` for the waitlist form
- Use `data()` from `react-router` to return action results
- Use `Button` from `~/components/ui/button` (size="lg" for the CTA)
- Use `Input` from `~/components/ui/input`
- Use `Field`, `FieldError` from `~/components/ui/field`
- Keep `AzulejoPattern` in the hero section
- Keep `ZelusLogoTile` for brand presence

**Action logic:**

```ts
import { data } from 'react-router'
import { z } from 'zod'
import { db } from '~/lib/db'
import { waitlistLeads } from '~/lib/db/schema'
import { validateForm } from '~/lib/forms'

const waitlistSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido'),
})

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const result = validateForm(formData, waitlistSchema)
  if ('errors' in result) return data({ errors: result.errors }, { status: 400 })

  const { name, email } = result.data

  try {
    await db.insert(waitlistLeads).values({ name, email })
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('unique')) {
      return data({ success: true }) // silently accept duplicates
    }
    throw error
  }

  return data({ success: true })
}
```

**Page structure (sections):**

Section 1 - Hero:

- `AzulejoPattern` background (existing)
- `ZelusLogoTile` (size 64) + "zelus" text
- Headline: "Todos os moradores merecem saber o que acontece no seu predio."
- Subhead: "O Zelus centraliza ocorrencias, manutencoes e documentos do condominio num unico lugar. Visivel para todos. Sem depender de grupos de WhatsApp, e-mails perdidos ou planilhas que ninguem encontra."
- Video placeholder div (empty, styled, for future Remotion embed)
- Waitlist form (name + email + submit button)
- Below form: "Do latim zelus: o cuidado vigilante pelo que e de todos."
- Success state: replace form with confirmation message

Section 2 - Problems:

- Section title: "Gerir um condominio nao devia ser assim."
- 4 cards in a 2x2 grid (responsive: 1 col mobile, 2 col desktop)
- Each card: `rounded-2xl ring-1 ring-foreground/10 p-5 bg-card`
- Card title bold, description in muted-foreground

Section 3 - Solution:

- Section title: "Um lugar para tudo o que acontece no vosso predio."
- 3 benefit blocks in a 3-col grid (responsive: 1 col mobile, 3 col desktop)
- Same card styling as section 2

Section 4 - CTA repeat:

- Centered text: "Do latim zelus: o cuidado vigilante pelo que e de todos." (italic)
- Subtext: "O Zelus esta em fase de acesso antecipado. Deixe o seu nome para ser dos primeiros a experimentar."
- Same waitlist form repeated
- This form shares the same action, same success state

Section 5 - Footer:

- Same as current: `Zelus (c) 2026`

**Styling notes:**

- Use `scroll-smooth` on the outer container
- Sections separated by generous `py-16 md:py-24` padding
- Max content width: `max-w-3xl mx-auto` for text sections, `max-w-5xl` for card grids
- All text uses `text-sm` minimum (accessibility requirement)
- Buttons use `size="lg"` for the CTA
- Cards follow design system: `rounded-2xl ring-1 ring-foreground/10 bg-card p-5`
- AzulejoPattern only in hero section, not full page

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: No type errors

**Step 3: Manual test in browser**

Run: `bun run dev`

- Visit `http://localhost:5173`
- Verify all 5 sections render correctly
- Test waitlist form submission (happy path)
- Test duplicate email submission (should show success, not error)
- Test form validation (empty name, invalid email)
- Test responsive layout (mobile, tablet, desktop)
- Verify AzulejoPattern renders in hero

**Step 4: Commit**

```
feat: redesign landing page with marketing copy and waitlist
```

---

## Task 3: Add login link to the page

**Files:**

- Modify: `app/routes/index.tsx`

The current page has a "Comecar" button linking to `/login`. We still need a way for existing users to log in, but it shouldn't compete with the waitlist CTA.

**Step 1: Add a subtle login link**

Add a small nav bar or top-right link: "Ja tem conta? Entrar" linking to `href('/login')`.
Style: `text-sm text-muted-foreground hover:text-foreground` with an underline. Position: top of page, right-aligned, or in the footer.

**Step 2: Verify it works**

Run: `bun run dev`
Click the link, verify it goes to `/login`.

**Step 3: Commit**

```
feat: add login link for existing users on landing page
```

---

## Task 4: Final verification

**Step 1: Run full typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 2: Run tests**

Run: `bun run test`
Expected: All existing tests pass (no regressions)

**Step 3: Production build**

Run: `bun run build`
Expected: Build succeeds

**Step 4: Visual review**

Run: `bun run dev`
Walk through the full page on mobile (375px) and desktop (1440px). Check:

- [ ] Hero section with logo, headline, subhead, form
- [ ] Video placeholder area
- [ ] Problem cards layout (1 col mobile, 2 col desktop)
- [ ] Solution blocks layout (1 col mobile, 3 col desktop)
- [ ] CTA repeat section with form
- [ ] Footer
- [ ] Form submission works, shows success state
- [ ] Duplicate email handled gracefully
- [ ] Login link visible and functional
- [ ] AzulejoPattern background in hero
- [ ] No text below 14px (text-sm minimum)
- [ ] Buttons are h-10 (size="lg")
- [ ] Cards are rounded-2xl with whisper-quiet borders
- [ ] Overall feel: trustworthy, calm, Portuguese identity
