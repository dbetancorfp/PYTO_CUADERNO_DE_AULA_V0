import type { AcademicYearModuleRepository } from '../academic-year-module.repository';
import type { ConfiguracionStore } from './configuracion-store';

/** In-memory double for `AcademicYearModuleRepository` — used in unit tests and
 * `DATA_BACKEND=memory` mode (see tecnologias/tecnologia_bbdd.md "Data access pattern").
 * Shares a `ConfiguracionStore` with the other Configuración in-memory repositories. */
export class InMemoryAcademicYearModuleRepository implements AcademicYearModuleRepository {
  constructor(private readonly store: ConfiguracionStore) {}

  async findModuleIdsForYear(academicYearId: string): Promise<string[]> {
    return [...(this.store.selections.get(academicYearId) ?? new Set<string>())];
  }

  async replaceSelection(academicYearId: string, moduleIds: string[]): Promise<void> {
    this.store.selections.set(academicYearId, new Set(moduleIds));
  }
}
