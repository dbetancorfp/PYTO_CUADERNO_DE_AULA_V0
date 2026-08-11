// Frontend-side contract for the Horario overlay on `calendario-months`/
// `calendario-day-tooltip`/`calendario-legend` (Calendario screen), consumed by
// `calendario-view.ts`. This file only declares the shape the component depends on (DIP);
// the real HTTP client lives in `http-calendario-horario-api-service.ts`, assembled at
// bootstrap in `main.ts`.
//
// See `views/calendario/api-contracts.md`'s `GET /api/calendario-horario` section —
// `calendario_horario` is a snapshot table, read-only from this screen, independent from
// `calendario_modulo` (see UC-13 in `views/calendario/use-cases.md`).

export interface CalendarioHorarioEntry {
  date: string;
  hours: number;
}

export interface CalendarioHorarioApiService {
  findForModule(academicYearModuleId: string): Promise<CalendarioHorarioEntry[]>;
}
