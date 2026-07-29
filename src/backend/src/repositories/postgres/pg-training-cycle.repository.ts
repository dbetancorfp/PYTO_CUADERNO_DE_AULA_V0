import type { SqlExecutor } from '../../db/sql-executor';
import type {
  ReferencingAcademicYear,
  TrainingCycle,
  TrainingCycleRepository,
} from '../training-cycle.repository';

interface TrainingCycleRow {
  id: string;
  teacher_id: string;
  name: string;
}

function toTrainingCycle(row: TrainingCycleRow): TrainingCycle {
  return { id: row.id, teacherId: row.teacher_id, name: row.name };
}

/** Real `TrainingCycleRepository` implementation against Postgres via `Bun.SQL` (see
 * tecnologias/tecnologia_bbdd.md "Client / driver"). */
export class PgTrainingCycleRepository implements TrainingCycleRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findAllForTeacher(teacherId: string): Promise<TrainingCycle[]> {
    const rows = (await this.sql`
      SELECT id, teacher_id, name
      FROM training_cycles
      WHERE teacher_id = ${teacherId}
    `) as unknown as TrainingCycleRow[];
    return rows.map(toTrainingCycle);
  }

  async findById(teacherId: string, id: string): Promise<TrainingCycle | null> {
    const rows = (await this.sql`
      SELECT id, teacher_id, name
      FROM training_cycles
      WHERE teacher_id = ${teacherId} AND id = ${id}
    `) as unknown as TrainingCycleRow[];
    const [row] = rows;
    return row ? toTrainingCycle(row) : null;
  }

  async findByName(teacherId: string, name: string): Promise<TrainingCycle | null> {
    const rows = (await this.sql`
      SELECT id, teacher_id, name
      FROM training_cycles
      WHERE teacher_id = ${teacherId} AND name = ${name}
    `) as unknown as TrainingCycleRow[];
    const [row] = rows;
    return row ? toTrainingCycle(row) : null;
  }

  async create(teacherId: string, name: string): Promise<TrainingCycle> {
    const rows = (await this.sql`
      INSERT INTO training_cycles (teacher_id, name)
      VALUES (${teacherId}, ${name})
      RETURNING id, teacher_id, name
    `) as unknown as TrainingCycleRow[];
    return toTrainingCycle(rows[0]!);
  }

  async rename(id: string, name: string): Promise<TrainingCycle> {
    const rows = (await this.sql`
      UPDATE training_cycles
      SET name = ${name}
      WHERE id = ${id}
      RETURNING id, teacher_id, name
    `) as unknown as TrainingCycleRow[];
    return toTrainingCycle(rows[0]!);
  }

  async delete(id: string): Promise<void> {
    await this.sql`
      DELETE FROM training_cycles
      WHERE id = ${id}
    `;
  }

  async findReferencingAcademicYears(cycleId: string): Promise<ReferencingAcademicYear[]> {
    const rows = (await this.sql`
      SELECT DISTINCT ay.id, ay.name
      FROM academic_years ay
      JOIN academic_year_modules aym ON aym.academic_year_id = ay.id
      JOIN modules m ON m.id = aym.module_id
      WHERE m.training_cycle_id = ${cycleId}
    `) as unknown as ReferencingAcademicYear[];
    return rows.map((row) => ({ id: row.id, name: row.name }));
  }
}
