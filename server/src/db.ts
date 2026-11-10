import pg from 'pg'
import { config } from './config.js'

// One pool, connected as the owner role (gpc). Two ways in:
//
//   asUser(userId, fn)  every data request. Runs fn in a transaction as
//                       gpc_app with app.user_id set, so row-level security
//                       decides what the user can see and change.
//   owner               auth code only (accounts, sessions, signup), which
//                       must work before anyone is signed in.

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 })

pool.on('error', err => {
  console.error('[db] idle client error', err.message)
})

export type Db = pg.PoolClient

export const owner = {
  query: <R extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values?: unknown[]) =>
    pool.query<R>(text, values),
  /** Runs fn in a transaction as the owner. */
  async transaction<T>(fn: (db: Db) => Promise<T>): Promise<T> {
    const client = await pool.connect()
    try {
      await client.query('begin')
      const result = await fn(client)
      await client.query('commit')
      return result
    } catch (err) {
      await client.query('rollback').catch(() => {})
      throw err
    } finally {
      client.release()
    }
  },
}

export async function asUser<T>(userId: string, fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('begin')
    // Both are transaction-local, so the connection returns to the pool clean.
    await client.query('set local role gpc_app')
    await client.query("select set_config('app.user_id', $1, true)", [userId])
    const result = await fn(client)
    await client.query('commit')
    return result
  } catch (err) {
    await client.query('rollback').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}
