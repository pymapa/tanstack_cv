import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'
import * as schema from '~/db/schema'

/** The local Docker database (README "Local database"); only used to create and drop test databases. */
const DEFAULT_ADMIN_URL = 'postgres://cvbank:cvbank-local@127.0.0.1:5432/cvbank'

export type TestDb = Readonly<{
  db: ReturnType<typeof drizzle<typeof schema>>
  drop: () => Promise<void>
}>

/**
 * A new, migrated database for one test file (spec §11): `cvbank_test_<random>`. Call `drop()`
 * in `afterAll`. Needs the local Postgres (`pnpm db:up`).
 */
export const createTestDb = async (): Promise<TestDb> => {
  const adminUrl = process.env.DATABASE_URL?.trim() || DEFAULT_ADMIN_URL
  const name = `cvbank_test_${crypto.randomUUID().replaceAll('-', '')}`
  const admin = new pg.Client({ connectionString: adminUrl })
  await admin.connect()
  await admin.query(`CREATE DATABASE ${name}`)
  await admin.end()

  const url = new URL(adminUrl)
  url.pathname = `/${name}`
  const pool = new pg.Pool({ connectionString: url.toString(), max: 2 })
  const db = drizzle(pool, { schema })
  await migrate(db, { migrationsFolder: 'src/db/migrations' })

  return {
    db,
    drop: async () => {
      await pool.end()
      const cleanup = new pg.Client({ connectionString: adminUrl })
      await cleanup.connect()
      await cleanup.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
      await cleanup.end()
    },
  }
}
