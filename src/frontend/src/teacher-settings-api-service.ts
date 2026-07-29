// Frontend-side contract for the Profesor screen's writes, consumed by
// `teacher-settings-view.ts`. Implements `PATCH /api/teacher/name` and
// `PATCH /api/teacher/password` described in views/configuracion/api-contracts.md — this
// file only declares the shape the component depends on (DIP); the real HTTP client
// wiring it to `fetch` lives in `http-teacher-settings-api-service.ts` and is assembled at
// bootstrap in `main.ts`.

export type TeacherSettingsWriteOutcome = { success: true } | { success: false; message: string };

export interface TeacherSettingsApiService {
  updateFullName(fullName: string): Promise<TeacherSettingsWriteOutcome>;
  changePassword(currentPassword: string, newPassword: string): Promise<TeacherSettingsWriteOutcome>;
}
