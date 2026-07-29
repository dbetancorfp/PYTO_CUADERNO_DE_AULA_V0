import type { SqlExecutor } from '../../db/sql-executor';
import type { ReferencingAcademicYear } from '../academic-year-reference';
import type { Module, ModuleRepository, ModuleWithCycleName } from '../module.repository';

interface ModuleRow {
  id: string;
  training_cycle_id: string;
  course: number;
  name: string;
}

interface ModuleWithCycleNameRow extends ModuleRow {
  training_cycle_name: string;
}

function toModule(row: ModuleRow): Module {
  return { id: row.id, trainingCycleId: row.training_cycle_id, course: row.course, name: row.name };
}

function toModuleWithCycleName(row: ModuleWithCycleNameRow): ModuleWithCycleName {
  return { ...toModule(row), trainingCycleName: row.training_cycle_name };
}

/** Real `ModuleRepository` implementation against Postgres via `Bun.SQL` (see
 * tecnologias/tecnologia_bbdd.md "Client / driver"). */
export class PgModuleRepository implements ModuleRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findAllForCycle(trainingCycleId: string): Promise<Module[]> {
    const rows = (await this.sql`
      SELECT id, training_cycle_id, course, name
      FROM modules
      WHERE training_cycle_id = ${trainingCycleId}
    `) as unknown as ModuleRow[];
    return rows.map(toModule);
  }

  async findAllForTeacher(teacherId: string): Promise<ModuleWithCycleName[]> {
    const rows = (await this.sql`
      SELECT m.id, m.training_cycle_id, m.course, m.name, tc.name AS training_cycle_name
      FROM modules m
      JOIN training_cycles tc ON tc.id = m.training_cycle_id
      WHERE tc.teacher_id = ${teacherId}
    `) as unknown as ModuleWithCycleNameRow[];
    return rows.map(toModuleWithCycleName);
  }

  async findById(id: string): Promise<Module | null> {
    const rows = (await this.sql`
      SELECT id, training_cycle_id, course, name
      FROM modules
      WHERE id = ${id}
    `) as unknown as ModuleRow[];
    const [row] = rows;
    return row ? toModule(row) : null;
  }

  async findByNameAndCourse(trainingCycleId: string, course: number, name: string): Promise<Module | null> {
    const rows = (await this.sql`
      SELECT id, training_cycle_id, course, name
      FROM modules
      WHERE training_cycle_id = ${trainingCycleId} AND course = ${course} AND name = ${name}
    `) as unknown as ModuleRow[];
    const [row] = rows;
    return row ? toModule(row) : null;
  }

  async create(trainingCycleId: string, course: number, name: string): Promise<Module> {
    const rows = (await this.sql`
      INSERT INTO modules (training_cycle_id, course, name)
      VALUES (${trainingCycleId}, ${course}, ${name})
      RETURNING id, training_cycle_id, course, name
    `) as unknown as ModuleRow[];
    return toModule(rows[0]!);
  }

  async update(id: string, changes: Partial<Pick<Module, 'name' | 'course'>>): Promise<Module> {
    // A single UPDATE, COALESCE-ing each column against its own current value so only the
    // fields actually present in `changes` are overwritten — no preceding SELECT needed.
    const name = changes.name ?? null;
    const course = changes.course ?? null;
    const rows = (await this.sql`
      UPDATE modules
      SET name = COALESCE(${name}, name), course = COALESCE(${course}, course)
      WHERE id = ${id}
      RETURNING id, training_cycle_id, course, name
    `) as unknown as ModuleRow[];
    return toModule(rows[0]!);
  }

  async delete(id: string): Promise<void> {
    await this.sql`
      DELETE FROM modules
      WHERE id = ${id}
    `;
  }

  async findReferencingAcademicYears(moduleId: string): Promise<ReferencingAcademicYear[]> {
    const rows = (await this.sql`
      SELECT DISTINCT ay.id, ay.name
      FROM academic_years ay
      JOIN academic_year_modules aym ON aym.academic_year_id = ay.id
      WHERE aym.module_id = ${moduleId}
    `) as unknown as ReferencingAcademicYear[];
    return rows.map((row) => ({ id: row.id, name: row.name }));
  }
}
