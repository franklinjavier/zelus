# Announcements (Avisos) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an announcements system where admins create notices (one-time or recurring) that display on the home page and notify all org members via in-app notification + email.

**Architecture:** New `announcements` table with JSONB recurrence column. Service layer handles CRUD + next-occurrence calculation. Admin CRUD routes under `/admin/announcements`. Home page loader fetches active announcements. Notification broadcast on creation reuses existing `notifications` table + Resend email.

**Tech Stack:** Drizzle ORM, React Router v7 (loaders/actions), Zod validation, Resend email, shadcn/ui components, HugeIcons.

---

### Task 1: Database Schema

**Files:**

- Create: `app/lib/db/schema/announcements.ts`
- Modify: `app/lib/db/schema/index.ts`

**Step 1: Create the schema file**

```ts
// app/lib/db/schema/announcements.ts
import { pgTable, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'

import { organization, user } from './auth'

export const announcements = pgTable(
  'announcements',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orgId: text('org_id')
      .notNull()
      .references(() => organization.id),
    title: text('title').notNull(),
    description: text('description').notNull(),
    eventDate: timestamp('event_date').notNull(),
    recurrence: jsonb('recurrence'),
    pausedAt: timestamp('paused_at'),
    archivedAt: timestamp('archived_at'),
    createdById: text('created_by_id')
      .notNull()
      .references(() => user.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('announcements_org_idx').on(t.orgId)],
)
```

**Step 2: Add export to schema index**

Add `export * from './announcements'` to `app/lib/db/schema/index.ts`.

**Step 3: Generate migration**

Run: `bun run db:generate add-announcements`

**Step 4: Apply migration**

Run: `bun run db:migrate`

**Step 5: Typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add app/lib/db/schema/announcements.ts app/lib/db/schema/index.ts app/lib/db/migrations/
git commit -m "feat(announcements): add announcements table schema"
```

---

### Task 2: Recurrence Utility — `getNextOccurrence`

**Files:**

- Create: `app/lib/announcements/recurrence.ts`
- Create: `app/lib/announcements/__tests__/recurrence.test.ts`

**Step 1: Write the tests**

```ts
// app/lib/announcements/__tests__/recurrence.test.ts
import { describe, it, expect } from 'vitest'
import { getNextOccurrence, type Recurrence } from '../recurrence'

describe('getNextOccurrence', () => {
  // Helper: create a date at midnight UTC
  const d = (s: string) => new Date(`${s}T09:00:00.000Z`)

  it('returns eventDate for one-time future event', () => {
    const result = getNextOccurrence(d('2026-04-01'), null, d('2026-03-01'))
    expect(result).toEqual(d('2026-04-01'))
  })

  it('returns null for one-time past event', () => {
    const result = getNextOccurrence(d('2026-02-01'), null, d('2026-03-01'))
    expect(result).toBeNull()
  })

  it('returns next weekly occurrence — same day of week in future', () => {
    // eventDate is a Friday (2026-03-06), recurrence every Friday
    const rec: Recurrence = {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [5], // Friday
      endType: 'never',
    }
    // now is Wednesday 2026-03-11, next Friday is 2026-03-13
    const result = getNextOccurrence(d('2026-03-06'), rec, d('2026-03-11'))
    expect(result).toEqual(d('2026-03-13'))
  })

  it('returns today if today matches a recurring day', () => {
    const rec: Recurrence = {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [3], // Wednesday
      endType: 'never',
    }
    // now is Wednesday 2026-03-11
    const result = getNextOccurrence(d('2026-03-04'), rec, d('2026-03-11'))
    expect(result).toEqual(d('2026-03-11'))
  })

  it('handles biweekly recurrence', () => {
    const rec: Recurrence = {
      frequency: 'weekly',
      interval: 2,
      daysOfWeek: [5], // Friday
      endType: 'never',
    }
    // eventDate Fri 2026-03-06, now is Sat 2026-03-07
    // next valid Friday is 2026-03-20 (2 weeks from eventDate)
    const result = getNextOccurrence(d('2026-03-06'), rec, d('2026-03-07'))
    expect(result).toEqual(d('2026-03-20'))
  })

  it('returns null when endDate has passed', () => {
    const rec: Recurrence = {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [5],
      endType: 'date',
      endDate: '2026-03-01',
    }
    const result = getNextOccurrence(d('2026-02-01'), rec, d('2026-03-05'))
    expect(result).toBeNull()
  })

  it('returns null when endCount is exhausted', () => {
    const rec: Recurrence = {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [5],
      endType: 'count',
      endCount: 2,
    }
    // eventDate Fri 2026-03-06, after 2 occurrences (Mar 6, Mar 13), done
    // now is 2026-03-14
    const result = getNextOccurrence(d('2026-03-06'), rec, d('2026-03-14'))
    expect(result).toBeNull()
  })

  it('handles monthly recurrence on specific day', () => {
    const rec: Recurrence = {
      frequency: 'monthly',
      interval: 1,
      dayOfMonth: 15,
      endType: 'never',
    }
    // eventDate Jan 15, now is Mar 20 → next is Apr 15
    const result = getNextOccurrence(d('2026-01-15'), rec, d('2026-03-20'))
    expect(result).toEqual(d('2026-04-15'))
  })

  it('returns current month if day has not passed yet', () => {
    const rec: Recurrence = {
      frequency: 'monthly',
      interval: 1,
      dayOfMonth: 15,
      endType: 'never',
    }
    // now is Mar 10 → next is Mar 15
    const result = getNextOccurrence(d('2026-01-15'), rec, d('2026-03-10'))
    expect(result).toEqual(d('2026-03-15'))
  })

  it('does not return occurrence before eventDate', () => {
    const rec: Recurrence = {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [1], // Monday
      endType: 'never',
    }
    // eventDate is Wed Mar 11, now is Mon Mar 9 → should be Mon Mar 16 (first Mon >= eventDate)
    const result = getNextOccurrence(d('2026-03-11'), rec, d('2026-03-09'))
    expect(result).toEqual(d('2026-03-16'))
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `bun run test -- app/lib/announcements/__tests__/recurrence.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement `getNextOccurrence`**

```ts
// app/lib/announcements/recurrence.ts
export type Recurrence = {
  frequency: 'weekly' | 'monthly'
  interval: number
  daysOfWeek?: number[]
  dayOfMonth?: number
  endType: 'never' | 'date' | 'count'
  endDate?: string
  endCount?: number
}

/**
 * Compute the next occurrence of an announcement >= now.
 * Returns null if the announcement has expired or all occurrences are exhausted.
 */
export function getNextOccurrence(
  eventDate: Date,
  recurrence: Recurrence | null,
  now: Date = new Date(),
): Date | null {
  if (!recurrence) {
    return eventDate >= now ? eventDate : null
  }

  if (recurrence.endType === 'date' && recurrence.endDate) {
    const end = new Date(`${recurrence.endDate}T23:59:59.999Z`)
    if (now > end) return null
  }

  if (recurrence.frequency === 'weekly') {
    return getNextWeekly(eventDate, recurrence, now)
  }

  if (recurrence.frequency === 'monthly') {
    return getNextMonthly(eventDate, recurrence, now)
  }

  return null
}

function getNextWeekly(eventDate: Date, rec: Recurrence, now: Date): Date | null {
  const days = rec.daysOfWeek ?? [eventDate.getUTCDay()]
  const interval = rec.interval || 1

  // Find the reference start-of-week (Monday) for the eventDate
  const eventDay = eventDate.getUTCDay()
  const eventMonday = new Date(eventDate)
  eventMonday.setUTCDate(eventDate.getUTCDate() - ((eventDay + 6) % 7))
  eventMonday.setUTCHours(0, 0, 0, 0)

  // Current Monday
  const nowDay = now.getUTCDay()
  const nowMonday = new Date(now)
  nowMonday.setUTCDate(now.getUTCDate() - ((nowDay + 6) % 7))
  nowMonday.setUTCHours(0, 0, 0, 0)

  // Calculate weeks since event start
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const weeksSinceStart = Math.floor((nowMonday.getTime() - eventMonday.getTime()) / msPerWeek)

  // Find the nearest valid week >= nowMonday that aligns with interval
  let startWeekOffset = weeksSinceStart < 0 ? 0 : weeksSinceStart
  if (startWeekOffset % interval !== 0) {
    startWeekOffset += interval - (startWeekOffset % interval)
  }

  // Check current interval week and next — enough to find next occurrence
  let occurrenceCount = 0

  // Count occurrences before startWeekOffset for endCount check
  if (rec.endType === 'count' && rec.endCount) {
    occurrenceCount = countOccurrencesBefore(
      eventDate,
      days,
      interval,
      eventMonday,
      startWeekOffset,
    )
  }

  for (let w = startWeekOffset; w <= startWeekOffset + interval; w += interval) {
    const weekMonday = new Date(eventMonday.getTime() + w * msPerWeek)

    for (const dayOfWeek of days.sort((a, b) => a - b)) {
      // Convert Sunday=0 to Monday-based offset
      const offset = (dayOfWeek + 6) % 7
      const candidate = new Date(weekMonday)
      candidate.setUTCDate(weekMonday.getUTCDate() + offset)
      candidate.setUTCHours(eventDate.getUTCHours(), eventDate.getUTCMinutes(), 0, 0)

      if (candidate < eventDate) continue
      if (candidate < now) {
        if (rec.endType === 'count') occurrenceCount++
        continue
      }

      if (rec.endType === 'count' && rec.endCount && occurrenceCount >= rec.endCount) {
        return null
      }
      if (rec.endType === 'date' && rec.endDate) {
        const end = new Date(`${rec.endDate}T23:59:59.999Z`)
        if (candidate > end) return null
      }

      return candidate
    }

    if (rec.endType === 'count') {
      occurrenceCount += days.length
    }
  }

  return null
}

function countOccurrencesBefore(
  eventDate: Date,
  days: number[],
  interval: number,
  eventMonday: Date,
  upToWeekOffset: number,
): number {
  let count = 0
  const msPerWeek = 7 * 24 * 60 * 60 * 1000

  for (let w = 0; w < upToWeekOffset; w += interval) {
    const weekMonday = new Date(eventMonday.getTime() + w * msPerWeek)
    for (const dayOfWeek of days) {
      const offset = (dayOfWeek + 6) % 7
      const candidate = new Date(weekMonday)
      candidate.setUTCDate(weekMonday.getUTCDate() + offset)
      candidate.setUTCHours(eventDate.getUTCHours(), eventDate.getUTCMinutes(), 0, 0)
      if (candidate >= eventDate) count++
    }
  }

  return count
}

function getNextMonthly(eventDate: Date, rec: Recurrence, now: Date): Date | null {
  const interval = rec.interval || 1
  const dayOfMonth = rec.dayOfMonth ?? eventDate.getUTCDate()

  // Start from eventDate's month
  const startYear = eventDate.getUTCFullYear()
  const startMonth = eventDate.getUTCMonth()

  // Current month
  const nowYear = now.getUTCFullYear()
  const nowMonth = now.getUTCMonth()

  // Months since start
  const monthsSinceStart = (nowYear - startYear) * 12 + (nowMonth - startMonth)

  let startMonthOffset = monthsSinceStart < 0 ? 0 : monthsSinceStart
  if (startMonthOffset % interval !== 0) {
    startMonthOffset += interval - (startMonthOffset % interval)
  }

  // Try current aligned month and next
  for (let m = startMonthOffset; m <= startMonthOffset + interval; m += interval) {
    const totalMonth = startMonth + m
    const year = startYear + Math.floor(totalMonth / 12)
    const month = totalMonth % 12

    // Clamp day to valid range for month
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const day = Math.min(dayOfMonth, daysInMonth)

    const candidate = new Date(
      Date.UTC(year, month, day, eventDate.getUTCHours(), eventDate.getUTCMinutes(), 0, 0),
    )

    if (candidate < eventDate) continue
    if (candidate < now) continue

    if (rec.endType === 'count' && rec.endCount) {
      const occurrences = Math.floor(m / interval)
      if (occurrences >= rec.endCount) return null
    }
    if (rec.endType === 'date' && rec.endDate) {
      const end = new Date(`${rec.endDate}T23:59:59.999Z`)
      if (candidate > end) return null
    }

    return candidate
  }

  return null
}
```

**Step 4: Run tests**

Run: `bun run test -- app/lib/announcements/__tests__/recurrence.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/lib/announcements/
git commit -m "feat(announcements): add recurrence calculation utility with tests"
```

---

### Task 3: Service Layer — CRUD + Broadcast

**Files:**

- Create: `app/lib/services/announcements.server.ts`

**Step 1: Create service file**

```ts
// app/lib/services/announcements.server.ts
import { eq, and, isNull, isNotNull, desc, sql } from 'drizzle-orm'

import { db } from '~/lib/db'
import { announcements, member, user } from '~/lib/db/schema'
import { logAuditEvent } from './audit.server'
import { createNotification } from './notifications.server'
import { sendEmail } from '~/lib/email/client'
import { announcementEmail } from '~/lib/email/templates/announcement'
import { getNextOccurrence, type Recurrence } from '~/lib/announcements/recurrence'

export async function createAnnouncement(
  orgId: string,
  data: {
    title: string
    description: string
    eventDate: Date
    recurrence: Recurrence | null
  },
  userId: string,
) {
  const [announcement] = await db
    .insert(announcements)
    .values({
      orgId,
      title: data.title,
      description: data.description,
      eventDate: data.eventDate,
      recurrence: data.recurrence,
      createdById: userId,
    })
    .returning()

  await logAuditEvent({
    orgId,
    userId,
    action: 'announcement.created',
    entityType: 'announcement',
    entityId: announcement.id,
    metadata: { title: data.title },
  })

  return announcement
}

export async function broadcastAnnouncement(
  orgId: string,
  orgName: string,
  announcement: { id: string; title: string; description: string; eventDate: Date },
  creatorId: string,
) {
  // Get all org members except the creator
  const members = await db
    .select({ userId: member.userId, email: user.email })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, orgId))

  const truncatedDesc =
    announcement.description.length > 200
      ? announcement.description.slice(0, 200) + '...'
      : announcement.description

  const promises: Promise<unknown>[] = []

  for (const m of members) {
    // In-app notification for everyone (including creator, for consistency)
    promises.push(
      createNotification({
        orgId,
        userId: m.userId,
        type: 'announcement',
        title: announcement.title,
        message: truncatedDesc,
        metadata: { announcementId: announcement.id },
      }),
    )

    // Email
    if (m.email) {
      const { subject, html } = announcementEmail({
        orgName,
        title: announcement.title,
        description: announcement.description,
        eventDate: announcement.eventDate,
      })
      promises.push(sendEmail({ to: m.email, subject, html }))
    }
  }

  await Promise.allSettled(promises)
}

export async function updateAnnouncement(
  orgId: string,
  id: string,
  data: {
    title: string
    description: string
    eventDate: Date
    recurrence: Recurrence | null
  },
  userId: string,
) {
  const [updated] = await db
    .update(announcements)
    .set({
      title: data.title,
      description: data.description,
      eventDate: data.eventDate,
      recurrence: data.recurrence,
    })
    .where(and(eq(announcements.id, id), eq(announcements.orgId, orgId)))
    .returning()

  if (updated) {
    await logAuditEvent({
      orgId,
      userId,
      action: 'announcement.updated',
      entityType: 'announcement',
      entityId: id,
      metadata: { title: data.title },
    })
  }

  return updated ?? null
}

export async function archiveAnnouncement(orgId: string, id: string, userId: string) {
  const [updated] = await db
    .update(announcements)
    .set({ archivedAt: new Date() })
    .where(and(eq(announcements.id, id), eq(announcements.orgId, orgId)))
    .returning()

  if (updated) {
    await logAuditEvent({
      orgId,
      userId,
      action: 'announcement.archived',
      entityType: 'announcement',
      entityId: id,
      metadata: { title: updated.title },
    })
  }

  return updated ?? null
}

export async function unarchiveAnnouncement(orgId: string, id: string, userId: string) {
  const [updated] = await db
    .update(announcements)
    .set({ archivedAt: null })
    .where(and(eq(announcements.id, id), eq(announcements.orgId, orgId)))
    .returning()

  if (updated) {
    await logAuditEvent({
      orgId,
      userId,
      action: 'announcement.unarchived',
      entityType: 'announcement',
      entityId: id,
      metadata: { title: updated.title },
    })
  }

  return updated ?? null
}

export async function pauseAnnouncement(orgId: string, id: string, userId: string) {
  const [updated] = await db
    .update(announcements)
    .set({ pausedAt: new Date() })
    .where(and(eq(announcements.id, id), eq(announcements.orgId, orgId)))
    .returning()

  if (updated) {
    await logAuditEvent({
      orgId,
      userId,
      action: 'announcement.paused',
      entityType: 'announcement',
      entityId: id,
      metadata: { title: updated.title },
    })
  }

  return updated ?? null
}

export async function resumeAnnouncement(orgId: string, id: string, userId: string) {
  const [updated] = await db
    .update(announcements)
    .set({ pausedAt: null })
    .where(and(eq(announcements.id, id), eq(announcements.orgId, orgId)))
    .returning()

  if (updated) {
    await logAuditEvent({
      orgId,
      userId,
      action: 'announcement.resumed',
      entityType: 'announcement',
      entityId: id,
      metadata: { title: updated.title },
    })
  }

  return updated ?? null
}

export async function deleteAnnouncement(orgId: string, id: string, userId: string) {
  const [deleted] = await db
    .delete(announcements)
    .where(and(eq(announcements.id, id), eq(announcements.orgId, orgId)))
    .returning()

  if (deleted) {
    await logAuditEvent({
      orgId,
      userId,
      action: 'announcement.deleted',
      entityType: 'announcement',
      entityId: id,
      metadata: { title: deleted.title },
    })
  }

  return deleted ?? null
}

export async function getAnnouncement(orgId: string, id: string) {
  const [result] = await db
    .select()
    .from(announcements)
    .where(and(eq(announcements.id, id), eq(announcements.orgId, orgId)))
    .limit(1)

  return result ?? null
}

export async function listAnnouncementsAdmin(orgId: string) {
  return db
    .select()
    .from(announcements)
    .where(eq(announcements.orgId, orgId))
    .orderBy(desc(announcements.createdAt))
}

/**
 * Get active announcements for the home page.
 * Fetches non-archived, non-paused announcements and filters by next occurrence in JS.
 */
export async function getActiveAnnouncements(orgId: string, limit = 5) {
  const rows = await db
    .select()
    .from(announcements)
    .where(
      and(
        eq(announcements.orgId, orgId),
        isNull(announcements.archivedAt),
        isNull(announcements.pausedAt),
      ),
    )
    .orderBy(announcements.eventDate)

  const now = new Date()
  const withNext = rows
    .map((a) => ({
      ...a,
      nextOccurrence: getNextOccurrence(a.eventDate, a.recurrence as Recurrence | null, now),
    }))
    .filter((a) => a.nextOccurrence !== null)
    .sort((a, b) => a.nextOccurrence!.getTime() - b.nextOccurrence!.getTime())

  return withNext.slice(0, limit)
}
```

**Step 2: Typecheck**

Run: `bun run typecheck`

Note: This will fail until the email template (Task 4) is created. Proceed to Task 4 before typechecking.

---

### Task 4: Email Template

**Files:**

- Create: `app/lib/email/templates/announcement.ts`

**Step 1: Create the template**

```ts
// app/lib/email/templates/announcement.ts
import { getAppUrl } from '~/lib/misc/app-url'

export function announcementEmail(params: {
  orgName: string
  title: string
  description: string
  eventDate: Date
}) {
  const logoUrl = `${getAppUrl()}/logo.png`
  const homeUrl = `${getAppUrl()}/home`
  const formattedDate = params.eventDate.toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return {
    subject: `Aviso: ${params.title} — ${params.orgName}`,
    html: `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <div style="text-align: center; margin-bottom: 24px;">
    <img src="${logoUrl}" alt="Zelus" width="48" height="48" style="border: 0;" />
  </div>
  <h2 style="margin: 0 0 8px;">${params.title}</h2>
  <p style="color: #666; margin: 0 0 16px; font-size: 14px;">${formattedDate}</p>
  <p>${params.description}</p>
  <p style="margin: 24px 0;">
    <a href="${homeUrl}"
       style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 32px; text-decoration: none; font-weight: 500;">
      Ver no Zelus
    </a>
  </p>
</body>
</html>`.trim(),
  }
}
```

**Step 2: Typecheck everything so far**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit Tasks 3 + 4 together**

```bash
git add app/lib/services/announcements.server.ts app/lib/email/templates/announcement.ts
git commit -m "feat(announcements): add service layer with CRUD, broadcast, and email template"
```

---

### Task 5: Admin Routes — List + Actions

**Files:**

- Create: `app/routes/_protected+/admin+/announcements+/_layout.tsx`

This route serves as the announcements list with archive/pause/delete actions, and renders child routes (new/edit) via a Drawer.

**Step 1: Create the admin list route**

```tsx
// app/routes/_protected+/admin+/announcements+/_layout.tsx
import { Calendar03Icon, Add01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { data, Form, Link, Outlet, useMatches, useNavigate, href } from 'react-router'

import type { Route } from './+types/_layout'
import { orgContext, userContext } from '~/lib/auth/context'
import {
  listAnnouncementsAdmin,
  deleteAnnouncement,
  archiveAnnouncement,
  unarchiveAnnouncement,
  pauseAnnouncement,
  resumeAnnouncement,
} from '~/lib/services/announcements.server'
import { getNextOccurrence, type Recurrence } from '~/lib/announcements/recurrence'
import { formatDate } from '~/lib/format'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { ErrorBanner } from '~/components/layout/feedback'
import { EmptyState } from '~/components/layout/empty-state'
import { DeleteConfirmDialog } from '~/components/shared/delete-dialog'
import { AlertDialogAction } from '~/components/ui/alert-dialog'
import {
  Drawer,
  DrawerPopup,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '~/components/ui/drawer'
import { setToast } from '~/lib/toast.server'

export function meta() {
  return [{ title: 'Avisos — Zelus' }]
}

export async function loader({ context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const rows = await listAnnouncementsAdmin(orgId)
  const now = new Date()

  const all = rows.map((a) => ({
    ...a,
    nextOccurrence: getNextOccurrence(a.eventDate, a.recurrence as Recurrence | null, now),
    isRecurring: !!a.recurrence,
    frequencyLabel: getFrequencyLabel(a.recurrence as Recurrence | null),
  }))

  return {
    active: all.filter((a) => !a.archivedAt && !a.pausedAt),
    paused: all.filter((a) => !a.archivedAt && !!a.pausedAt),
    archived: all.filter((a) => !!a.archivedAt),
  }
}

function getFrequencyLabel(rec: Recurrence | null): string | null {
  if (!rec) return null
  const prefix = rec.interval > 1 ? `${rec.interval}x ` : ''
  return rec.frequency === 'weekly' ? `${prefix}Semanal` : `${prefix}Mensal`
}

export async function action({ request, context }: Route.ActionArgs) {
  const { orgId } = context.get(orgContext)
  const user = context.get(userContext)
  const formData = await request.formData()
  const intent = formData.get('intent') as string
  const id = formData.get('id') as string

  if (!id) return { error: 'ID em falta.' }

  try {
    if (intent === 'delete') {
      await deleteAnnouncement(orgId, id, user.id)
      return data({ success: true }, { headers: await setToast('Aviso eliminado.') })
    }
    if (intent === 'archive') {
      await archiveAnnouncement(orgId, id, user.id)
      return data({ success: true }, { headers: await setToast('Aviso arquivado.') })
    }
    if (intent === 'unarchive') {
      await unarchiveAnnouncement(orgId, id, user.id)
      return data({ success: true }, { headers: await setToast('Aviso reativado.') })
    }
    if (intent === 'pause') {
      await pauseAnnouncement(orgId, id, user.id)
      return data({ success: true }, { headers: await setToast('Aviso pausado.') })
    }
    if (intent === 'resume') {
      await resumeAnnouncement(orgId, id, user.id)
      return data({ success: true }, { headers: await setToast('Aviso retomado.') })
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao processar ação.' }
  }

  return { error: 'Ação desconhecida.' }
}

export default function AnnouncementsLayout({ loaderData, actionData }: Route.ComponentProps) {
  const { active, paused, archived } = loaderData
  const navigate = useNavigate()
  const matches = useMatches()
  const isDrawerOpen = matches.some(
    (m) => m.pathname.endsWith('/new') || m.pathname.match(/\/announcements\/[^/]+$/),
  )

  const isEmpty = active.length === 0 && paused.length === 0 && archived.length === 0

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Avisos</h1>
        <Button nativeButton={false} render={<Link to={href('/admin/announcements/new')} />}>
          Novo aviso
        </Button>
      </div>

      {actionData && 'error' in actionData && (
        <ErrorBanner className="mt-4">{actionData.error}</ErrorBanner>
      )}

      {isEmpty ? (
        <div className="mt-6">
          <EmptyState icon={Calendar03Icon} message="Nenhum aviso criado" />
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {active.length > 0 && <AnnouncementSection title="Ativos" items={active} />}
          {paused.length > 0 && <AnnouncementSection title="Pausados" items={paused} />}
          {archived.length > 0 && <AnnouncementSection title="Arquivados" items={archived} />}
        </div>
      )}

      <Drawer
        open={isDrawerOpen}
        onOpenChange={(open) => {
          if (!open) navigate(href('/admin/announcements'))
        }}
      >
        <DrawerPopup>
          <DrawerHeader>
            <DrawerTitle>
              {matches.some((m) => m.pathname.endsWith('/new')) ? 'Novo aviso' : 'Editar aviso'}
            </DrawerTitle>
            <DrawerDescription>
              {matches.some((m) => m.pathname.endsWith('/new'))
                ? 'Crie um novo aviso para os moradores.'
                : 'Edite os dados do aviso.'}
            </DrawerDescription>
          </DrawerHeader>
          <Outlet />
        </DrawerPopup>
      </Drawer>
    </div>
  )
}

function AnnouncementSection({
  title,
  items,
}: {
  title: string
  items: Array<{
    id: string
    title: string
    description: string
    eventDate: Date
    nextOccurrence: Date | null
    isRecurring: boolean
    frequencyLabel: string | null
    archivedAt: Date | null
    pausedAt: Date | null
  }>
}) {
  return (
    <section>
      <h2 className="text-muted-foreground mb-3 text-sm font-medium">
        {title} <span className="text-muted-foreground/60">({items.length})</span>
      </h2>
      <div className="flex flex-col gap-2">
        {items.map((a) => (
          <div
            key={a.id}
            className="ring-foreground/5 flex items-center gap-3 rounded-2xl p-3 ring-1"
          >
            <div className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-xl">
              <HugeiconsIcon
                icon={Calendar03Icon}
                size={18}
                strokeWidth={1.5}
                className="text-primary"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium">{a.title}</p>
                {a.frequencyLabel && (
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {a.frequencyLabel}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm">
                {a.nextOccurrence
                  ? `Próximo: ${formatDate(a.nextOccurrence)}`
                  : formatDate(a.eventDate)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link to={href('/admin/announcements/:id', { id: a.id })} />}
              >
                Editar
              </Button>
              {!a.archivedAt && (
                <Form method="post">
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="intent" value={a.pausedAt ? 'resume' : 'pause'} />
                  <Button type="submit" variant="ghost" size="sm">
                    {a.pausedAt ? 'Retomar' : 'Pausar'}
                  </Button>
                </Form>
              )}
              <Form method="post">
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="intent" value={a.archivedAt ? 'unarchive' : 'archive'} />
                <Button type="submit" variant="ghost" size="sm">
                  {a.archivedAt ? 'Reativar' : 'Arquivar'}
                </Button>
              </Form>
              <DeleteConfirmDialog
                title="Eliminar aviso?"
                description={`O aviso "${a.title}" sera eliminado permanentemente.`}
              >
                <Form method="post">
                  <input type="hidden" name="intent" value="delete" />
                  <input type="hidden" name="id" value={a.id} />
                  <AlertDialogAction type="submit">Eliminar</AlertDialogAction>
                </Form>
              </DeleteConfirmDialog>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
```

**Step 2: Typecheck**

Run: `bun run typecheck`

Note: Route types will be generated automatically. If typegen has issues, run `bun run dev` briefly to trigger it.

**Step 3: Commit**

```bash
git add app/routes/_protected+/admin+/announcements+/
git commit -m "feat(announcements): add admin list route with actions"
```

---

### Task 6: Admin Routes — Create + Edit Forms

**Files:**

- Create: `app/routes/_protected+/admin+/announcements+/new.tsx`
- Create: `app/routes/_protected+/admin+/announcements+/$id.tsx`

**Step 1: Create the Zod schema and shared form component**

Both new and edit share the same form. Create the new route first (it contains the form component that edit will also use via copy — keeping it simple, no shared module needed since the form is small).

```tsx
// app/routes/_protected+/admin+/announcements+/new.tsx
import { Form, redirect, href } from 'react-router'
import { z } from 'zod'

import type { Route } from './+types/new'
import { orgContext, userContext } from '~/lib/auth/context'
import { createAnnouncement, broadcastAnnouncement } from '~/lib/services/announcements.server'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { Field, FieldLabel } from '~/components/ui/field'
import { ErrorBanner } from '~/components/layout/feedback'
import { setToast } from '~/lib/toast.server'
import type { Recurrence } from '~/lib/announcements/recurrence'

const createSchema = z.object({
  title: z.string().min(1, 'Titulo e obrigatorio'),
  description: z.string().min(1, 'Descricao e obrigatoria'),
  eventDate: z.string().min(1, 'Data e obrigatoria'),
  eventTime: z.string().min(1, 'Hora e obrigatoria'),
  notify: z.string().optional(),
  // Recurrence fields
  recurrenceType: z.enum(['none', 'custom']).default('none'),
  frequency: z.enum(['weekly', 'monthly']).optional(),
  interval: z.coerce.number().min(1).default(1),
  daysOfWeek: z.string().optional(), // comma-separated: "1,5"
  dayOfMonth: z.coerce.number().min(1).max(31).optional(),
  endType: z.enum(['never', 'date', 'count']).default('never'),
  endDate: z.string().optional(),
  endCount: z.coerce.number().min(1).optional(),
})

function parseRecurrence(data: z.infer<typeof createSchema>): Recurrence | null {
  if (data.recurrenceType === 'none') return null

  const rec: Recurrence = {
    frequency: data.frequency ?? 'weekly',
    interval: data.interval,
    endType: data.endType,
  }

  if (rec.frequency === 'weekly' && data.daysOfWeek) {
    rec.daysOfWeek = data.daysOfWeek
      .split(',')
      .map(Number)
      .filter((n) => n >= 0 && n <= 6)
  }

  if (rec.frequency === 'monthly' && data.dayOfMonth) {
    rec.dayOfMonth = data.dayOfMonth
  }

  if (data.endType === 'date' && data.endDate) {
    rec.endDate = data.endDate
  }

  if (data.endType === 'count' && data.endCount) {
    rec.endCount = data.endCount
  }

  return rec
}

export async function action({ request, context }: Route.ActionArgs) {
  const { orgId, orgName } = context.get(orgContext)
  const user = context.get(userContext)
  const formData = await request.formData()
  const fields = Object.fromEntries(formData)

  const parsed = createSchema.safeParse(fields)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Dados invalidos.'
    return { error: msg }
  }

  const eventDate = new Date(`${parsed.data.eventDate}T${parsed.data.eventTime}:00`)
  const recurrence = parseRecurrence(parsed.data)

  const announcement = await createAnnouncement(
    orgId,
    { title: parsed.data.title, description: parsed.data.description, eventDate, recurrence },
    user.id,
  )

  if (parsed.data.notify === 'on') {
    // Fire and forget — don't block the response
    broadcastAnnouncement(orgId, orgName, announcement, user.id).catch(console.error)
  }

  return redirect(href('/admin/announcements'), {
    headers: await setToast('Aviso criado.'),
  })
}

export default function NewAnnouncementPage({ actionData }: Route.ComponentProps) {
  return (
    <div className="px-6 pb-6">
      {actionData && 'error' in actionData && (
        <ErrorBanner className="mb-3">{actionData.error}</ErrorBanner>
      )}
      <AnnouncementForm />
    </div>
  )
}

// Exported for reuse in edit route
export function AnnouncementForm({
  defaultValues,
}: {
  defaultValues?: {
    title: string
    description: string
    eventDate: string
    eventTime: string
    recurrenceType: 'none' | 'custom'
    frequency?: 'weekly' | 'monthly'
    interval?: number
    daysOfWeek?: string
    dayOfMonth?: number
    endType?: 'never' | 'date' | 'count'
    endDate?: string
    endCount?: number
  }
}) {
  // Note: recurrence UI uses vanilla HTML form elements for simplicity.
  // A more polished version with day-of-week toggle buttons can be done later.
  return (
    <Form method="post" className="grid gap-4">
      <Field>
        <FieldLabel htmlFor="ann-title">
          Titulo <span className="text-destructive">*</span>
        </FieldLabel>
        <Input
          id="ann-title"
          name="title"
          type="text"
          placeholder="Ex: Lavagem da garagem"
          defaultValue={defaultValues?.title}
          required
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="ann-desc">
          Descricao <span className="text-destructive">*</span>
        </FieldLabel>
        <Textarea
          id="ann-desc"
          name="description"
          placeholder="Detalhes do aviso..."
          rows={3}
          defaultValue={defaultValues?.description}
          required
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="ann-date">
            Data <span className="text-destructive">*</span>
          </FieldLabel>
          <Input
            id="ann-date"
            name="eventDate"
            type="date"
            defaultValue={defaultValues?.eventDate}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="ann-time">
            Hora <span className="text-destructive">*</span>
          </FieldLabel>
          <Input
            id="ann-time"
            name="eventTime"
            type="time"
            defaultValue={defaultValues?.eventTime ?? '09:00'}
            required
          />
        </Field>
      </div>

      {/* Recurrence */}
      <Field>
        <FieldLabel htmlFor="ann-recurrence">Repetir</FieldLabel>
        <select
          id="ann-recurrence"
          name="recurrenceType"
          defaultValue={defaultValues?.recurrenceType ?? 'none'}
          className="border-input bg-background ring-foreground/10 h-10 w-full rounded-4xl px-3 text-sm ring-1"
        >
          <option value="none">Nao repete</option>
          <option value="custom">Personalizado</option>
        </select>
      </Field>

      {/* Recurrence detail fields — shown via CSS when recurrenceType=custom */}
      {/* For MVP, these are always rendered but the user fills them only when custom is selected */}
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="ann-interval">A cada</FieldLabel>
          <Input
            id="ann-interval"
            name="interval"
            type="number"
            min={1}
            defaultValue={defaultValues?.interval ?? 1}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="ann-freq">Unidade</FieldLabel>
          <select
            id="ann-freq"
            name="frequency"
            defaultValue={defaultValues?.frequency ?? 'weekly'}
            className="border-input bg-background ring-foreground/10 h-10 w-full rounded-4xl px-3 text-sm ring-1"
          >
            <option value="weekly">Semana(s)</option>
            <option value="monthly">Mes(es)</option>
          </select>
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="ann-days">Dias da semana (para semanal)</FieldLabel>
        <Input
          id="ann-days"
          name="daysOfWeek"
          type="text"
          placeholder="0=Dom,1=Seg,...,6=Sab. Ex: 5"
          defaultValue={defaultValues?.daysOfWeek}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="ann-dom">Dia do mes (para mensal)</FieldLabel>
        <Input
          id="ann-dom"
          name="dayOfMonth"
          type="number"
          min={1}
          max={31}
          placeholder="Ex: 15"
          defaultValue={defaultValues?.dayOfMonth}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="ann-endtype">Termina em</FieldLabel>
          <select
            id="ann-endtype"
            name="endType"
            defaultValue={defaultValues?.endType ?? 'never'}
            className="border-input bg-background ring-foreground/10 h-10 w-full rounded-4xl px-3 text-sm ring-1"
          >
            <option value="never">Nunca</option>
            <option value="date">Data</option>
            <option value="count">Apos N ocorrencias</option>
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="ann-enddate">Data fim / Contagem</FieldLabel>
          <Input
            id="ann-enddate"
            name="endDate"
            type="date"
            defaultValue={defaultValues?.endDate}
          />
          <Input
            id="ann-endcount"
            name="endCount"
            type="number"
            min={1}
            placeholder="Num. ocorrencias"
            defaultValue={defaultValues?.endCount}
            className="mt-2"
          />
        </Field>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="ann-notify"
          name="notify"
          defaultChecked
          className="accent-primary size-4"
        />
        <label htmlFor="ann-notify" className="text-sm">
          Notificar moradores (email + notificacao)
        </label>
      </div>

      <Button type="submit" className="mt-1">
        {defaultValues ? 'Guardar alteracoes' : 'Criar aviso'}
      </Button>
    </Form>
  )
}
```

**Step 2: Create the edit route**

```tsx
// app/routes/_protected+/admin+/announcements+/$id.tsx
import { redirect, href } from 'react-router'
import { z } from 'zod'

import type { Route } from './+types/$id'
import { orgContext, userContext } from '~/lib/auth/context'
import { getAnnouncement, updateAnnouncement } from '~/lib/services/announcements.server'
import { ErrorBanner } from '~/components/layout/feedback'
import { setToast } from '~/lib/toast.server'
import { AnnouncementForm } from './new'
import { toInputDate } from '~/lib/format'
import type { Recurrence } from '~/lib/announcements/recurrence'

const updateSchema = z.object({
  title: z.string().min(1, 'Titulo e obrigatorio'),
  description: z.string().min(1, 'Descricao e obrigatoria'),
  eventDate: z.string().min(1, 'Data e obrigatoria'),
  eventTime: z.string().min(1, 'Hora e obrigatoria'),
  recurrenceType: z.enum(['none', 'custom']).default('none'),
  frequency: z.enum(['weekly', 'monthly']).optional(),
  interval: z.coerce.number().min(1).default(1),
  daysOfWeek: z.string().optional(),
  dayOfMonth: z.coerce.number().min(1).max(31).optional(),
  endType: z.enum(['never', 'date', 'count']).default('never'),
  endDate: z.string().optional(),
  endCount: z.coerce.number().min(1).optional(),
})

function parseRecurrence(data: z.infer<typeof updateSchema>): Recurrence | null {
  if (data.recurrenceType === 'none') return null
  const rec: Recurrence = {
    frequency: data.frequency ?? 'weekly',
    interval: data.interval,
    endType: data.endType,
  }
  if (rec.frequency === 'weekly' && data.daysOfWeek) {
    rec.daysOfWeek = data.daysOfWeek
      .split(',')
      .map(Number)
      .filter((n) => n >= 0 && n <= 6)
  }
  if (rec.frequency === 'monthly' && data.dayOfMonth) rec.dayOfMonth = data.dayOfMonth
  if (data.endType === 'date' && data.endDate) rec.endDate = data.endDate
  if (data.endType === 'count' && data.endCount) rec.endCount = data.endCount
  return rec
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const { orgId } = context.get(orgContext)
  const announcement = await getAnnouncement(orgId, params.id)
  if (!announcement) throw new Response('Not found', { status: 404 })

  const rec = announcement.recurrence as Recurrence | null
  const eventTime = announcement.eventDate
    ? `${String(announcement.eventDate.getHours()).padStart(2, '0')}:${String(announcement.eventDate.getMinutes()).padStart(2, '0')}`
    : '09:00'

  return {
    announcement,
    defaults: {
      title: announcement.title,
      description: announcement.description,
      eventDate: toInputDate(announcement.eventDate),
      eventTime,
      recurrenceType: (rec ? 'custom' : 'none') as 'none' | 'custom',
      frequency: rec?.frequency,
      interval: rec?.interval,
      daysOfWeek: rec?.daysOfWeek?.join(','),
      dayOfMonth: rec?.dayOfMonth,
      endType: rec?.endType,
      endDate: rec?.endDate,
      endCount: rec?.endCount,
    },
  }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { orgId } = context.get(orgContext)
  const user = context.get(userContext)
  const formData = await request.formData()
  const fields = Object.fromEntries(formData)

  const parsed = updateSchema.safeParse(fields)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Dados invalidos.'
    return { error: msg }
  }

  const eventDate = new Date(`${parsed.data.eventDate}T${parsed.data.eventTime}:00`)
  const recurrence = parseRecurrence(parsed.data)

  await updateAnnouncement(
    orgId,
    params.id,
    { title: parsed.data.title, description: parsed.data.description, eventDate, recurrence },
    user.id,
  )

  return redirect(href('/admin/announcements'), {
    headers: await setToast('Aviso atualizado.'),
  })
}

export default function EditAnnouncementPage({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <div className="px-6 pb-6">
      {actionData && 'error' in actionData && (
        <ErrorBanner className="mb-3">{actionData.error}</ErrorBanner>
      )}
      <AnnouncementForm defaultValues={loaderData.defaults} />
    </div>
  )
}
```

**Step 3: Typecheck**

Run: `bun run typecheck`
Expected: PASS (may need a dev server restart for route type generation)

**Step 4: Commit**

```bash
git add app/routes/_protected+/admin+/announcements+/
git commit -m "feat(announcements): add admin create and edit routes"
```

---

### Task 7: Add Admin Nav Entry

**Files:**

- Modify: `app/lib/navigation.ts`

**Step 1: Add Avisos to admin nav group**

Add a new item to the `navGroups[0].items` array (the Administracao group):

```ts
{ label: 'Avisos', to: href('/admin/announcements'), icon: ShieldKeyIcon },
```

Add it as the second item (after Dashboard) for visibility.

**Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add app/lib/navigation.ts
git commit -m "feat(announcements): add admin nav entry for announcements"
```

---

### Task 8: Home Page — Announcements Section

**Files:**

- Modify: `app/routes/_protected+/home.tsx`

**Step 1: Update the home page loader to fetch announcements**

Add to the loader:

```ts
import { getActiveAnnouncements } from '~/lib/services/announcements.server'

// Inside loader:
const [highlights, activeAnnouncements] = await Promise.all([
  getDocumentsHighlights(orgId, 6),
  getActiveAnnouncements(orgId, 5),
])

return {
  highlights,
  activeAnnouncements,
  user: { name: user.name },
}
```

**Step 2: Add the announcements section to the component**

Add between the `<h1>` greeting and the feature shortcuts section:

```tsx
import { Calendar03Icon } from '@hugeicons/core-free-icons'
import { Badge } from '~/components/ui/badge'

// Inside the component, after the h1:
{
  activeAnnouncements.length > 0 && (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold">Avisos</h2>
      <div className="flex flex-col gap-2">
        {activeAnnouncements.map((a) => (
          <div
            key={a.id}
            className="bg-primary/5 ring-primary/10 flex items-start gap-3 rounded-2xl p-4 ring-1"
          >
            <div className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-xl">
              <HugeiconsIcon
                icon={Calendar03Icon}
                size={18}
                strokeWidth={1.5}
                className="text-primary"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{a.title}</p>
                {a.recurrence && (
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {(a.recurrence as { frequency: string }).frequency === 'weekly'
                      ? 'Semanal'
                      : 'Mensal'}
                  </Badge>
                )}
              </div>
              <p className="text-primary/70 mt-0.5 text-sm">
                {a.nextOccurrence!.toLocaleDateString('pt-PT', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{a.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
```

**Step 3: Typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add app/routes/_protected+/home.tsx
git commit -m "feat(announcements): show active announcements on home page"
```

---

### Task 9: Add `announcement` Type to Notifications Page

**Files:**

- Modify: `app/routes/_protected+/notifications.tsx`

**Step 1: Add announcement type config**

Add to the `typeConfig` object in `notifications.tsx`:

```ts
import { Calendar03Icon } from '@hugeicons/core-free-icons'

// Add to typeConfig:
announcement: {
  icon: Calendar03Icon,
  iconClass: 'text-primary',
  bgClass: 'bg-primary/10',
},
```

**Step 2: Commit**

```bash
git add app/routes/_protected+/notifications.tsx
git commit -m "feat(announcements): add announcement type to notifications page"
```

---

### Task 10: Verify End-to-End

**Step 1: Typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 2: Run all tests**

Run: `bun run test`
Expected: PASS

**Step 3: Manual verification**

Run: `bun run dev`

Verify:

1. Admin sidebar shows "Avisos" link
2. `/admin/announcements` — empty state, "Novo aviso" button works
3. Create a one-time announcement — appears on home page
4. Create a recurring weekly announcement — badge shows "Semanal", next occurrence calculated
5. Pause/archive/delete work from admin list
6. Notification appears in `/notifications` with calendar icon
7. Email sent in dev mode (check console log output)

**Step 4: Final commit (if any adjustments needed)**

```bash
git add -A
git commit -m "feat(announcements): polish and adjustments"
```

Plan complete and saved to `docs/plans/2026-03-05-announcements-impl.md`. Two execution options:

**1. Subagent-Driven (this session)** — I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints

Which approach?
