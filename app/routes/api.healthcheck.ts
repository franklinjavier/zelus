import { sql } from 'drizzle-orm'

import { db } from '~/lib/db'

export async function loader() {
  const [result] = await db.execute(sql`SELECT 1 as ok`)
  return Response.json({ status: 'ok', db: result.ok === 1 })
}
