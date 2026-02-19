/**
 * Migration safety wrapper around Drizzle Kit.
 *
 * Usage:
 *   bun run scripts/db.ts generate [name]
 *   bun run scripts/db.ts migrate [--yes]
 *   bun run scripts/db.ts check [--all]
 *   bun run scripts/db.ts status
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

import postgres from 'postgres'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = resolve(import.meta.dirname ?? '.', '../app/lib/db/migrations')
const JOURNAL_PATH = resolve(MIGRATIONS_DIR, 'meta/_journal.json')
const REVIEWED_PATH = resolve(MIGRATIONS_DIR, 'meta/_reviewed.json')

// ---------------------------------------------------------------------------
// Destructive pattern detection
// ---------------------------------------------------------------------------

type Severity = 'error' | 'warn'

interface DestructiveMatch {
  pattern: string
  severity: Severity
  line: number
  text: string
}

const DESTRUCTIVE_PATTERNS: { regex: RegExp; label: string; severity: Severity }[] = [
  { regex: /DROP\s+TABLE/i, label: 'DROP TABLE', severity: 'error' },
  { regex: /DROP\s+COLUMN/i, label: 'DROP COLUMN', severity: 'error' },
  { regex: /ALTER\s+COLUMN\s+.*\s+TYPE/i, label: 'ALTER COLUMN ... TYPE', severity: 'error' },
  { regex: /\bTRUNCATE\b/i, label: 'TRUNCATE', severity: 'error' },
  { regex: /DELETE\s+FROM/i, label: 'DELETE FROM', severity: 'error' },
  { regex: /DROP\s+INDEX/i, label: 'DROP INDEX', severity: 'warn' },
  { regex: /RENAME\s+TO\b/i, label: 'RENAME TABLE', severity: 'warn' },
  { regex: /RENAME\s+COLUMN/i, label: 'RENAME COLUMN', severity: 'warn' },
  { regex: /DROP\s+CONSTRAINT/i, label: 'DROP CONSTRAINT', severity: 'warn' },
]

function scanSql(sql: string): DestructiveMatch[] {
  const matches: DestructiveMatch[] = []
  const lines = sql.split('\n')
  for (let i = 0; i < lines.length; i++) {
    for (const { regex, label, severity } of DESTRUCTIVE_PATTERNS) {
      if (regex.test(lines[i])) {
        matches.push({ pattern: label, severity, line: i + 1, text: lines[i].trim() })
      }
    }
  }
  return matches
}

function printMatches(file: string, matches: DestructiveMatch[]) {
  const errors = matches.filter((m) => m.severity === 'error')
  const warns = matches.filter((m) => m.severity === 'warn')
  if (warns.length) {
    for (const m of warns) {
      console.log(`  ⚠  ${file}:${m.line} — ${m.pattern}`)
      console.log(`     ${m.text}`)
    }
  }
  if (errors.length) {
    for (const m of errors) {
      console.log(`  ✖  ${file}:${m.line} — ${m.pattern}`)
      console.log(`     ${m.text}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Journal helpers
// ---------------------------------------------------------------------------

interface JournalEntry {
  idx: number
  version: string
  when: number
  tag: string
  breakpoints: boolean
}

interface Journal {
  version: string
  dialect: string
  entries: JournalEntry[]
}

function readJournal(): Journal {
  return JSON.parse(readFileSync(JOURNAL_PATH, 'utf-8'))
}

/** Map of filename → set of reviewed line numbers */
type ReviewedOps = Record<string, Record<string, string>>

function readReviewed(): ReviewedOps {
  try {
    return JSON.parse(readFileSync(REVIEWED_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

/** Downgrade reviewed error-level matches to warnings. */
function applyReviewed(file: string, matches: DestructiveMatch[]): DestructiveMatch[] {
  const reviewed = readReviewed()
  const fileReviewed = reviewed[file]
  if (!fileReviewed) return matches
  return matches.map((m) => {
    if (m.severity === 'error' && String(m.line) in fileReviewed) {
      return { ...m, severity: 'warn' as Severity }
    }
    return m
  })
}

function readMigrationSql(tag: string): string {
  return readFileSync(resolve(MIGRATIONS_DIR, `${tag}.sql`), 'utf-8')
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

function isLocalDatabase(url: string): boolean {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname
    return host === 'localhost' || host === '127.0.0.1' || host === '::1'
  } catch {
    return false
  }
}

async function getAppliedMigrations(sql: postgres.Sql): Promise<Set<string>> {
  const applied = new Set<string>()
  try {
    const rows = await sql`
      SELECT hash FROM __drizzle_migrations ORDER BY created_at
    `
    for (const row of rows) {
      applied.add(String(row.hash))
    }
  } catch {
    // Table doesn't exist yet — no migrations applied
  }
  return applied
}

async function getPendingEntries(sql: postgres.Sql): Promise<JournalEntry[]> {
  const journal = readJournal()
  const applied = await getAppliedMigrations(sql)
  const appliedCount = applied.size
  return journal.entries.slice(appliedCount)
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

async function cmdGenerate(name?: string) {
  console.log('\n📦 Generating migration...\n')

  const before = new Set(readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')))

  const args = ['drizzle-kit', 'generate']
  if (name) args.push('--name', name)
  execFileSync('bunx', args, { stdio: 'inherit' })

  const after = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'))
  const newFiles = after.filter((f) => !before.has(f))

  if (newFiles.length === 0) {
    console.log('\nNo new migration files generated.')
    return
  }

  console.log(`\n🆕 New migration file(s): ${newFiles.join(', ')}\n`)

  let hasDestructive = false
  for (const file of newFiles) {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf-8')
    const matches = scanSql(sql)
    if (matches.length) {
      hasDestructive = true
      printMatches(file, matches)
    }
  }

  if (hasDestructive) {
    console.log('\n⚠  Destructive operations detected — review carefully before committing.\n')
  } else {
    console.log('✔  No destructive operations detected.\n')
  }
}

async function cmdMigrate(yes: boolean) {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    console.error('✖  DATABASE_URL is not set.')
    process.exit(1)
  }

  if (!isLocalDatabase(dbUrl) && !yes) {
    console.error('✖  DATABASE_URL points to a non-local database.')
    console.error('   Use --yes to confirm you want to migrate a remote database.')
    process.exit(1)
  }

  const sql = postgres(dbUrl, { max: 1 })
  try {
    const pending = await getPendingEntries(sql)
    if (pending.length === 0) {
      console.log('\n✔  No pending migrations.\n')
      return
    }

    console.log(`\n📋 ${pending.length} pending migration(s):\n`)

    let hasErrors = false
    for (const entry of pending) {
      const file = `${entry.tag}.sql`
      const content = readMigrationSql(entry.tag)
      const matches = applyReviewed(file, scanSql(content))
      const errors = matches.filter((m) => m.severity === 'error')
      if (errors.length) hasErrors = true

      console.log(`── ${file} ──`)
      console.log(content)
      if (matches.length) {
        printMatches(file, matches)
        console.log()
      }
    }

    if (hasErrors && !yes) {
      console.error('✖  Destructive operations detected. Use --yes to force, or fix the migration.')
      process.exit(1)
    }

    if (!yes) {
      process.stdout.write('Apply these migrations? [y/N] ')
      const answer = await new Promise<string>((r) => {
        process.stdin.setEncoding('utf-8')
        process.stdin.once('data', (data) => r(String(data).trim()))
      })
      if (answer.toLowerCase() !== 'y') {
        console.log('Aborted.')
        process.exit(0)
      }
    }

    console.log('\n🚀 Applying migrations...\n')
    execFileSync('bunx', ['drizzle-kit', 'migrate'], { stdio: 'inherit' })
    console.log('\n✔  Migrations applied successfully.\n')
  } finally {
    await sql.end()
  }
}

async function cmdCheck(all: boolean) {
  const dbUrl = process.env.DATABASE_URL
  let entries: JournalEntry[]

  if (all) {
    entries = readJournal().entries
  } else {
    if (!dbUrl) {
      console.error('✖  DATABASE_URL is not set. Use --all to scan all migrations without a DB.')
      process.exit(1)
    }
    const sql = postgres(dbUrl, { max: 1 })
    try {
      entries = await getPendingEntries(sql)
    } finally {
      await sql.end()
    }
  }

  if (entries.length === 0) {
    console.log('\n✔  No migrations to check.\n')
    process.exit(0)
  }

  const label = all ? 'all' : 'pending'
  console.log(`\n🔍 Scanning ${entries.length} ${label} migration(s)...\n`)

  let hasErrors = false
  let hasWarnings = false
  for (const entry of entries) {
    const file = `${entry.tag}.sql`
    const content = readMigrationSql(entry.tag)
    const matches = applyReviewed(file, scanSql(content))
    if (matches.length) {
      printMatches(file, matches)
      if (matches.some((m) => m.severity === 'error')) hasErrors = true
      if (matches.some((m) => m.severity === 'warn')) hasWarnings = true
    }
  }

  if (!hasErrors && !hasWarnings) {
    console.log('✔  No destructive operations detected.\n')
  } else {
    console.log()
  }

  if (hasErrors) {
    console.error('✖  Destructive operations found — review required.\n')
    process.exit(1)
  }
}

async function cmdStatus() {
  const dbUrl = process.env.DATABASE_URL
  const journal = readJournal()

  let appliedCount = 0
  if (dbUrl) {
    const sql = postgres(dbUrl, { max: 1 })
    try {
      const applied = await getAppliedMigrations(sql)
      appliedCount = applied.size
    } finally {
      await sql.end()
    }
  }

  console.log(`\n📊 Migration status (${journal.entries.length} total)\n`)
  for (let i = 0; i < journal.entries.length; i++) {
    const entry = journal.entries[i]
    const status = i < appliedCount ? '✔' : '○'
    const label = i < appliedCount ? 'applied' : 'pending'
    console.log(`  ${status}  ${entry.tag} (${label})`)
  }

  const pending = journal.entries.length - appliedCount
  console.log(
    `\n  ${appliedCount} applied, ${pending} pending${!dbUrl ? ' (no DATABASE_URL — showing journal only)' : ''}\n`,
  )
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

const [subcommand, ...rest] = process.argv.slice(2)

switch (subcommand) {
  case 'generate':
    await cmdGenerate(rest[0])
    break
  case 'migrate':
    await cmdMigrate(rest.includes('--yes'))
    break
  case 'check':
    await cmdCheck(rest.includes('--all'))
    break
  case 'status':
    await cmdStatus()
    break
  default:
    console.log(`
Usage: bun run scripts/db.ts <command>

Commands:
  generate [name]   Generate a new migration (with optional name)
  migrate [--yes]   Preview and apply pending migrations
  check [--all]     Scan migrations for destructive operations
  status            Show migration state
`)
    process.exit(subcommand ? 1 : 0)
}
