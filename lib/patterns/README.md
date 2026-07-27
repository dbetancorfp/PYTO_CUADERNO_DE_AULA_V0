# Pattern library

Structural templates, not runnable code. `backend-implementer` and `frontend-implementer`
read them before writing a component or service that fits one of these shapes, and adapt
the placeholders (`<Entity>`, `<entity>`, `<field>`) to the concrete view — never copy them
literally without adapting real types and fields.

**Why these exist**: they reduce variance between different views implemented by
`backend-implementer`/`frontend-implementer` in different sessions, and prevent
SOLID/duplication violations that
`reviewer` would otherwise have to reject afterward — preventing the violation is cheaper
than fixing it inside the Phase B loop.

**When NOT to use a pattern from here**: if the problem's shape doesn't match any of them,
don't force the pattern — implement what the spec asks for. This library covers the most
common shapes, not every possible one.

| Pattern | File | When it applies |
|---------|------|-------------------|
| Backend CRUD | [`crud-repository.md`](crud-repository.md) | An endpoint manages create/read/update/delete for an entity |
| Cascading select | [`cascading-select.md`](cascading-select.md) | One select reloads another's options when it changes (parent → child) |
| Reactive filter | [`reactive-filter.md`](reactive-filter.md) | A list must filter as the user types |
| CRUD table (frontend) | [`crud-table-component.md`](crud-table-component.md) | A view lists an entity's rows with inline editing and deletion |
