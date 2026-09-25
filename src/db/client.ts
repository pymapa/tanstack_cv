/**
 * Server-only PostgreSQL access (spec §5, `db/` layer). Never import this from client code.
 *
 * Connects with `DATABASE_URL`; see "Local database" in README.md for the local value.
 */
import pg from 'pg'

let pool: pg.Pool | undefined

const getPool = (): pg.Pool => {
  if (pool) return pool
  const connectionString = process.env.DATABASE_URL?.trim()
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Start the database with `pnpm db:up` and set DATABASE_URL (README.md).')
  }
  const created = new pg.Pool({
    connectionString,
    max: 5,
    // Spec §6.2: a stuck query or an abandoned transaction must not hold locks. These are pg's own
    // settings rather than `options`, which an `?options=` in DATABASE_URL would silently replace.
    statement_timeout: 5000,
    idle_in_transaction_session_timeout: 10000,
  })
  // An idle client losing its connection (e.g. the database restarts) must not crash the server.
  // The pool drops that client itself. Only the message is logged: connection errors carry no CV data.
  created.on('error', (error) => {
    // eslint-disable-next-line no-console -- TODO: use src/server/logger.ts (spec §12) once it exists.
    console.error(`Idle database client error: ${error.message}`)
  })
  pool = created
  return created
}

/** Runs one parameterised statement. Pass values as `params`, never inside `text`. */
export const query = async <Row extends pg.QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<Row[]> => (await getPool().query<Row>(text, [...params])).rows

/** Runs `fn` in a transaction. It commits if `fn` resolves and rolls back if it throws. */
export const withTransaction = async <T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> => {
  const client = await getPool().connect()
  let brokenConnection: Error | undefined
  // The pool stops listening for errors on a checked-out client; an unhandled one would crash the server.
  const onError = (error: Error) => {
    brokenConnection = error
  }
  client.on('error', onError)
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch (rollbackError) {
      // Keep the original error; the connection is unusable, so the pool must discard it.
      brokenConnection ??= rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError))
    }
    throw error
  } finally {
    client.off('error', onError)
    client.release(brokenConnection)
  }
}

/** Closes the pool, so a one-off script can exit. */
export const closeDb = async (): Promise<void> => {
  const ending = pool
  pool = undefined
  await ending?.end()
}
