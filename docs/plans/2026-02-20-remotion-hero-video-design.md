# Remotion Hero Video — Design

## Goal

30-35s walkthrough video for the landing page hero, replacing the "Screenshot em breve" placeholder. Silent, auto-playing, looping. Shows the real product with rich seed data.

## Approach

**Screenshot Pipeline (Approach A):**

1. Rich seed data simulating a real condominium
2. Playwright captures screenshots of each screen programmatically
3. Remotion composes screenshots with animations (zoom, pan, cursor, transitions)
4. Export as MP4/WebM for the landing page

## Seed Data

**Condominium:** "Edificio Sao Tome" - Rua de Sao Tome 42, Lisboa - 12 fractions

**Fractions** (6 floors x 2): R/C Esq. (T1) through 5 Dir. (T3)

**5 Residents:**

- Maria Santos — Admin (org_admin), 2 Esq.
- Joao Ferreira — Approved resident, 1 Dir.
- Ana Oliveira — Approved resident, 3 Esq.
- Carlos Mendes — Pending approval, R/C Dir.
- Sofia Costa — Approved resident, 4 Dir.

**8 Tickets** (mixed states and categories):

1. Resolved — "Fuga de agua na garagem" (plumbing, urgent)
2. In Progress — "Elevador parado no 3 andar" (elevators, high)
3. Open — "Lampada fundida no hall do 2" (common lighting, low)
4. Open — "Porta da entrada nao fecha" (locksmith, medium)
5. In Progress — "Infiltracao na cobertura" (structural, high)
6. Resolved — "Intercomunicador avariado no 1" (intercom)
7. Closed — "Pintura das escadas" (painting)
8. Open — "Baratas no patio interior" (pest control, medium)

Each with 2-3 comments, status events, and 1-2 photo attachments.

**6 Suppliers:**

- Canalizacoes Silva, Lda. (plumbing)
- ElevaTecnica (elevators)
- EletricoLuz (electricity)
- PintaFacil (painting)
- PragaZero (pest control)
- TelhaSegura, Lda. (roofing)

**3 Maintenance Records:**

- Elevator revision (450 EUR, ElevaTecnica, 2 months ago)
- Main pipe unclogging (280 EUR, Canalizacoes Silva, 1 month ago)
- Stairway painting (1200 EUR, PintaFacil, 3 weeks ago)

**5-6 Unread Notifications** for Maria.

**1 Assistant Conversation:**

- Maria: "Quais as ocorrencias abertas esta semana?"
- Assistant responds with the 3 open tickets.
- Maria: "Qual o prestador de elevadores?"
- Assistant responds with ElevaTecnica contact.

## Storyboard (35s)

Perspective: Maria Santos (admin). Each scene is a real screenshot, animated with zoom/pan.

| #   | Time   | Screen                            | Animation                                      | Shows                                                          |
| --- | ------ | --------------------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| 1   | 0-4s   | Admin Dashboard                   | Fade in, zoom on stat cards                    | 8 tickets, 12 fractions, 6 suppliers, 3 maintenance            |
| 2   | 4-10s  | Tickets list                      | Horizontal pan across 4 status columns         | Kanban with 8 tickets, colored badges, categories              |
| 3   | 10-16s | Ticket detail — "Elevador parado" | Zoom into ticket, scroll through comments      | Title, high priority, 3 comments, status timeline, photo       |
| 4   | 16-21s | Fractions                         | Transition to fraction grid with azulejo hover | 12 fractions, Carlos Mendes "pending" visible                  |
| 5   | 21-27s | Assistant                         | Typing animation in conversation               | Maria asks, assistant responds with open tickets               |
| 6   | 27-32s | Suppliers                         | Supplier list with cards                       | 6 suppliers with categories and contacts                       |
| 7   | 32-35s | Brand card                        | Zoom out, fade to logo                         | Zelus logo + "Gestao de condominios, simplificada." + zelus.sh |

**Transitions:** Cross-fade (300ms) between scenes.
**Cursor:** Ghost cursor appears before each "interaction".
**Loop:** Scene 7 fades back to scene 1.

## Technical Stack

- **Seed:** `scripts/seed-demo.ts` — separate from existing seed, richer data
- **Screenshots:** Playwright script — starts dev server, logs in as Maria, navigates each route, captures at 1280x800
- **Video:** Remotion project in `video/` directory — composes screenshots with spring animations
- **Export:** MP4 (H.264) + WebM (VP9) for browser compatibility
- **Integration:** `<video>` tag in landing page hero replacing the placeholder div

## Output

- `public/hero.mp4` — H.264 for Safari/older browsers
- `public/hero.webm` — VP9 for Chrome/Firefox (smaller file)
- Landing page hero updated with `<video autoPlay muted loop playsInline>`
