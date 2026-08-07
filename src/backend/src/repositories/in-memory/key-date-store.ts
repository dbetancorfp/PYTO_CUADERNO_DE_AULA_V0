// Shared in-process store backing InMemoryKeyDateRepository (repositories/in-memory/) —
// mirrors repositories/in-memory/catalog-store.ts's role, but for the single, shared,
// global `key_dates` table (see views/fechas-senaladas/schema-changes.sql). One instance
// lives for the lifetime of the Express app (see app.ts's composition root).
import type { KeyDate } from '../key-date.repository';

export class KeyDateStore {
  readonly keyDates = new Map<string, KeyDate>();
}
