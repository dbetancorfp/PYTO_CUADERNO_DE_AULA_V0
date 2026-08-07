import type { SqlExecutor } from '../../db/sql-executor';
import type { KeyDate, KeyDateRepository } from '../key-date.repository';

interface KeyDateRow {
  id: string;
  category: string;
  name: string;
  start_day: number;
  start_month: number;
  end_day: number;
  end_month: number;
  type: string | null;
}

function toKeyDate(row: KeyDateRow): KeyDate {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    startDay: row.start_day,
    startMonth: row.start_month,
    endDay: row.end_day,
    endMonth: row.end_month,
    type: row.type,
  };
}

/** Real `KeyDateRepository` implementation against Postgres via `Bun.SQL` (see
 * tecnologias/tecnologia_bbdd.md "Client / driver"). */
export class PgKeyDateRepository implements KeyDateRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findAll(category?: string): Promise<KeyDate[]> {
    const rows = (
      category === undefined
        ? await this.sql`
            SELECT id, category, name, start_day, start_month, end_day, end_month, type
            FROM key_dates
          `
        : await this.sql`
            SELECT id, category, name, start_day, start_month, end_day, end_month, type
            FROM key_dates
            WHERE category = ${category}
          `
    ) as unknown as KeyDateRow[];
    return rows.map(toKeyDate);
  }

  async findById(id: string): Promise<KeyDate | null> {
    const rows = (await this.sql`
      SELECT id, category, name, start_day, start_month, end_day, end_month, type
      FROM key_dates
      WHERE id = ${id}
    `) as unknown as KeyDateRow[];
    const [row] = rows;
    return row ? toKeyDate(row) : null;
  }

  async findByNaturalKey(category: string, name: string, startDay: number, startMonth: number): Promise<KeyDate | null> {
    const rows = (await this.sql`
      SELECT id, category, name, start_day, start_month, end_day, end_month, type
      FROM key_dates
      WHERE category = ${category} AND name = ${name} AND start_day = ${startDay} AND start_month = ${startMonth}
    `) as unknown as KeyDateRow[];
    const [row] = rows;
    return row ? toKeyDate(row) : null;
  }

  async create(data: Omit<KeyDate, 'id'>): Promise<KeyDate> {
    const rows = (await this.sql`
      INSERT INTO key_dates (category, name, start_day, start_month, end_day, end_month, type)
      VALUES (${data.category}, ${data.name}, ${data.startDay}, ${data.startMonth}, ${data.endDay}, ${data.endMonth}, ${data.type})
      RETURNING id, category, name, start_day, start_month, end_day, end_month, type
    `) as unknown as KeyDateRow[];
    return toKeyDate(rows[0]!);
  }

  async update(id: string, changes: Partial<Omit<KeyDate, 'id' | 'category'>>): Promise<KeyDate> {
    // A single UPDATE, COALESCE-ing each column against its own current value so only the
    // fields actually present in `changes` are overwritten — no preceding SELECT needed
    // (same pattern as pg-catalog-module.repository.ts's update). `category` is excluded
    // from `changes`'s type — a row can't move between categories.
    const name = changes.name ?? null;
    const startDay = changes.startDay ?? null;
    const startMonth = changes.startMonth ?? null;
    const endDay = changes.endDay ?? null;
    const endMonth = changes.endMonth ?? null;
    const type = changes.type ?? null;
    const rows = (await this.sql`
      UPDATE key_dates
      SET name = COALESCE(${name}, name),
          start_day = COALESCE(${startDay}, start_day),
          start_month = COALESCE(${startMonth}, start_month),
          end_day = COALESCE(${endDay}, end_day),
          end_month = COALESCE(${endMonth}, end_month),
          type = COALESCE(${type}, type)
      WHERE id = ${id}
      RETURNING id, category, name, start_day, start_month, end_day, end_month, type
    `) as unknown as KeyDateRow[];
    return toKeyDate(rows[0]!);
  }

  async delete(id: string): Promise<void> {
    await this.sql`
      DELETE FROM key_dates
      WHERE id = ${id}
    `;
  }
}
