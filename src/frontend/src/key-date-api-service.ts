// Frontend-side contract for the six key_dates category tables (Fechas señaladas screen —
// academic-key-dates-table, holidays-table, public-holidays-table, free-disposal-days-table,
// evaluations-table, feoe-project-days-table), consumed by `key-date-settings-view.ts`. This
// file only declares the shape the component depends on (DIP); the real HTTP client lives in
// `http-key-date-api-service.ts`, assembled at bootstrap in `main.ts`. See
// views/fechas-senaladas/api-contracts.md.
//
// `key_dates` is a single, shared, global resource (no FK to users/academic_years) — one
// REST resource filtered/tagged by `category`, not six (see api-contracts.md's "one
// resource, not six"). Day/month only, no year.
import type { DeleteResult, WriteResult } from './api-outcomes';

export interface KeyDate {
  id: string;
  category: string;
  name: string;
  startDay: number;
  startMonth: number;
  endDay: number;
  endMonth: number;
  type: string | null;
}

/** `endDay`/`endMonth` are required even for single-day categories — the caller sends the
 * same value as `startDay`/`startMonth` for those (see api-contracts.md's "Category
 * values"), the backend never infers it. */
export interface KeyDateCreateData {
  category: string;
  name: string;
  startDay: number;
  startMonth: number;
  endDay: number;
  endMonth: number;
  type?: string | null;
}

export interface KeyDateApiService {
  list(category: string): Promise<KeyDate[]>;
  create(data: KeyDateCreateData): Promise<WriteResult<KeyDate>>;
  update(id: string, changes: Partial<KeyDateCreateData>): Promise<WriteResult<KeyDate>>;
  remove(id: string): Promise<DeleteResult>;
}
