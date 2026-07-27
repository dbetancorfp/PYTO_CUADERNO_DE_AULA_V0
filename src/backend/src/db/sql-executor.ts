// Our own structural interfaces scoping the surface repositories need from Bun.SQL — not
// Bun's own types directly — so repositories can be unit-tested against a plain function
// double (see src/backend/tests/helpers/fake-sql.ts) instead of a real Postgres connection.
// See tecnologias/tecnologia_bbdd.md "Client / driver".

export interface SqlExecutor {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Record<string, unknown>[]>;
}
