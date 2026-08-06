// elementId: catalog-training-cycle-table, catalog-training-cycle-table-add-button
// (business-logic side of UC-04, see views/configuracion/use-cases.md). Shared, global
// catalog — no per-teacher scoping (official BOC curricula are the same for every teacher,
// see schema-changes.sql's header comment). catalog_modules' FK to catalog_cycles is
// ON DELETE CASCADE, but as of the 2026-08-06 fix for #4 that cascade is blocked with a 409
// when any of the cycle's módulos is still assigned to an academic year — deleting one out
// from under academic_year_modules would otherwise 500 (that FK has no cascade of its own).
import { DomainError } from '../errors/domain-error';
import type { AcademicYearModuleRepository } from '../repositories/academic-year-module.repository';
import type {
  CatalogTrainingCycle,
  CatalogTrainingCycleRepository,
} from '../repositories/catalog-training-cycle.repository';

export class CatalogTrainingCycleService {
  constructor(
    private readonly catalogTrainingCycleRepository: CatalogTrainingCycleRepository,
    private readonly academicYearModuleRepository: AcademicYearModuleRepository,
  ) {}

  async list(): Promise<CatalogTrainingCycle[]> {
    return this.catalogTrainingCycleRepository.findAll();
  }

  async create(name: string): Promise<CatalogTrainingCycle> {
    const existing = await this.catalogTrainingCycleRepository.findByName(name);
    if (existing) {
      throw new DomainError('DUPLICATE_NAME', `A training cycle named "${name}" already exists`);
    }
    return this.catalogTrainingCycleRepository.create(name);
  }

  /** Returns `null` when `id` doesn't match a cycle. */
  async rename(id: string, name: string): Promise<CatalogTrainingCycle | null> {
    const cycle = await this.catalogTrainingCycleRepository.findById(id);
    if (!cycle) return null;

    const existing = await this.catalogTrainingCycleRepository.findByName(name);
    if (existing && existing.id !== id) {
      throw new DomainError('DUPLICATE_NAME', `A training cycle named "${name}" already exists`);
    }
    return this.catalogTrainingCycleRepository.rename(id, name);
  }

  /** Returns `null` when `id` doesn't match a cycle. Throws `HAS_DEPENDENTS` when some
   * academic year still has one of this cycle's módulos assigned. */
  async delete(id: string): Promise<void | null> {
    const cycle = await this.catalogTrainingCycleRepository.findById(id);
    if (!cycle) return null;

    const stillAssigned = await this.academicYearModuleRepository.existsForCatalogCycle(id);
    if (stillAssigned) {
      throw new DomainError('HAS_DEPENDENTS', 'This training cycle still has a módulo assigned to an academic year');
    }

    await this.catalogTrainingCycleRepository.delete(id);
  }
}
