// Idempotently seeds `key_dates` with the Canary Islands' official school calendar
// template (day/month only, no year) — see
// views/fechas-senaladas/description_fechas-senaladas.md's "Seeding — auto-loaded on every
// backend boot". Run automatically on every `DATA_BACKEND=postgres` boot (see index.ts),
// the same guarantee seedCatalogCurriculum gives catalog_cycles/catalog_modules, for the
// same reason (reference data a test run or manual cleanup could otherwise wipe).
// Transcribed here as a TypeScript constant from documentation/calendario_dias_clave.json
// (a local-only, .gitignore'd file, not read at runtime) — see that file for the source of
// truth if this data is ever revised. `ON CONFLICT (category, name, start_day, start_month)
// DO NOTHING` matches key_dates_natural_key_idx (schema-changes.sql) — safe to run every
// time, never duplicates.
import type { SqlExecutor } from './sql-executor';

type KeyDateCategory =
  | 'academic_key_dates'
  | 'holidays'
  | 'public_holidays'
  | 'free_disposal_days'
  | 'evaluations'
  | 'feoe_project_days';

interface KeyDateSeed {
  category: KeyDateCategory;
  name: string;
  /** "DD/MM" — a single-day entry repeats the same value for `end`. */
  start: string;
  end: string;
  type?: string;
}

function singleDay(category: KeyDateCategory, name: string, date: string, type?: string): KeyDateSeed {
  return { category, name, start: date, end: date, type };
}

// fechas_clave_fp -> academic_key_dates (4 rows, all ranges).
const ACADEMIC_KEY_DATES: KeyDateSeed[] = [
  { category: 'academic_key_dates', name: 'Curso escolar', start: '01/09', end: '31/07' },
  { category: 'academic_key_dates', name: '1º de Grado Superior de FP.', start: '16/09', end: '22/06' },
  { category: 'academic_key_dates', name: '2º de Grado Superior de FP.', start: '16/09', end: '27/05' },
  { category: 'academic_key_dates', name: '2º Presentación de proyectos.', start: '17/05', end: '21/05' },
];

// vacaciones -> holidays (2 rows, all ranges).
const HOLIDAYS: KeyDateSeed[] = [
  { category: 'holidays', name: 'Vacaciones de Navidad.', start: '22/12', end: '07/01' },
  { category: 'holidays', name: 'Semana Santa.', start: '22/03', end: '26/03' },
];

// dias_festivos -> public_holidays (10 rows, single day + tipo).
const PUBLIC_HOLIDAYS: KeyDateSeed[] = [
  singleDay('public_holidays', 'Fiesta Nacional de España.', '12/10', 'Nacional'),
  singleDay('public_holidays', 'Todos los Santos.', '01/11', 'Nacional'),
  singleDay('public_holidays', 'Día del Enseñante y del Estudiante.', '27/11', 'Autonómico / Escolar'),
  singleDay('public_holidays', 'Día de la Constitución.', '06/12', 'Nacional'),
  singleDay('public_holidays', 'Día de la Inmaculada Concepción.', '08/12', 'Nacional'),
  singleDay('public_holidays', 'Virgen de la Candelaria.', '02/02', 'Insular (Tenerife)'),
  singleDay('public_holidays', 'Día de Canarias.', '30/05', 'Autonómico'),
  singleDay('public_holidays', 'Gran Poder de Dios.', '13/07', 'Local (Puerto de la Cruz)'),
  singleDay('public_holidays', 'Virgen del Carmen.', '14/07', 'Local (Puerto de la Cruz)'),
  singleDay('public_holidays', 'Martes de Carnaval.', '09/02', 'Insular (Tenerife)'),
];

// libre_disposicion -> free_disposal_days (4 rows, single day, no tipo).
const FREE_DISPOSAL_DAYS: KeyDateSeed[] = [
  singleDay('free_disposal_days', 'Día de libre disposición, puente de Todos los Santos', '03/11'),
  singleDay('free_disposal_days', 'Día de libre disposición, lunes de Carnaval.', '08/02'),
  singleDay('free_disposal_days', 'Día de libre disposición, martes de Carnaval.', '09/02'),
  singleDay('free_disposal_days', 'Día de libre disposición, puente de mayo.', '03/05'),
];

// evaluaciones -> evaluations (13 rows, all ranges).
const EVALUATIONS: KeyDateSeed[] = [
  { category: 'evaluations', name: 'Sesión de evaluación sin nota.', start: '19/10', end: '21/10' },
  { category: 'evaluations', name: '1ª Evaluación - Último día para poner notas.', start: '11/12', end: '11/12' },
  { category: 'evaluations', name: '1ª Evaluación - Sesión de evaluación con nota.', start: '14/12', end: '16/12' },
  { category: 'evaluations', name: '1ª Evaluación - Atención familiar.', start: '17/12', end: '17/12' },
  { category: 'evaluations', name: '2ª Evaluación (2º) - Último día para poner notas.', start: '17/02', end: '17/02' },
  { category: 'evaluations', name: '2ª Evaluación (2º) - Sesión de evaluación con nota.', start: '18/02', end: '18/02' },
  { category: 'evaluations', name: '2ª Evaluación (2º) - Atención familiar.', start: '22/02', end: '22/02' },
  { category: 'evaluations', name: '2ª Evaluación (1º) - Último día para poner notas.', start: '12/03', end: '12/03' },
  { category: 'evaluations', name: '2ª Evaluación (1º) - Sesión de evaluación con nota.', start: '15/03', end: '17/03' },
  { category: 'evaluations', name: '2ª Evaluación (1º) - Atención familiar.', start: '18/03', end: '18/03' },
  { category: 'evaluations', name: '3ª Evaluación (1º) - Último día para poner notas.', start: '11/06', end: '11/06' },
  { category: 'evaluations', name: '3ª Evaluación (1º) - Sesión de evaluación con nota.', start: '14/06', end: '16/06' },
  { category: 'evaluations', name: '3ª Evaluación (1º) - Atención familiar.', start: '17/03', end: '17/03' },
];

// proyecto_basado_en_retos_FEOE -> feoe_project_days (10 rows, single day, no tipo). The
// second "Dia de alternancia 4" was renamed to "5" upstream (see description's "Categories"
// note) — this list matches the corrected source file, not the earlier broken one.
const FEOE_PROJECT_DAYS: KeyDateSeed[] = [
  singleDay('feoe_project_days', '1º - Dia de alternancia 1.', '10/05'),
  singleDay('feoe_project_days', '1º - Dia de alternancia 2.', '18/05'),
  singleDay('feoe_project_days', '1º - Dia de alternancia 3.', '26/05'),
  singleDay('feoe_project_days', '1º - Dia de alternancia 4.', '03/06'),
  singleDay('feoe_project_days', '1º - Dia de alternancia 5.', '11/06'),
  singleDay('feoe_project_days', '2º - Dia de alternancia 1.', '26/02'),
  singleDay('feoe_project_days', '2º - Dia de alternancia 2.', '11/03'),
  singleDay('feoe_project_days', '2º - Dia de alternancia 3.', '31/03'),
  singleDay('feoe_project_days', '2º - Dia de alternancia 4.', '13/04'),
  singleDay('feoe_project_days', '2º - Dia de alternancia 5.', '26/04'),
];

const SEED: KeyDateSeed[] = [
  ...ACADEMIC_KEY_DATES,
  ...HOLIDAYS,
  ...PUBLIC_HOLIDAYS,
  ...FREE_DISPOSAL_DAYS,
  ...EVALUATIONS,
  ...FEOE_PROJECT_DAYS,
];

interface DayMonth {
  day: number;
  month: number;
}

function parseDayMonth(value: string): DayMonth {
  const [day, month] = value.split('/').map(Number);
  return { day: day!, month: month! };
}

export async function seedKeyDates(sql: SqlExecutor): Promise<void> {
  for (const entry of SEED) {
    const start = parseDayMonth(entry.start);
    const end = parseDayMonth(entry.end);
    await sql`
      INSERT INTO key_dates (category, name, start_day, start_month, end_day, end_month, type)
      VALUES (${entry.category}, ${entry.name}, ${start.day}, ${start.month}, ${end.day}, ${end.month}, ${entry.type ?? null})
      ON CONFLICT (category, name, start_day, start_month) DO NOTHING
    `;
  }
}
