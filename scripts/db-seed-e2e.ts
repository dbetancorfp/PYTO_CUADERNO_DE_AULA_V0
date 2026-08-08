// Deterministic Cypress fixtures against the real Postgres DATABASE_URL. Idempotent
// (ON CONFLICT DO UPDATE) so re-running it doesn't error or duplicate rows. Extended by
// each view's e2e-engineer pass with whatever accounts its own specs need — see
// tecnologias/tecnologia_qa.md.
import { SQL } from 'bun';
import { bootstrapSchema } from '../src/backend/src/db/schema-bootstrap';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to seed e2e fixtures.');
}

const sql = new SQL(databaseUrl);

await bootstrapSchema(sql);

async function seedLoginFixtures(): Promise<void> {
  const validPasswordHash = await Bun.password.hash('CorrectHorseBattery1');
  const lockedPasswordHash = await Bun.password.hash('CorrectHorseBattery1');

  await sql`
    INSERT INTO users (email, password_hash, full_name, failed_attempts, is_locked)
    VALUES (${'e2e-valid-user@example.com'}, ${validPasswordHash}, ${'E2E Valid User'}, 0, false)
    ON CONFLICT (email) DO UPDATE
      SET password_hash = EXCLUDED.password_hash, full_name = EXCLUDED.full_name,
          failed_attempts = 0, is_locked = false
  `;

  await sql`
    INSERT INTO users (email, password_hash, full_name, failed_attempts, is_locked)
    VALUES (${'e2e-locked-user@example.com'}, ${lockedPasswordHash}, ${'E2E Locked User'}, 5, true)
    ON CONFLICT (email) DO UPDATE
      SET password_hash = EXCLUDED.password_hash, full_name = EXCLUDED.full_name,
          failed_attempts = 5, is_locked = true
  `;
}

await seedLoginFixtures();
console.log('e2e fixtures seeded.');
