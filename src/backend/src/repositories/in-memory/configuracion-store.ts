// Shared in-process store backing every in-memory Configuración repository
// (InMemoryTrainingCycleRepository, InMemoryModuleRepository, InMemoryAcademicYearRepository,
// InMemoryAcademicYearModuleRepository — repositories/in-memory/). Unlike InMemoryUserRepository
// (a single, self-contained entity), Configuración's dependency-blocked deletion rules span
// four tables (training_cycles, modules, academic_years, academic_year_modules), so the
// `DATA_BACKEND=memory` implementations need to read across each other's rows the same way
// the Postgres implementations join across real tables — see tecnologias/tecnologia_bbdd.md
// "Data access pattern". One instance lives for the lifetime of the Express app (see
// app.ts's composition root), shared across the four repository instances it's injected into.

export interface TrainingCycleRow {
  id: string;
  teacherId: string;
  name: string;
}

export interface ModuleRow {
  id: string;
  trainingCycleId: string;
  course: number;
  name: string;
}

export interface AcademicYearRow {
  id: string;
  teacherId: string;
  name: string;
  isCurrent: boolean;
}

export class ConfiguracionStore {
  readonly trainingCycles = new Map<string, TrainingCycleRow>();
  readonly modules = new Map<string, ModuleRow>();
  readonly academicYears = new Map<string, AcademicYearRow>();
  /** academicYearId -> set of selected moduleIds. */
  readonly selections = new Map<string, Set<string>>();
}
