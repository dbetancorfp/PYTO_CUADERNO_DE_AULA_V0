import type { AcademicYear, AcademicYearRepository } from '../academic-year.repository';
import type { AcademicYearStore } from './academic-year-store';

/** In-memory double for `AcademicYearRepository` — used in unit tests and
 * `DATA_BACKEND=memory` mode (see tecnologias/tecnologia_bbdd.md "Data access pattern"). */
export class InMemoryAcademicYearRepository implements AcademicYearRepository {
  constructor(private readonly store: AcademicYearStore) {}

  async findAllForTeacher(teacherId: string): Promise<AcademicYear[]> {
    return [...this.store.academicYears.values()].filter((year) => year.teacherId === teacherId);
  }

  async findById(teacherId: string, id: string): Promise<AcademicYear | null> {
    const year = this.store.academicYears.get(id);
    return year?.teacherId === teacherId ? year : null;
  }

  async findByStartYear(teacherId: string, startYear: number): Promise<AcademicYear | null> {
    return (
      [...this.store.academicYears.values()].find(
        (year) => year.teacherId === teacherId && year.startYear === startYear,
      ) ?? null
    );
  }

  async create(teacherId: string, startYear: number): Promise<AcademicYear> {
    const year: AcademicYear = { id: crypto.randomUUID(), teacherId, startYear, isCurrent: false };
    this.store.academicYears.set(year.id, year);
    return year;
  }

  async rename(id: string, startYear: number): Promise<AcademicYear> {
    const existing = this.store.academicYears.get(id);
    if (!existing) throw new Error(`Academic year ${id} not found`);

    const updated: AcademicYear = { ...existing, startYear };
    this.store.academicYears.set(id, updated);
    return updated;
  }

  async markCurrent(teacherId: string, id: string): Promise<AcademicYear> {
    const existing = this.store.academicYears.get(id);
    if (!existing) throw new Error(`Academic year ${id} not found`);

    for (const year of this.store.academicYears.values()) {
      if (year.teacherId === teacherId && year.isCurrent) {
        this.store.academicYears.set(year.id, { ...year, isCurrent: false });
      }
    }
    const updated: AcademicYear = { ...existing, isCurrent: true };
    this.store.academicYears.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.store.academicYears.delete(id);
  }
}
