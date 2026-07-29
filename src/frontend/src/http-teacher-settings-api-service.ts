// Concrete `TeacherSettingsApiService` client, wired into `main.ts` at bootstrap — the real
// HTTP calls against `PATCH /api/teacher/name` and `PATCH /api/teacher/password` (see
// views/configuracion/api-contracts.md). `teacher-settings-api-service.ts` only declares
// the interface `TeacherSettingsView` depends on (DIP).
import type { TeacherSettingsApiService, TeacherSettingsWriteOutcome } from './teacher-settings-api-service';

interface MessageBody {
  message: string;
}

async function toWriteOutcome(response: Response): Promise<TeacherSettingsWriteOutcome> {
  const body = (await response.json()) as MessageBody;
  if (response.ok) {
    return { success: true };
  }
  return { success: false, message: body.message };
}

export class HttpTeacherSettingsApiService implements TeacherSettingsApiService {
  async updateFullName(fullName: string): Promise<TeacherSettingsWriteOutcome> {
    const response = await fetch('/api/teacher/name', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName }),
    });
    return toWriteOutcome(response);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<TeacherSettingsWriteOutcome> {
    const response = await fetch('/api/teacher/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return toWriteOutcome(response);
  }
}
