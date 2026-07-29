// Composition root (see tecnologias/tecnologia_bbdd.md "Data access pattern"). Routes and
// services only ever see repository interfaces, never the concrete
// `InMemory*`/`Pg*` classes.
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import { createPgClient } from './db/pg-client';
import type { SqlExecutor } from './db/sql-executor';
import { InMemoryAcademicYearModuleRepository } from './repositories/in-memory/in-memory-academic-year-module.repository';
import { InMemoryAcademicYearRepository } from './repositories/in-memory/in-memory-academic-year.repository';
import { ConfiguracionStore } from './repositories/in-memory/configuracion-store';
import { InMemoryModuleRepository } from './repositories/in-memory/in-memory-module.repository';
import { InMemorySessionRepository } from './repositories/in-memory/in-memory-session.repository';
import { InMemoryTrainingCycleRepository } from './repositories/in-memory/in-memory-training-cycle.repository';
import { InMemoryUserRepository } from './repositories/in-memory/in-memory-user.repository';
import { PgAcademicYearModuleRepository } from './repositories/postgres/pg-academic-year-module.repository';
import { PgAcademicYearRepository } from './repositories/postgres/pg-academic-year.repository';
import { PgModuleRepository } from './repositories/postgres/pg-module.repository';
import { PgTrainingCycleRepository } from './repositories/postgres/pg-training-cycle.repository';
import { PgUserRepository } from './repositories/postgres/pg-user.repository';
import type { AcademicYearModuleRepository } from './repositories/academic-year-module.repository';
import type { AcademicYearRepository } from './repositories/academic-year.repository';
import type { ModuleRepository } from './repositories/module.repository';
import type { TrainingCycleRepository } from './repositories/training-cycle.repository';
import type { User, UserRepository } from './repositories/user.repository';
import { academicYearRouter } from './routes/academic-year.routes';
import { authRouter } from './routes/auth.routes';
import { domainErrorHandler } from './routes/error';
import { cycleModulesRouter, moduleRouter } from './routes/module.routes';
import { teacherSettingsRouter } from './routes/teacher-settings.routes';
import { trainingCycleRouter } from './routes/training-cycle.routes';
import { AcademicYearService } from './services/academic-year.service';
import { AuthService } from './services/auth.service';
import { ModuleService } from './services/module.service';
import { SessionService } from './services/session.service';
import { TeacherSettingsService } from './services/teacher-settings.service';
import { TrainingCycleService } from './services/training-cycle.service';

export interface AppDeps {
  backend: 'memory' | 'postgres';
  /** Required for 'postgres' if `process.env.DATABASE_URL` isn't set. */
  databaseUrl?: string;
  /** Test convenience — only meaningful for the 'memory' backend. */
  seedUsers?: User[];
}

interface Repositories {
  userRepository: UserRepository;
  trainingCycleRepository: TrainingCycleRepository;
  moduleRepository: ModuleRepository;
  academicYearRepository: AcademicYearRepository;
  academicYearModuleRepository: AcademicYearModuleRepository;
}

function buildRepositories(deps: AppDeps): Repositories {
  if (deps.backend === 'memory') {
    // Configuración's four entities share one in-process store so their cross-table
    // dependency checks (a cycle/module referenced by an academic year's selection) work —
    // see repositories/in-memory/configuracion-store.ts.
    const store = new ConfiguracionStore();
    return {
      userRepository: new InMemoryUserRepository(deps.seedUsers ?? []),
      trainingCycleRepository: new InMemoryTrainingCycleRepository(store),
      moduleRepository: new InMemoryModuleRepository(store),
      academicYearRepository: new InMemoryAcademicYearRepository(store),
      academicYearModuleRepository: new InMemoryAcademicYearModuleRepository(store),
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
    trainingCycleRepository: new PgTrainingCycleRepository(sql),
    moduleRepository: new PgModuleRepository(sql),
    academicYearRepository: new PgAcademicYearRepository(sql),
    academicYearModuleRepository: new PgAcademicYearModuleRepository(sql),
  };
}

export function createApp(deps: AppDeps): Express {
  const {
    userRepository,
    trainingCycleRepository,
    moduleRepository,
    academicYearRepository,
    academicYearModuleRepository,
  } = buildRepositories(deps);

  const authService = new AuthService(userRepository);
  // One InMemorySessionRepository per app instance, same lifetime as the Express app — not
  // per-request (see views/login/description_login.md's Session section).
  const sessionService = new SessionService(new InMemorySessionRepository());
  const teacherSettingsService = new TeacherSettingsService(userRepository);
  const trainingCycleService = new TrainingCycleService(trainingCycleRepository);
  const moduleService = new ModuleService(moduleRepository, trainingCycleRepository);
  const academicYearService = new AcademicYearService(
    academicYearRepository,
    academicYearModuleRepository,
    moduleRepository,
  );

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter(authService, sessionService));
  app.use('/api/teacher', teacherSettingsRouter(teacherSettingsService, sessionService));
  app.use('/api/training-cycles/:cycleId/modules', cycleModulesRouter(moduleService, sessionService));
  app.use('/api/training-cycles', trainingCycleRouter(trainingCycleService, sessionService));
  app.use('/api/modules', moduleRouter(moduleService, sessionService));
  app.use('/api/academic-years', academicYearRouter(academicYearService, sessionService));

  const frontendDist = path.join(import.meta.dir, '..', '..', 'frontend', 'dist');
  const frontendIndex = path.join(import.meta.dir, '..', '..', 'frontend', 'index.html');
  app.use('/dist', express.static(frontendDist));
  app.get('/login', (_req, res) => res.sendFile(frontendIndex));
  app.get('/dashboard', (_req, res) => res.sendFile(frontendIndex));
  app.get('/configuracion/profesor', (_req, res) => res.sendFile(frontendIndex));
  app.get('/configuracion/ano-academico', (_req, res) => res.sendFile(frontendIndex));

  // Must be the LAST app.use(...) — Express 5 auto-forwards exceptions from async route
  // handlers here (see tecnologias/tecnologia_code.md, routes/error.ts).
  app.use(domainErrorHandler);

  return app;
}
