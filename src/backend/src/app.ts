// Composition root (see tecnologias/tecnologia_bbdd.md "Data access pattern"). Routes and
// services only ever see the `UserRepository` interface, never the concrete
// `InMemoryUserRepository`/`PgUserRepository` classes.
import path from 'node:path';
import express, { type Express } from 'express';
import { createPgClient } from './db/pg-client';
import { InMemoryUserRepository } from './repositories/in-memory/in-memory-user.repository';
import { PgUserRepository } from './repositories/postgres/pg-user.repository';
import type { User, UserRepository } from './repositories/user.repository';
import { authRouter } from './routes/auth.routes';
import { AuthService } from './services/auth.service';

export interface AppDeps {
  backend: 'memory' | 'postgres';
  /** Required for 'postgres' if `process.env.DATABASE_URL` isn't set. */
  databaseUrl?: string;
  /** Test convenience — only meaningful for the 'memory' backend. */
  seedUsers?: User[];
}

function buildUserRepository(deps: AppDeps): UserRepository {
  if (deps.backend === 'memory') {
    return new InMemoryUserRepository(deps.seedUsers ?? []);
  }

  const databaseUrl = deps.databaseUrl ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required when backend is "postgres" — set it explicitly or via the DATABASE_URL environment variable.',
    );
  }
  return new PgUserRepository(createPgClient(databaseUrl));
}

export function createApp(deps: AppDeps): Express {
  const userRepository = buildUserRepository(deps);
  const authService = new AuthService(userRepository);

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter(authService));

  const frontendDist = path.join(import.meta.dir, '..', '..', 'frontend', 'dist');
  const frontendIndex = path.join(import.meta.dir, '..', '..', 'frontend', 'index.html');
  app.use('/dist', express.static(frontendDist));
  app.get('/login', (_req, res) => res.sendFile(frontendIndex));

  return app;
}
