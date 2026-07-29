import type { AcademicYear, AcademicYearRepository } from '../academic-year.repository';
import type { ConfiguracionStore } from './configuracion-store';

/** In-memory double for `AcademicYearRepository` — used in unit tests and
 * `DATA_BACKEND=memory` mode (see tecnologias/tecnologia_bbdd.md "Data access pattern").
 * Shares a `ConfiguracionStore` with the other Configuración in-memory repositories. */
export class InMemoryAcademicYearRepository implements AcademicYearRepository {
  constructor(private readonly store: ConfiguracionStore) {}

  async findAllForTeacher(teacherId: string): Promise<AcademicYear[]> {
    return [...this.store.academicYears.values()].filter((year) => year.teacherId === teacherId);
  }

  async findById(teacherId: string, id: string): Promise<AcademicYear | null> {
    const year = this.store.academicYears.get(id);
    return year && year.teacherId === teacherId ? year : null;
  }

  async findByName(teacherId: string, name: string): Promise<AcademicYear | null> {
    return (
      [...this.store.academicYears.values()].find(
        (year) => year.teacherId === teacherId && year.name === name,
      ) ?? null
    );
  }

  async create(teacherId: string, name: string): Promise<AcademicYear> {
    const year: AcademicYear = { id: crypto.randomUUID(), teacherId, name, isCurrent: false };
    this.store.academicYears.set(year.id, year);
    return year;
  }

  async rename(id: string, name: string): Promise<AcademicYear> {
    const existing = this.store.academicYears.get(id);
    if (!existing) throw new Error(`Academic year ${id} not found`);

    const updated: AcademicYear = { ...existing, name };
    this.store.academicYears.set(id, updated);
    return updated;
  }

  async setCurrent(teacherId: string, id: string): Promise<AcademicYear> {
    // Mirrors schema-changes.sql's `academic_years_one_current_per_teacher` partial unique
    // index: exactly one row current per teacher at a time, or none.
    for (const [yearId, year] of this.store.academicYears) {
      if (year.teacherId === teacherId && year.isCurrent) {
        this.store.academicYears.set(yearId, { ...year, isCurrent: false });
      }
    }
    const existing = this.store.academicYears.get(id);
    if (!existing) throw new Error(`Academic year ${id} not found`);

    const updated: AcademicYear = { ...existing, isCurrent: true };
    this.store.academicYears.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    // Mirrors schema-changes.sql's `academic_year_modules.academic_year_id ... ON DELETE
    // CASCADE` — deleting the year also deletes its selection rows.
    this.store.selections.delete(id);
    this.store.academicYears.delete(id);
  }
}
