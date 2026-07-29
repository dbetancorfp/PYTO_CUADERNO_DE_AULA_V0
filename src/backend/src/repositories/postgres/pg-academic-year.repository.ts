import type { SqlExecutor } from '../../db/sql-executor';
import type { AcademicYear, AcademicYearRepository } from '../academic-year.repository';

interface AcademicYearRow {
  id: string;
  teacher_id: string;
  name: string;
  is_current: boolean;
}

function toAcademicYear(row: AcademicYearRow): AcademicYear {
  return { id: row.id, teacherId: row.teacher_id, name: row.name, isCurrent: row.is_current };
}

/** Real `AcademicYearRepository` implementation against Postgres via `Bun.SQL` (see
 * tecnologias/tecnologia_bbdd.md "Client / driver"). */
export class PgAcademicYearRepository implements AcademicYearRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findAllForTeacher(teacherId: string): Promise<AcademicYear[]> {
    const rows = (await this.sql`
      SELECT id, teacher_id, name, is_current
      FROM academic_years
      WHERE teacher_id = ${teacherId}
    `) as unknown as AcademicYearRow[];
    return rows.map(toAcademicYear);
  }

  async findById(teacherId: string, id: string): Promise<AcademicYear | null> {
    const rows = (await this.sql`
      SELECT id, teacher_id, name, is_current
      FROM academic_years
      WHERE teacher_id = ${teacherId} AND id = ${id}
    `) as unknown as AcademicYearRow[];
    const [row] = rows;
    return row ? toAcademicYear(row) : null;
  }

  async findByName(teacherId: string, name: string): Promise<AcademicYear | null> {
    const rows = (await this.sql`
      SELECT id, teacher_id, name, is_current
      FROM academic_years
      WHERE teacher_id = ${teacherId} AND name = ${name}
    `) as unknown as AcademicYearRow[];
    const [row] = rows;
    return row ? toAcademicYear(row) : null;
  }

  async create(teacherId: string, name: string): Promise<AcademicYear> {
    const rows = (await this.sql`
      INSERT INTO academic_years (teacher_id, name, is_current)
      VALUES (${teacherId}, ${name}, FALSE)
      RETURNING id, teacher_id, name, is_current
    `) as unknown as AcademicYearRow[];
    return toAcademicYear(rows[0]!);
  }

  async rename(id: string, name: string): Promise<AcademicYear> {
    const rows = (await this.sql`
      UPDATE academic_years
      SET name = ${name}
      WHERE id = ${id}
      RETURNING id, teacher_id, name, is_current
    `) as unknown as AcademicYearRow[];
    return toAcademicYear(rows[0]!);
  }

  async setCurrent(teacherId: string, id: string): Promise<AcademicYear> {
    // Two sequential statements (not a single transaction — see
    // views/configuracion/schema-changes.sql's comment on `academic_years_one_current_per_teacher`
    // and tecnologias/tecnologia_bbdd.md): un-mark whichever row was previously current for
    // this teacher, then mark `id` current. Never leaves two rows current for one teacher.
    await this.sql`
      UPDATE academic_years
      SET is_current = FALSE
      WHERE teacher_id = ${teacherId} AND is_current = TRUE
    `;
    const rows = (await this.sql`
      UPDATE academic_years
      SET is_current = TRUE
      WHERE id = ${id}
      RETURNING id, teacher_id, name, is_current
    `) as unknown as AcademicYearRow[];
    return toAcademicYear(rows[0]!);
  }

  async delete(id: string): Promise<void> {
    await this.sql`
      DELETE FROM academic_years
      WHERE id = ${id}
    `;
  }
}
