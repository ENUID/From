import { neon, neonConfig } from '@neondatabase/serverless'

neonConfig.fetchConnectionCache = true

type NeonSql = ReturnType<typeof neon>

function getDb(): NeonSql {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  return neon(url)
}

let _sql: NeonSql | null = null

export function sql(): NeonSql {
  if (!_sql) _sql = getDb()
  return _sql!
}

export async function query<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  const db = sql()
  const rows = await db(strings, ...values)
  return rows as unknown as T[]
}

export async function queryOne<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T | null> {
  const rows = await query<T>(strings, ...values)
  return rows[0] ?? null
}
