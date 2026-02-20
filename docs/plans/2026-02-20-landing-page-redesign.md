# Landing Page Redesign

## Date: 2026-02-20

## Context

The current landing page is a minimal splash screen: logo, generic tagline ("Gestao de condominios, simplificada"), one sentence, and a login button. It doesn't sell the product or capture leads.

Zelus needs a landing page that validates interest from other condominium administrators before opening access. The primary goal is a waitlist (name + email).

## Positioning

**Primary angle (E): Transparency for all residents.** Everyone deserves to know what's happening in their building. The building should be visible to all, not locked inside one admin's inbox.

**Supporting angle (B): Institutional memory.** The history that survives administration changes. Three admins in three years, and each time everything is lost.

**Supporting angle (C): End the chaos.** WhatsApp groups, lost emails, spreadsheets nobody can find, residents who can't get answers about regulations or assembly decisions.

**Brand layer:** The name Zelus comes from Latin, meaning vigilant care for what belongs to everyone.

## Target Audience

Admin moradores (elected resident administrators) in Portugal who are frustrated with professional management companies and/or the chaos of managing a building with informal tools (WhatsApp, email, spreadsheets).

## Page Structure

### Section 1: Hero

- Logo + brand name (existing components)
- **Headline:** "Todos os moradores merecem saber o que acontece no seu predio."
- **Subhead:** "O Zelus centraliza ocorrencias, manutencoes e documentos do condominio num unico lugar. Visivel para todos. Sem depender de grupos de WhatsApp, e-mails perdidos ou planilhas que ninguem encontra."
- Video placeholder (Remotion product demo, to be added later)
- Waitlist form: name + email + "Quero acesso antecipado" button
- Name origin note below form: "Do latim zelus: o cuidado vigilante pelo que e de todos."

### Section 2: Problem Agitation

- **Section title:** "Gerir um condominio nao devia ser assim."
- 4 pain-point cards:
  1. **Grupos de WhatsApp interminaveis** — "Quem chamou o canalizador? Quando foi? Ninguem sabe. A mensagem perdeu-se entre 200 outras."
  2. **E-mails e planilhas que ninguem encontra** — "O orcamento esta no e-mail do antigo administrador. A ata esta numa pasta no Drive. Ou era no Dropbox?"
  3. **Moradores sem visibilidade** — "O que foi decidido na ultima assembleia? O que esta em curso? Sem respostas, cresce a desconfianca."
  4. **Cada troca de administracao, recomeca-se do zero** — "Tres anos, tres administradoras. De cada vez, perde-se contactos, historial, contexto. Como se o predio nao tivesse memoria."

### Section 3: Solution (Benefits, Not Features)

- **Section title:** "Um lugar para tudo o que acontece no vosso predio."
- 3 benefit blocks:
  1. **Ocorrencias organizadas, do inicio ao fim** — Reportar problemas, acompanhar o estado, ver quem tratou e quando. Sem perseguir ninguem.
  2. **Historial que nao desaparece** — Manutencoes, intervencoes, fornecedores. Tudo registado. Muda a administracao, o conhecimento fica.
  3. **Perguntas respondidas sem incomodar ninguem** — O regulamento permite obras no terraco? Quando foi a ultima inspecao do elevador? O assistente encontra a resposta nos documentos do condominio.

### Section 4: Waitlist CTA (Repeated)

- **Text:** "Do latim zelus: o cuidado vigilante pelo que e de todos."
- **Subtext:** "O Zelus esta em fase de acesso antecipado. Deixe o seu nome para ser dos primeiros a experimentar."
- Waitlist form (repeated): name + email + "Quero acesso antecipado"

### Section 5: Footer

- Zelus (c) 2026

## Technical Notes

- Replace current `app/routes/index.tsx` single-screen layout with multi-section scrolling page
- Waitlist form submits to a route action that stores leads (new DB table or external service TBD)
- Video placeholder: empty container with play button overlay, to be replaced with Remotion embed later
- Keep existing brand components (AzulejoPattern, ZelusLogoTile)
- All copy in pt-PT (hardcoded for now, i18n later)
- Mobile-first, responsive
- Follow existing design system (system.md): rounded-2xl cards, whisper-quiet borders, cobalt blue accent

## Out of Scope

- Remotion video production (separate project)
- Waitlist admin dashboard
- Analytics/tracking integration
- i18n (copy is pt-PT only for now)

## Waitlist Data Model

- `waitlist_leads` table: id, name, email (unique), city (optional/removed per final decision), created_at
- Or: external service (Resend audience, Google Sheet, etc.)
- TBD during implementation planning

## Copy Quality Checklist

- [x] Headline is benefit-driven (transparency for residents)
- [x] Opening hook grabs attention (addresses real frustration)
- [x] Copy is specific (WhatsApp, Drive, Dropbox, canalizador)
- [x] Claims supported with relatable scenarios (not abstract)
- [x] Addresses reader's objections (implicit: "why not just use WhatsApp?")
- [x] Clear CTA ("Quero acesso antecipado")
- [x] Sounds human, not corporate
- [x] Zero em dashes in copy
