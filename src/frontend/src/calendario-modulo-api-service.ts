// Frontend-side contract for `calendario-months`/`calendario-empty-state`/
// `calendario-day-toast` (Calendario screen), consumed by `calendario-view.ts`. This file
// only declares the shape the component depends on (DIP); the real HTTP client lives in
// `http-calendario-modulo-api-service.ts`, assembled at bootstrap in `main.ts`.
//
// See `views/calendario/api-contracts.md`'s `GET /api/calendario-modulo` section —
// `calendario_modulo` is a snapshot table, read-only from this screen (never key_dates
// directly, see `views/calendario/description_calendario.md`).

export interface CalendarioModuloEntry {
  id: string;
  category: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface CalendarioModuloApiService {
  findForModule(academicYearModuleId: string): Promise<CalendarioModuloEntry[]>;
}
