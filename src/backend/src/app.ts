// Composition root (see tecnologias/tecnologia_bbdd.md "Data access pattern"). Routes and
// services only ever see repository interfaces, never the concrete
// `InMemory*`/`Pg*` classes.
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import { createPgClient } from './db/pg-client';
import type { SqlExecutor } from './db/sql-executor';
import { CatalogStore } from './repositories/in-memory/catalog-store';
import { InMemoryCatalogModuleRepository } from './repositories/in-memory/in-memory-catalog-module.repository';
import { InMemoryCatalogTrainingCycleRepository } from './repositories/in-memory/in-memory-catalog-training-cycle.repository';
import { InMemorySessionRepository } from './repositories/in-memory/in-memory-session.repository';
import { InMemoryUserRepository } from './repositories/in-memory/in-memory-user.repository';
import { PgCatalogModuleRepository } from './repositories/postgres/pg-catalog-module.repository';
import { PgCatalogTrainingCycleRepository } from './repositories/postgres/pg-catalog-training-cycle.repository';
import { PgUserRepository } from './repositories/postgres/pg-user.repository';
import type { CatalogModuleRepository } from './repositories/catalog-module.repository';
import type { CatalogTrainingCycleRepository } from './repositories/catalog-training-cycle.repository';
import type { User, UserRepository } from './repositories/user.repository';
import { authRouter } from './routes/auth.routes';
import { catalogCycleModulesRouter, catalogModuleRouter } from './routes/catalog-module.routes';
import { catalogTrainingCycleRouter } from './routes/catalog-training-cycle.routes';
import { domainErrorHandler } from './routes/error';
import { teacherSettingsRouter } from './routes/teacher-settings.routes';
import { AuthService } from './services/auth.service';
import { CatalogModuleService } from './services/catalog-module.service';
import { CatalogTrainingCycleService } from './services/catalog-training-cycle.service';
import { SessionService } from './services/session.service';
import { TeacherSettingsService } from './services/teacher-settings.service';

export interface AppDeps {
  backend: 'memory' | 'postgres';
  /** Required for 'postgres' if `process.env.DATABASE_URL` isn't set. */
  databaseUrl?: string;
  /** Test convenience — only meaningful for the 'memory' backend. */
  seedUsers?: User[];
}

interface Repositories {
  userRepository: UserRepository;
  catalogTrainingCycleRepository: CatalogTrainingCycleRepository;
  catalogModuleRepository: CatalogModuleRepository;
}

function buildRepositories(deps: AppDeps): Repositories {
  if (deps.backend === 'memory') {
    // The catalog's two entities share one in-process store purely so deleting a cycle can
    // cascade-delete its modules — see repositories/in-memory/catalog-store.ts. No
    // cross-table dependency checks (unlike the old, now-dropped Configuración tables).
    const store = new CatalogStore();
    return {
      userRepository: new InMemoryUserRepository(deps.seedUsers ?? []),
      catalogTrainingCycleRepository: new InMemoryCatalogTrainingCycleRepository(store),
      catalogModuleRepository: new InMemoryCatalogModuleRepository(store),
    };
  }

  const databaseUrl = deps.databaseUrl ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required when backend is "postgres" — set it explicitly or via the DATABASE_URL environment variable.',
    );
  }
  const sql: SqlExecutor = createPgClient(databaseUrl);
  return {
    userRepository: new PgUserRepository(sql),
    catalogTrainingCycleRepository: new PgCatalogTrainingCycleRepository(sql),
    catalogModuleRepository: new PgCatalogModuleRepository(sql),
  };
}

export function createApp(deps: AppDeps): Express {
  const { userRepository, catalogTrainingCycleRepository, catalogModuleRepository } = buildRepositories(deps);

  const authService = new AuthService(userRepository);
  // One InMemorySessionRepository per app instance, same lifetime as the Express app — not
  // per-request (see views/login/description_login.md's Session section).
  const sessionService = new SessionService(new InMemorySessionRepository());
  const teacherSettingsService = new TeacherSettingsService(userRepository);
  const catalogTrainingCycleService = new CatalogTrainingCycleService(catalogTrainingCycleRepository);
  const catalogModuleService = new CatalogModuleService(catalogModuleRepository, catalogTrainingCycleRepository);

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter(authService, sessionService));
  app.use('/api/teacher', teacherSettingsRouter(teacherSettingsService, sessionService));
  app.use(
    '/api/catalog/training-cycles/:cycleId/modules',
    catalogCycleModulesRouter(catalogModuleService, sessionService),
  );
  app.use('/api/catalog/training-cycles', catalogTrainingCycleRouter(catalogTrainingCycleService, sessionService));
  app.use('/api/catalog/modules', catalogModuleRouter(catalogModuleService, sessionService));

  const frontendDist = path.join(import.meta.dir, '..', '..', 'frontend', 'dist');
  const frontendIndex = path.join(import.meta.dir, '..', '..', 'frontend', 'index.html');
  app.use('/dist', express.static(frontendDist));
  app.get('/login', (_req, res) => res.sendFile(frontendIndex));
  app.get('/dashboard', (_req, res) => res.sendFile(frontendIndex));
  app.get('/configuracion/profesor', (_req, res) => res.sendFile(frontendIndex));
  app.get('/configuracion/ciclos-modulos', (_req, res) => res.sendFile(frontendIndex));
  app.get('/configuracion/ano-academico', (_req, res) => res.sendFile(frontendIndex));

  // Must be the LAST app.use(...) — Express 5 auto-forwards exceptions from async route
  // handlers here (see tecnologias/tecnologia_code.md, routes/error.ts).
  app.use(domainErrorHandler);

  return app;
}
