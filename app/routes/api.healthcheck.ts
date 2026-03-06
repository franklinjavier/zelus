import { sql } from 'drizzle-orm'

import { db } from '~/lib/db'

export async function loader() {
  await db.execute(sql`SELECT 1`)
  return Response.json({ status: 'ok' })
}
