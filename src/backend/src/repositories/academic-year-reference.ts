// Shared shape for "which academic year(s) reference this row" — returned by
// TrainingCycleRepository.findReferencingAcademicYears and
// ModuleRepository.findReferencingAcademicYears (see
// views/configuracion/api-contracts.md's HAS_DEPENDENTS error body).

export interface ReferencingAcademicYear {
  id: string;
  name: string;
}
