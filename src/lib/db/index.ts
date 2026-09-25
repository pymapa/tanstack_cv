/**
 * Server-only PostgreSQL access. Never import this from client code.
 *
 * Connects with `DATABASE_URL`; see "Local database" in README.md for the local value.
 */
import pg from "pg";

let pool: pg.Pool | undefined;

function getPool(): pg.Pool {
	if (!pool) {
		const connectionString = process.env.DATABASE_URL?.trim();
		if (!connectionString) {
			throw new Error(
				"DATABASE_URL is not set. Start the database with `npm run db:up` and add DATABASE_URL to .env.",
			);
		}
		pool = new pg.Pool({ connectionString, max: 5 });
		// An idle client losing its connection (e.g. the database restarts) must not crash the server.
		pool.on("error", (error) =>
			console.error("Idle database client error", error),
		);
	}
	return pool;
}

/** Runs one parameterised statement. Pass values as `params`, never inside `text`. */
export async function query<Row extends pg.QueryResultRow>(
	text: string,
	params: Array<unknown> = [],
): Promise<Array<Row>> {
	return (await getPool().query<Row>(text, params)).rows;
}

/** Runs `fn` in a transaction. It commits if `fn` resolves and rolls back if it throws. */
export async function withTransaction<T>(
	fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
	const client = await getPool().connect();
	let brokenConnection: Error | undefined;
	try {
		await client.query("BEGIN");
		const result = await fn(client);
		await client.query("COMMIT");
		return result;
	} catch (error) {
		try {
			await client.query("ROLLBACK");
		} catch (rollbackError) {
			// Keep the original error; the connection is unusable, so the pool must discard it.
			brokenConnection = rollbackError as Error;
		}
		throw error;
	} finally {
		client.release(brokenConnection);
	}
}

/** Closes the pool, so a one-off script can exit. */
export async function closeDb(): Promise<void> {
	await pool?.end();
	pool = undefined;
}
