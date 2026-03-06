# Announcements (Avisos) — Design

## Summary

Announcements are admin-created notices shown to all residents on the home page. Each announcement has a title, description, event date/time, and optional recurrence. Announcements auto-expire after the event date (or next occurrence) passes, and admins can also archive or pause them manually. Publishing an announcement sends an in-app notification and email to all org members.

## Data Model

### Table: `announcements`

| Column        | Type                   | Description                       |
| ------------- | ---------------------- | --------------------------------- |
| `id`          | text (UUID)            | PK                                |
| `orgId`       | text FK → organization | Organization scope                |
| `title`       | text NOT NULL          | Announcement title                |
| `description` | text NOT NULL          | Body text                         |
| `eventDate`   | timestamp NOT NULL     | Date/time of first event          |
| `recurrence`  | jsonb (nullable)       | Recurrence rule (null = one-time) |
| `pausedAt`    | timestamp (nullable)   | Admin paused this announcement    |
| `archivedAt`  | timestamp (nullable)   | Admin archived this announcement  |
| `createdById` | text FK → user         | Admin who created it              |
| `createdAt`   | timestamp NOT NULL     | Creation timestamp                |

### Recurrence JSONB schema

```ts
type Recurrence = {
  frequency: 'weekly' | 'monthly'
  interval: number // 1 = every week/month, 2 = biweekly/bimonthly, etc.
  daysOfWeek?: number[] // 0=Sun..6=Sat (for weekly)
  dayOfMonth?: number // 1-31 (for monthly)
  endType: 'never' | 'date' | 'count'
  endDate?: string // ISO date (when endType = 'date')
  endCount?: number // Number of occurrences (when endType = 'count')
}
```

### Visibility rules

- **One-time:** visible when `archivedAt IS NULL AND pausedAt IS NULL AND eventDate >= now()`
- **Recurring:** visible when `archivedAt IS NULL AND pausedAt IS NULL` and computed next occurrence exists (respecting endDate/endCount)

## Routes

| Route                      | Access      | Description                                                            |
| -------------------------- | ----------- | ---------------------------------------------------------------------- |
| `/home`                    | All members | "Avisos" section above shortcuts, max 5, sorted by next occurrence ASC |
| `/admin/announcements`     | Admin       | List with tabs: Ativos / Pausados / Arquivados                         |
| `/admin/announcements/new` | Admin       | Create form                                                            |
| `/admin/announcements/:id` | Admin       | View/edit form                                                         |

### Admin actions

- Create, edit, archive/unarchive, pause/resume, delete

## UI — Home Page

Section "Avisos" above feature shortcuts using card-per-item pattern:

- Calendar icon in `bg-primary/10` container
- Title `font-medium`, optional frequency badge for recurring (e.g. "Semanal")
- Next occurrence date formatted
- Description `text-muted-foreground` truncated to 2 lines
- Section hidden when no active announcements

## UI — Admin Create/Edit

Form fields:

1. **Title** — text input
2. **Description** — textarea
3. **Event date/time** — date + time inputs
4. **Recurrence** — radio: "Nao repete" / "Personalizado"
   - If custom: interval + frequency (semana/mes), day-of-week toggles (weekly), end condition (nunca/data/contagem)
5. **Publish** — checkbox to notify members on save

## UI — Admin List

Tabs: Ativos / Pausados / Arquivados. Each item shows title, next occurrence, frequency badge, action buttons (edit, pause/resume, archive, delete).

## Notifications

On creation (when "notify" is checked):

1. **In-app:** create `notification` row (type `announcement`) for each org member
2. **Email:** send via Resend using new `announcement.ts` template to each org member

Only on initial creation, not on each recurrence.

## Email Template

File: `app/lib/email/templates/announcement.ts`

- Subject: `"Aviso: {title} — {orgName}"`
- Body: title, formatted event date/time, full description, CTA button linking to home
- Same layout as existing templates (logo, 480px max-width, rounded button)

## Next Occurrence Calculation

Utility function `getNextOccurrence(announcement): Date | null` computed in loaders at request time. No cron jobs needed.

- Weekly: advance from eventDate by interval weeks, matching daysOfWeek
- Monthly: advance from eventDate by interval months, matching dayOfMonth
- Respects endDate and endCount limits

## Out of Scope

- Categories/tags on announcements
- Images/attachments
- Push notifications (in-app + email only)
- Per-occurrence notifications for recurring events
- Editing a single occurrence of a recurring announcement
- Confirmation of reading by residents
