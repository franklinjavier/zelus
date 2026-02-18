# Zelus Design System

## Intent

**Who:** Condominium administrators and residents in Portugal. Non-technical, often elderly users accessing between errands — on phones or older laptops. Admins after hours approving access, residents checking ticket status.

**Task:** Approve association requests. File and track maintenance tickets. Find supplier contacts. Review history. Practical, operational work.

**Feel:** Trustworthy like a building's front desk — orderly, quiet, competent. The feeling of a well-kept ledger. Warm enough to not feel institutional, structured enough to feel safe. Whisper-quiet surfaces, generous whitespace, monochrome base with a single blue accent.

## Domain

Portuguese residential buildings — limestone facades, azulejo tile patterns, cobalt blue ceramics, iron railings, courtyards behind heavy doors.

## Palette

- **Primary:** Cobalt blue (OKLCH hue ~260) — the blue of Portuguese azulejo tiles
- **Neutrals:** Warm grays — limestone calm
- **Destructive:** Warm red (OKLCH hue ~27)
- All colors defined as OKLCH CSS variables in `app/app.css`
- Light and dark modes supported via `.dark` class
- **Monochrome base:** UI is almost entirely grayscale. Color only appears where it means something (primary actions, status indicators)

## Depth

- **Borders over shadows** — flat, tiled surfaces like azulejo grout lines
- `ring-1 ring-foreground/10` for card borders — whisper-quiet, barely visible (maia default)
- `hover:ring-primary/20` for hover ring shift on interactive cards
- No drop shadows on cards or containers
- Depth conveyed through background color shifts between surface levels

## Surfaces

- **Level 0:** `--background` (page)
- **Level 1:** `--card` (cards, panels)
- **Level 2:** `--muted` (nested sections, table headers)
- **Level 3:** `--accent` (hover states, active items)
- Temperature: neutral-cool in light mode, warm-dark in dark mode

## Typography

- **Primary:** Inter (via `@fontsource-variable/inter`) — humanist clarity, excellent legibility
- Body: text-sm (14px) minimum — never use text-xs for user-facing content
- Labels, metadata, secondary text: text-sm (14px) minimum
- Primary content: text-sm to text-base (14–16px)
- Sidebar navigation: text-base (16px)
- Stat numbers: text-3xl font-medium tracking-tight tabular-nums
- Stat labels: text-sm font-medium text-muted-foreground
- Page titles: text-lg font-semibold tracking-tight

## Spacing

- **Base unit:** 16px (1rem)
- Cards: `p-5` (20px) padding for CardLink, `py-6 px-6` for shadcn Card (maia default)
- Grid gaps: `gap-4` (16px) between cards
- Form fields: `gap-4` (16px) between fields
- Sidebar menu: `gap-1` between items (maia default), `px-3 py-2` button padding

## Radius — Maia Style

shadcn `base-maia` style provides the generous rounding natively. Base: `--radius: 1rem` (16px).

- **Buttons:** `rounded-4xl` (32px) — maia default, very rounded pill-like shape
- **Inputs:** `rounded-4xl` (32px) — matching buttons
- **Cards:** `rounded-2xl` (24px) — large, friendly containers
- **Textareas:** `rounded-xl` (20px)
- **Sidebar menu buttons:** `rounded-xl` (customized from maia's rounded-lg)
- **Feedback messages:** `rounded-xl`
- **Icon containers:** `rounded-xl`

## Sizing

- **Buttons:** h-8 (32px) default (size="sm"), use size="lg" (h-10) for prominent actions
- **Inputs:** h-10 (40px, customized from maia's h-9)
- **Selects:** h-10 (40px), matching inputs
- **Textareas:** same horizontal padding as inputs (px-3)
- **Sidebar menu buttons:** h-9 (36px, maia default)
- **Icon buttons:** minimum size-8 (32px)

## Interactive States

- **Cursor:** All clickable elements (`a`, `button`, `select`, `[role='button']`, submit/button/reset inputs) use `cursor-pointer` globally via `app.css`
- **Card hover:** `hover:ring-primary/20` ring shift + azulejo overlay fade-in
- **Button hover:** variant-specific (see button.tsx CVA config)

## Brand Components

### AzulejoOverlay (`~/components/brand/azulejo-overlay`)

SVG tile pattern overlay that fades in on `group-hover`. Drop inside any container with `group` + `relative` + `overflow-hidden`.

Props:

- `opacity` (default: 0.1) — pattern intensity
- `className` — additional classes

Pattern: 48px tiles with diamond center, corner arcs, center dot. Uses `text-primary` color.

### CardLink (`~/components/brand/card-link`)

Clickable card that wraps a `<Link>` with consistent card styling + AzulejoOverlay hover.

Props:

- `to` (required) — link destination
- `className` — override/extend card styles
- `children` — card content (automatically wrapped in `relative` container)

Base styles: `bg-card ring-1 ring-foreground/10 hover:ring-primary/20 rounded-2xl p-5 overflow-hidden`

Use for: fraction tiles, dashboard stat cards, any clickable card-like navigation.

## List Items — Card-per-Item Pattern

The standard pattern for rendering lists (members, notifications, categories, etc.):

- **Container:** `flex flex-col gap-2` — tight vertical stack
- **Item:** `flex items-center gap-3 rounded-2xl p-3 ring-1 ring-foreground/5` — compact card with whisper-quiet border
- **Icon container:** `flex size-9 shrink-0 items-center justify-center rounded-xl` + contextual `bg-{color}/10 text-{color}`
- **Text:** `text-sm font-medium` for primary, `text-muted-foreground text-sm` for secondary
- **Section heading:** lightweight `h2 text-sm font-medium` with muted count — not a heavy Card header
- **Empty state:** dashed border container (`rounded-2xl border border-dashed py-10`) with centered icon + message

Variations:

- **Unread/active:** `bg-primary/5 ring-primary/10` with colored icon
- **Read/muted:** `bg-muted/30 ring-foreground/5` with muted icon
- **Clickable:** wrap item in `<Link>` with `className="block"`
- **Status gradients:** `bg-gradient-to-b from-{color}/5 to-transparent` on kanban cards

Do NOT wrap lists in a `<Card>` with `CardHeader`/`CardContent` — use the flat card-per-item pattern instead.

## Components

- Built on **shadcn/ui** (`base-maia` style — soft, rounded, generous spacing) + **@base-ui/react** headless primitives
- Variants via **class-variance-authority** (CVA)
- Class merging via `cn()` from `~/lib/utils`
- `data-slot` attributes for styling scopes
- Icons: `@hugeicons/react` + `@hugeicons/core-free-icons`
- `ui/` folder is shadcn-managed — re-add with `bunx shadcn@latest add [component] --overwrite`
- Custom overrides on top of maia: button default size `sm`, input `h-10`, sidebar `text-base` + `rounded-xl`

## Accessibility

- **Target audience:** Elderly, non-technical users in Portugal
- **Minimum touch targets:** 36px (h-9), prefer 40px (h-10) for primary actions
- **Minimum text size:** text-sm (14px) for all user-facing content — no text-xs
- **Color contrast:** --muted-foreground at oklch(0.45) for 4.5:1+ ratio on white
- **Interactive elements:** Buttons h-10 default, inputs h-10, selects h-10
- **Icon buttons:** Minimum size-8 (32px) with visible tooltips

## Signature Element

The azulejo tile pattern that reveals on hover — Portuguese identity embedded in the interaction itself. Maia's generous rounded-4xl buttons and rounded-2xl cards provide the soft, approachable foundation. Whisper-quiet card borders with a subtle primary ring shift on hover. Information-forward, no decorative noise. The roundness feels warm and approachable — like friendly building signage rather than institutional forms.
