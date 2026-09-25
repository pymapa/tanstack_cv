import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Minimal stand-ins for pg's Pool and PoolClient: they record SQL and let a test fail chosen statements. */
class FakeClient extends EventEmitter {
  readonly sql: string[] = []
  readonly failOn = new Map<string, Error>()
  released: { error: Error | undefined } | undefined

  query(text: string): Promise<{ rows: unknown[] }> {
    this.sql.push(text)
    const failure = this.failOn.get(text)
    return failure ? Promise.reject(failure) : Promise.resolve({ rows: [] })
  }

  release(error?: Error): void {
    this.released = { error }
  }
}

class FakePool extends EventEmitter {
  static readonly created: FakePool[] = []
  readonly client = new FakeClient()
  readonly queries: { text: string; params: unknown[] }[] = []
  ended = false

  constructor(
    readonly options: {
      connectionString: string
      statement_timeout?: number
      idle_in_transaction_session_timeout?: number
    },
  ) {
    super()
    FakePool.created.push(this)
  }

  query(text: string, params: unknown[]): Promise<{ rows: unknown[] }> {
    this.queries.push({ text, params })
    return Promise.resolve({ rows: [{ id: 1 }] })
  }

  connect(): Promise<FakeClient> {
    return Promise.resolve(this.client)
  }

  end(): Promise<void> {
    this.ended = true
    return Promise.resolve()
  }
}

vi.mock('pg', () => ({ default: { Pool: FakePool } }))

const { closeDb, getDb, query, withTransaction } = await import('~/db/client')

const lastPool = (): FakePool => {
  const pool = FakePool.created.at(-1)
  if (!pool) throw new Error('no pool was created')
  return pool
}

beforeEach(() => {
  vi.stubEnv('DATABASE_URL', 'postgres://user:pass@localhost:5432/test')
})

afterEach(async () => {
  await closeDb()
  vi.unstubAllEnvs()
  FakePool.created.length = 0
})

describe('query', () => {
  it('should send the statement and its parameters separately and return the rows', async () => {
    const rows = await query('SELECT * FROM t WHERE id = $1', [1])

    expect(rows).toEqual([{ id: 1 }])
    expect(lastPool().queries).toEqual([{ text: 'SELECT * FROM t WHERE id = $1', params: [1] }])
    expect(lastPool().options.connectionString).toBe('postgres://user:pass@localhost:5432/test')
  })

  it('should limit how long a statement or an idle transaction can hold a connection', async () => {
    await query('SELECT 1')

    // Dedicated settings, not `options`: an `?options=` in a managed-Postgres URL would replace that.
    expect(lastPool().options).toMatchObject({ statement_timeout: 5000, idle_in_transaction_session_timeout: 10000 })
  })

  it('should reuse one pool across calls', async () => {
    await query('SELECT 1')
    await query('SELECT 2')

    expect(FakePool.created).toHaveLength(1)
  })

  it('should explain how to configure the database when DATABASE_URL is missing', async () => {
    vi.stubEnv('DATABASE_URL', '  ')

    await expect(query('SELECT 1')).rejects.toThrow(/DATABASE_URL is not set.*pnpm db:up/)
  })

  it('should log only the message and not crash when an idle client loses its connection', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await query('SELECT 1')

    // An 'error' event without a listener would throw here.
    expect(() => lastPool().emit('error', new Error('terminated'))).not.toThrow()
    expect(logged).toHaveBeenCalledWith('Idle database client error: terminated')
  })
})

describe('withTransaction', () => {
  it('should commit and return the result when the callback resolves', async () => {
    const result = await withTransaction(() => Promise.resolve('done'))

    expect(result).toBe('done')
    expect(lastPool().client.sql).toEqual(['BEGIN', 'COMMIT'])
    expect(lastPool().client.released).toEqual({ error: undefined })
  })

  it('should roll back and rethrow when the callback throws', async () => {
    const failure = new Error('boom')

    await expect(withTransaction(() => Promise.reject(failure))).rejects.toBe(failure)
    expect(lastPool().client.sql).toEqual(['BEGIN', 'ROLLBACK'])
    expect(lastPool().client.released).toEqual({ error: undefined })
  })

  it('should keep the original error and discard the client when the rollback fails', async () => {
    const failure = new Error('boom')
    const rollbackFailure = new Error('connection lost')
    await query('SELECT 1')
    lastPool().client.failOn.set('ROLLBACK', rollbackFailure)

    await expect(withTransaction(() => Promise.reject(failure))).rejects.toBe(failure)
    expect(lastPool().client.released).toEqual({ error: rollbackFailure })
  })

  it('should discard the client instead of crashing when its connection drops mid-transaction', async () => {
    const dropped = new Error('terminated')

    await expect(
      withTransaction((client) => {
        // An 'error' event without a listener would throw here.
        client.emit('error', dropped)
        return Promise.reject(new Error('query failed'))
      }),
    ).rejects.toThrow('query failed')
    expect(lastPool().client.released).toEqual({ error: dropped })
    expect(lastPool().client.listenerCount('error')).toBe(0)
  })
})

describe('closeDb', () => {
  it('should end the pool and create a new one on the next query', async () => {
    await query('SELECT 1')
    const first = lastPool()

    await closeDb()
    await query('SELECT 1')

    expect(first.ended).toBe(true)
    expect(FakePool.created).toHaveLength(2)
  })
})

describe('getDb', () => {
  it('should share the pool with query', async () => {
    await query('SELECT 1')

    getDb()

    expect(FakePool.created).toHaveLength(1)
  })

  it('should return the same Drizzle instance on every call', () => {
    expect(getDb()).toBe(getDb())
  })
})
