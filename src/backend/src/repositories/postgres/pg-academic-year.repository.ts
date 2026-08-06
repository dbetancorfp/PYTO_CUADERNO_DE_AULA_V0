import type { SqlExecutor } from '../../db/sql-executor';
import type { AcademicYear, AcademicYearRepository } from '../academic-year.repository';

interface AcademicYearRow {
  id: string;
  teacher_id: string;
  start_year: number;
  is_current: boolean;
}

function toAcademicYear(row: AcademicYearRow): AcademicYear {
  return { id: row.id, teacherId: row.teacher_id, startYear: row.start_year, isCurrent: row.is_current };
}

/** Real `AcademicYearRepository` implementation against Postgres via `Bun.SQL` (see
 * tecnologias/tecnologia_bbdd.md "Client / driver"). */
export class PgAcademicYearRepository implements AcademicYearRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findAllForTeacher(teacherId: string): Promise<AcademicYear[]> {
    const rows = (await this.sql`
      SELECT id, teacher_id, start_year, is_current
      FROM academic_years
      WHERE teacher_id = ${teacherId}
    `) as unknown as AcademicYearRow[];
    return rows.map(toAcademicYear);
  }

  async findById(teacherId: string, id: string): Promise<AcademicYear | null> {
    const rows = (await this.sql`
      SELECT id, teacher_id, start_year, is_current
      FROM academic_years
      WHERE teacher_id = ${teacherId} AND id = ${id}
    `) as unknown as AcademicYearRow[];
    const [row] = rows;
    return row ? toAcademicYear(row) : null;
  }

  async findByStartYear(teacherId: string, startYear: number): Promise<AcademicYear | null> {
    const rows = (await this.sql`
      SELECT id, teacher_id, start_year, is_current
      FROM academic_years
      WHERE teacher_id = ${teacherId} AND start_year = ${startYear}
    `) as unknown as AcademicYearRow[];
    const [row] = rows;
    return row ? toAcademicYear(row) : null;
  }

  async create(teacherId: string, startYear: number): Promise<AcademicYear> {
    const rows = (await this.sql`
      INSERT INTO academic_years (teacher_id, start_year)
      VALUES (${teacherId}, ${startYear})
      RETURNING id, teacher_id, start_year, is_current
    `) as unknown as AcademicYearRow[];
    return toAcademicYear(rows[0]!);
  }

  async rename(id: string, startYear: number): Promise<AcademicYear> {
    const rows = (await this.sql`
      UPDATE academic_years
      SET start_year = ${startYear}
      WHERE id = ${id}
      RETURNING id, teacher_id, start_year, is_current
    `) as unknown as AcademicYearRow[];
    return toAcademicYear(rows[0]!);
  }

  async markCurrent(teacherId: string, id: string): Promise<AcademicYear> {
    // Two sequential statements — SqlExecutor (see db/sql-executor.ts) exposes no
    // transaction primitive shared elsewhere in this codebase; the row that must be
    // returned to the caller is fetched first so it doesn't depend on the second
    // statement's (empty) result.
    const rows = (await this.sql`
      UPDATE academic_years
      SET is_current = true
      WHERE teacher_id = ${teacherId} AND id = ${id}
      RETURNING id, teacher_id, start_year, is_current
    `) as unknown as AcademicYearRow[];
    await this.sql`
      UPDATE academic_years
      SET is_current = false
      WHERE teacher_id = ${teacherId} AND id != ${id}
    `;
    return toAcademicYear(rows[0]!);
  }

  async delete(id: string): Promise<void> {
    await this.sql`
      DELETE FROM academic_years
      WHERE id = ${id}
    `;
  }
}
