// Shared in-process store backing InMemoryCalendarioModuloRepository (repositories/in-memory/)
// — mirrors repositories/in-memory/key-date-store.ts's role, but for the per-módulo
// `calendario_modulo` snapshot table (see views/calendario/schema-changes.sql). One instance
// lives for the lifetime of the Express app (see app.ts's composition root).
import type { CalendarioModuloEntry } from '../calendario-modulo.repository';

export class CalendarioModuloStore {
  readonly entries = new Map<string, CalendarioModuloEntry>();
}
