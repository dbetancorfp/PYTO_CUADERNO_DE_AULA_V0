// Domain shape + repository interface for the `key_dates` table (see
// views/fechas-senaladas/schema-changes.sql). Single, shared, global table — no FK to users
// or academic_years, day/month only, no year (see
// views/fechas-senaladas/description_fechas-senaladas.md's "Domain and scope"). Two
// implementations exist per DIP: in-memory (repositories/in-memory/) and Postgres
// (repositories/postgres/) — see tecnologias/tecnologia_bbdd.md "Data access pattern".

export interface KeyDate {
  id: string;
  category: string;
  name: string;
  startDay: number;
  startMonth: number;
  endDay: number;
  endMonth: number;
  /** Only meaningful for `category === 'public_holidays'` — `null` otherwise. */
  type: string | null;
}

export interface KeyDateRepository {
  findAll(category?: string): Promise<KeyDate[]>;
  findById(id: string): Promise<KeyDate | null>;
  findByNaturalKey(category: string, name: string, startDay: number, startMonth: number): Promise<KeyDate | null>;
  create(data: Omit<KeyDate, 'id'>): Promise<KeyDate>;
  /** `category` is never editable — a row can't move between categories (see
   * api-contracts.md's PATCH endpoint). */
  update(id: string, changes: Partial<Omit<KeyDate, 'id' | 'category'>>): Promise<KeyDate>;
  delete(id: string): Promise<void>;
}
