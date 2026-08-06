// Seeds catalog_cycles/catalog_modules with the official BOC curriculum for the two
// Informática y Comunicaciones ciclos this project currently covers — Desarrollo de
// Aplicaciones Multiplataforma (DAM) and Desarrollo de Aplicaciones Web (DAW), per
// boc-a-2024-226-3747 (documentation/desarrollo_aplicaciones_multiplataformas.pdf,
// documentation/desarrollo_aplicaciones_web.pdf — not committed, local reference only).
// Idempotent (ON CONFLICT DO NOTHING against catalog_cycles.name's and catalog_modules'
// (cycle, course, name) unique constraints) — safe to re-run. Not part of
// scripts/db-seed-e2e.ts: that script is Cypress test fixtures, this is real catalog data.
import { SQL } from 'bun';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to seed the catalog curriculum.');
}

const sql = new SQL(databaseUrl);

const CURSO_1_MODULES: { name: string; course: number }[] = [
  { name: 'Lenguajes de marcas y sistemas de gestión de información', course: 1 },
  { name: 'Sistemas informáticos', course: 1 },
  { name: 'Base de datos', course: 1 },
  { name: 'Programación', course: 1 },
  { name: 'Entornos de desarrollo', course: 1 },
  { name: 'Inglés profesional', course: 1 },
  { name: 'Digitalización aplicada a los sectores productivos', course: 1 },
  { name: 'Itinerario personal para la empleabilidad I', course: 1 },
];

const CYCLES: { name: string; curso2: { name: string; course: number }[] }[] = [
  {
    name: 'Desarrollo de Aplicaciones Multiplataforma',
    curso2: [
      { name: 'Acceso a datos', course: 2 },
      { name: 'Desarrollo de interfaces', course: 2 },
      { name: 'Programación multimedia y dispositivos móviles', course: 2 },
      { name: 'Programación de servicios y procesos', course: 2 },
      { name: 'Sistemas de gestión empresarial', course: 2 },
      { name: 'Sostenibilidad aplicada al sistema productivo', course: 2 },
      { name: 'Itinerario personal para la empleabilidad II', course: 2 },
      { name: 'Proyecto intermodular de desarrollo de aplicaciones multiplataforma', course: 2 },
    ],
  },
  {
    name: 'Desarrollo de Aplicaciones Web',
    curso2: [
      { name: 'Desarrollo web en entorno cliente', course: 2 },
      { name: 'Desarrollo web en entorno servidor', course: 2 },
      { name: 'Despliegue de aplicaciones web', course: 2 },
      { name: 'Diseño de interfaces web', course: 2 },
      { name: 'Sostenibilidad aplicada al sistema productivo', course: 2 },
      { name: 'Itinerario personal para la empleabilidad II', course: 2 },
      { name: 'Proyecto intermodular de desarrollo de aplicaciones web', course: 2 },
    ],
  },
];

async function seedCycle(cycleName: string, modules: { name: string; course: number }[]): Promise<void> {
  const rows = (await sql`
    INSERT INTO catalog_cycles (name)
    VALUES (${cycleName})
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `) as unknown as { id: string }[];
  const cycleId = rows[0]!.id;

  for (const module of modules) {
    await sql`
      INSERT INTO catalog_modules (catalog_training_cycle_id, course, name)
      VALUES (${cycleId}, ${module.course}, ${module.name})
      ON CONFLICT (catalog_training_cycle_id, course, name) DO NOTHING
    `;
  }
}

for (const cycle of CYCLES) {
  await seedCycle(cycle.name, [...CURSO_1_MODULES, ...cycle.curso2]);
}

console.log('Catalog curriculum seeded.');
