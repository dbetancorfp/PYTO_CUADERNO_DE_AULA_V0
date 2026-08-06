// Shared in-process store backing InMemoryAcademicYearRepository and
// InMemoryAcademicYearModuleRepository (repositories/in-memory/) — mirrors
// repositories/in-memory/catalog-store.ts's role for catalog_cycles/catalog_modules, but for
// the per-teacher academic_years/academic_year_modules tables (see
// views/configuracion/schema-changes.sql). One instance lives for the lifetime of the
// Express app (see app.ts's composition root).
import type { AcademicYear } from '../academic-year.repository';
import type { AcademicYearModuleRef } from '../academic-year-module.repository';

export class AcademicYearStore {
  readonly academicYears = new Map<string, AcademicYear>();
  readonly academicYearModules = new Map<string, AcademicYearModuleRef>();
}
