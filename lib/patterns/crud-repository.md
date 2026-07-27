# Pattern — Backend CRUD (repository + service + route)

When it applies: an endpoint manages create/read/update/delete for an entity. Covers DIP
(interface + double implementation) and the domain-error-to-HTTP-status mapping.

## Repository — interface + Postgres implementation + in-memory double

```ts
// repositories/<entity>.repository.ts
export interface <Entity> {
  id: string;
  // ...the view's real fields
}

export interface <Entity>Repository {
  findAll(): Promise<<Entity>[]>;
  findById(id: string): Promise<<Entity> | null>;
  create(data: Omit<<Entity>, 'id'>): Promise<<Entity>>;
  update(id: string, data: Partial<Omit<<Entity>, 'id'>>): Promise<<Entity> | null>;
  delete(id: string): Promise<boolean>;
}
```

```ts
// repositories/postgres/pg-<entity>.repository.ts
import type { SqlExecutor } from '../../db/sql-executor';
import type { <Entity>, <Entity>Repository } from '../<entity>.repository';

export class Pg<Entity>Repository implements <Entity>Repository {
  constructor(private readonly sql: SqlExecutor) {}

  async findAll(): Promise<<Entity>[]> {
    return this.sql`SELECT * FROM <entity_table> ORDER BY created_at DESC`;
  }

  async findById(id: string): Promise<<Entity> | null> {
    const [row] = await this.sql`SELECT * FROM <entity_table> WHERE id = ${id}`;
    return row ?? null;
  }

  // create/update/delete follow the same pattern: tagged template, never concatenation
}
```

```ts
// repositories/in-memory/in-memory-<entity>.repository.ts
import type { <Entity>, <Entity>Repository } from '../<entity>.repository';

export class InMemory<Entity>Repository implements <Entity>Repository {
  private readonly store = new Map<string, <Entity>>();

  async findAll(): Promise<<Entity>[]> {
    return [...this.store.values()];
  }
  // the rest of the methods operate on `store`, same contract as the interface
}
```

## Service — business logic, never direct SQL

```ts
// services/<entity>.service.ts
import type { <Entity>Repository } from '../repositories/<entity>.repository';

export class <Entity>Service {
  constructor(private readonly repo: <Entity>Repository) {}   // injection — never `new Pg<Entity>Repository()` here

  async list(): Promise<<Entity>[]> {
    return this.repo.findAll();
  }

  async create(data: Omit<<Entity>, 'id'>): Promise<<Entity>> {
    // the view's validations/business rules go here, not in the route
    return this.repo.create(data);
  }
}
```

## Route — one file per entity, no inline business logic

```ts
// routes/<entity>.ts
import { Router } from 'express';
import type { <Entity>Service } from '../services/<entity>.service';

export function <entity>Router(service: <Entity>Service): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(await service.list());
  });

  router.post('/', async (req, res) => {
    res.status(201).json(await service.create(req.body));
  });

  return router;
}
```

## Composition root — where the real implementation gets decided

```ts
// app.ts
const repo: <Entity>Repository =
  deps.backend === 'postgres' ? new Pg<Entity>Repository(sql) : new InMemory<Entity>Repository();
const service = new <Entity>Service(repo);
app.use('/api/<entities>', <entity>Router(service));
```

## Domain errors

Don't throw a generic `Error` from the service. Use an error class with a `code`, mapped
centrally in `routes/error.ts` (see `backend-implementer.md` → "Implementation rules").
