# Remotion Hero Video — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a 35-second auto-playing hero video for the landing page showing the real app with rich demo data.

**Architecture:** Rich seed script populates the DB, Playwright captures screenshots of each screen, Remotion composes them into an animated video with zoom/pan/transitions, exported as MP4/WebM and embedded in the landing page hero.

**Tech Stack:** Drizzle ORM (seed), Playwright (screenshots), Remotion (video composition), React Router v7 (landing page integration).

---

### Task 1: Create rich demo seed script

**Files:**

- Create: `scripts/seed-demo.ts`
- Reference: `scripts/seed.ts` (existing pattern)
- Reference: `app/lib/db/schema/index.ts` (all table exports)

**Step 1: Create `scripts/seed-demo.ts`**

This script creates a realistic condominium with residents, tickets, suppliers, maintenance records, notifications, and assistant conversations. It follows the same pattern as `scripts/seed.ts` but with much richer data.

Key data to seed:

- **Org:** "Edificio Sao Tome", Rua de Sao Tome 42, Lisboa, 12 fractions
- **Admin user:** Maria Santos (admin@zelus.sh, org_admin)
- **4 residents:** Joao Ferreira (approved), Ana Oliveira (approved), Carlos Mendes (pending), Sofia Costa (approved)
- **12 fractions** with user associations (Maria on 2 Esq., others assigned)
- **20 categories** (reuse existing category keys)
- **6 suppliers** with realistic Portuguese names and contacts
- **8 tickets** across all 4 statuses with comments, events, and attachments
- **3 maintenance records** with costs and supplier links
- **6 notifications** (unread, for Maria)
- **1 conversation** with 4 messages (2 user, 2 assistant)

Tables and columns to insert into (exact schema):

```
user: id, name, email, emailVerified, createdAt, updatedAt
account: id, accountId, providerId, userId, password, createdAt, updatedAt
organization: id, name, slug, city, totalFractions, notes, language, timezone, createdAt, metadata, logo
member: id, organizationId, userId, role, createdAt
fractions: id, orgId, label, description, createdAt
userFractions: id, orgId, userId, fractionId, role, status, invitedBy, approvedBy, createdAt
categories: key, createdAt
suppliers: id, orgId, name, category, contactName, contactPhone, email, notes, createdAt
tickets: id, orgId, fractionId, category, createdBy, title, description, status, priority, private, createdAt
ticketComments: id, orgId, ticketId, userId, content, createdAt
ticketEvents: id, orgId, ticketId, userId, fromStatus, toStatus, createdAt
maintenanceRecords: id, orgId, supplierId, title, description, performedAt, cost, createdBy, createdAt
notifications: id, orgId, userId, type, title, message, metadata, readAt, createdAt
conversations: id, orgId, userId, title, createdAt
conversationMessages: id, conversationId, role, content, createdAt
```

Important notes:

- All IDs are UUIDs via `crypto.randomUUID()`
- Password hash: `$2b$10$placeholder_hash_for_seed_only` (same as existing seed)
- Use `onConflictDoNothing()` for categories (they may already exist)
- Tickets need realistic `createdAt` dates spread over the last 2 months
- Maintenance records: costs as strings for numeric columns (e.g., `'450.00'`)
- Notifications for Maria: mix of ticket comments, association requests, status changes

**Step 2: Add npm script to package.json**

Add to `scripts` in `package.json`:

```json
"db:seed-demo": "bun run scripts/seed-demo.ts"
```

**Step 3: Run the seed and verify**

```bash
bun run db:seed-demo
```

Expected: Console output listing all created entities with counts.

**Step 4: Manually verify in browser**

Start dev server, log in as `admin@zelus.sh`, navigate through:

- `/admin/dashboard` — verify stat counts
- `/tickets` — verify 8 tickets in different states
- `/suppliers` — verify 6 suppliers
- `/maintenance` — verify 3 records
- `/fractions` — verify 12 fractions with user associations

**Step 5: Commit**

```bash
git add scripts/seed-demo.ts package.json
git commit -m "feat: add rich demo seed for video screenshots"
```

---

### Task 2: Install Playwright and create screenshot capture script

**Files:**

- Create: `scripts/capture-screenshots.ts`
- Modify: `package.json` (add playwright devDependency)

**Step 1: Install Playwright**

```bash
bun add -d playwright
bunx playwright install chromium
```

**Step 2: Create `scripts/capture-screenshots.ts`**

The script:

1. Launches Chromium at 1280x800 viewport
2. Navigates to `http://localhost:5173/login`
3. Logs in as `admin@zelus.sh` / `password123`
4. Captures screenshots of each screen in sequence:
   - `screenshots/01-dashboard.png` — `/admin/dashboard`
   - `screenshots/02-tickets.png` — `/tickets`
   - `screenshots/03-ticket-detail.png` — `/tickets/{elevador-ticket-id}` (find by title)
   - `screenshots/04-fractions.png` — `/fractions`
   - `screenshots/05-assistant.png` — `/assistant/{conversation-id}`
   - `screenshots/06-suppliers.png` — `/suppliers`
5. Each screenshot: wait for network idle, wait 500ms for animations, then capture

Important: The script needs the dev server running separately. It connects to `localhost:5173`.

Output directory: `video/screenshots/` (gitignored, generated on demand).

**Step 3: Add npm script**

```json
"video:capture": "bun run scripts/capture-screenshots.ts"
```

**Step 4: Run and verify screenshots**

```bash
bun run dev &  # start dev server in background
bun run video:capture
```

Expected: 6 PNG files in `video/screenshots/`, each 1280x800.

**Step 5: Commit**

```bash
git add scripts/capture-screenshots.ts package.json
git commit -m "feat: add Playwright screenshot capture script"
```

---

### Task 3: Set up Remotion project

**Files:**

- Create: `video/remotion.config.ts`
- Create: `video/src/Root.tsx`
- Create: `video/src/HeroVideo.tsx`
- Create: `video/src/scenes/DashboardScene.tsx`
- Create: `video/src/scenes/TicketsScene.tsx`
- Create: `video/src/scenes/TicketDetailScene.tsx`
- Create: `video/src/scenes/FractionsScene.tsx`
- Create: `video/src/scenes/AssistantScene.tsx`
- Create: `video/src/scenes/SuppliersScene.tsx`
- Create: `video/src/scenes/BrandScene.tsx`
- Create: `video/src/components/AnimatedScreenshot.tsx`
- Create: `video/tsconfig.json`
- Create: `video/package.json`

**Step 1: Initialize Remotion project**

```bash
mkdir -p video
cd video
bun init -y
bun add remotion @remotion/cli @remotion/renderer
```

Create `video/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

**Step 2: Create `video/remotion.config.ts`**

Standard Remotion config with 30fps, 1280x720 output (16:9 aspect ratio matching the landing page placeholder).

**Step 3: Create `video/src/Root.tsx`**

Register the `HeroVideo` composition:

- Duration: 35 seconds at 30fps = 1050 frames
- Resolution: 1280x720
- FPS: 30

**Step 4: Create `video/src/components/AnimatedScreenshot.tsx`**

Reusable component that:

- Takes a screenshot image `src` prop
- Applies zoom/pan animation using Remotion's `interpolate()` and `spring()`
- Configurable: `startScale`, `endScale`, `panX`, `panY`
- Clips to frame bounds with `overflow: hidden`

**Step 5: Create 7 scene components**

Each scene imports the corresponding screenshot from `../screenshots/` and uses `AnimatedScreenshot` with scene-specific animation parameters:

1. **DashboardScene** — Fade in from black, slow zoom into stat cards
2. **TicketsScene** — Slight left-to-right pan across the kanban columns
3. **TicketDetailScene** — Zoom into the ticket, slight downward scroll
4. **FractionsScene** — Gentle zoom on the fraction grid
5. **AssistantScene** — Focus on conversation area, slight zoom
6. **SuppliersScene** — Gentle pan down the supplier list
7. **BrandScene** — Zelus logo + tagline centered, fade in from white. This is NOT a screenshot — it's rendered as React with the logo SVG, brand text, and URL.

**Step 6: Create `video/src/HeroVideo.tsx`**

Main composition that sequences all 7 scenes using Remotion's `<Series>`:

```
Scene 1: frames 0-119    (4s)
Scene 2: frames 120-299  (6s)
Scene 3: frames 300-479  (6s)
Scene 4: frames 480-629  (5s)
Scene 5: frames 630-809  (6s)
Scene 6: frames 810-959  (5s)
Scene 7: frames 960-1049 (3s)
```

Cross-fade transitions: Each scene fades in over the first 15 frames and fades out over the last 15 frames (overlapping with next scene).

**Step 7: Preview in Remotion Studio**

```bash
cd video
bunx remotion studio
```

Expected: Browser opens with Remotion Studio showing the composition timeline.

**Step 8: Commit**

```bash
git add video/
git commit -m "feat: set up Remotion project with scene compositions"
```

---

### Task 4: Render and export video

**Files:**

- Create: `video/render.ts`
- Modify: root `package.json` (add render script)
- Output: `public/hero.mp4`, `public/hero.webm`

**Step 1: Create `video/render.ts`**

Script that renders the composition to both formats:

- MP4 (H.264) for Safari compatibility
- WebM (VP9) for Chrome/Firefox (smaller file)

Both output to `../public/` in the root project.

**Step 2: Add npm scripts to root `package.json`**

```json
"video:render": "cd video && bun run render.ts",
"video:studio": "cd video && bunx remotion studio",
"video:all": "bun run video:capture && bun run video:render"
```

**Step 3: Render and verify**

```bash
bun run video:render
```

Expected: `public/hero.mp4` and `public/hero.webm` created, ~2-5MB each.

**Step 4: Commit**

```bash
git add video/render.ts package.json public/hero.mp4 public/hero.webm
git commit -m "feat: render hero video as MP4 and WebM"
```

---

### Task 5: Integrate video into landing page

**Files:**

- Modify: `app/routes/index.tsx` (replace placeholder with video)

**Step 1: Replace the placeholder div**

In `app/routes/index.tsx`, find the placeholder:

```tsx
<div className="bg-muted/50 ring-foreground/10 flex aspect-video w-full max-w-2xl items-center justify-center rounded-2xl ring-1">
  <span className="text-muted-foreground text-sm">Screenshot em breve</span>
</div>
```

Replace with:

```tsx
<div className="ring-foreground/10 w-full max-w-2xl overflow-hidden rounded-2xl ring-1">
  <video
    autoPlay
    muted
    loop
    playsInline
    className="aspect-video w-full"
    poster="/screenshots/01-dashboard.png"
  >
    <source src="/hero.webm" type="video/webm" />
    <source src="/hero.mp4" type="video/mp4" />
  </video>
</div>
```

Notes:

- `playsInline` required for iOS autoplay
- `poster` shows first frame before video loads
- WebM source first (smaller, preferred by modern browsers)
- MP4 fallback for Safari

**Step 2: Verify in browser**

```bash
bun run dev
```

Navigate to `http://localhost:5173` — video should autoplay in the hero section.

**Step 3: Commit**

```bash
git add app/routes/index.tsx
git commit -m "feat: embed hero video in landing page"
```

---

### Task 6: Gitignore and cleanup

**Files:**

- Modify: `.gitignore`
- Delete: `scripts/og.svg` (no longer needed, was a build artifact)

**Step 1: Add video build artifacts to `.gitignore`**

```
# Video build artifacts
video/screenshots/
video/node_modules/
video/dist/
```

Note: `public/hero.mp4` and `public/hero.webm` are NOT gitignored — they're shipped to production.

**Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore video build artifacts"
```

---

### Task 7: Create PR

```bash
gh pr create --title "feat: add hero video with rich demo data" --body "$(cat <<'EOF'
## Summary
- Rich demo seed script with realistic Portuguese condominium data (12 fractions, 5 residents, 8 tickets, 6 suppliers, 3 maintenance records, notifications, assistant conversation)
- Playwright screenshot capture script for automated screen grabs
- Remotion project composing screenshots into a 35s animated walkthrough
- Landing page hero updated with auto-playing video loop

## Test plan
- [ ] Run `bun run db:seed-demo` and verify data in browser
- [ ] Run `bun run video:capture` and verify 6 screenshots
- [ ] Run `bun run video:studio` and preview in Remotion
- [ ] Run `bun run video:render` and verify MP4/WebM output
- [ ] Visit landing page and verify video autoplays in hero
- [ ] Test on mobile (iOS Safari) — video should autoplay with playsInline
EOF
)"
```
