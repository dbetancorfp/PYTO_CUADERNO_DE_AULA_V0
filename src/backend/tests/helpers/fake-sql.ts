// Shared Bun.SQL double for unit-testing Postgres repositories, matching the SqlExecutor
// structural interface (src/backend/src/db/sql-executor.ts) without touching a real
// database. Created once, reused by every view's pg-<entity>.repository.test.ts — see
// tdd-engineer.md's "Postgres repositories always get their own unit test".

export interface FakeSqlCall {
  strings: TemplateStringsArray;
  values: unknown[];
}

export type FakeSql = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Record<string, unknown>[]>;
  calls: FakeSqlCall[];
};

/**
 * Each call to the returned fake consumes the next entry in `responses`, in order. If
 * `responses` is exhausted, further calls resolve to an empty array.
 */
export function createFakeSql(responses: Record<string, unknown>[][]): FakeSql {
  const calls: FakeSqlCall[] = [];
  let callIndex = 0;

  const fakeSql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ strings, values });
    const response = responses[callIndex] ?? [];
    callIndex += 1;
    return Promise.resolve(response);
  }) as FakeSql;

  fakeSql.calls = calls;
  return fakeSql;
}

/** Flattens a tagged-template call's strings+values back into one SQL-ish string, for
 * assertions like `expect(sqlTextOf(call)).toContain('UPDATE users')`. */
export function sqlTextOf(call: FakeSqlCall): string {
  return call.strings.reduce((acc, part, i) => acc + part + (i < call.values.length ? `$${i + 1}` : ''), '');
}
