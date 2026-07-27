// Minimal factory around Bun's native SQL client — no `pg`/node-postgres, no ORM. See
// tecnologias/tecnologia_bbdd.md "Client / driver".
import { SQL } from 'bun';
import type { SqlExecutor } from './sql-executor';

/**
 * Wraps `new SQL(databaseUrl)` behind our own `SqlExecutor` structural interface.
 * Bun.SQL doesn't connect eagerly, so this never throws for a syntactically valid
 * connection string — actual connectivity is only exercised once a query runs.
 */
export function createPgClient(databaseUrl: string): SqlExecutor {
  return new SQL(databaseUrl) as unknown as SqlExecutor;
}
