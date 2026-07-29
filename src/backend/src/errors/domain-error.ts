// Shared error type for every domain-rule rejection raised by a service (see
// lib/patterns/crud-table-component.md's "Dependency-blocked deletion pattern" and
// views/configuracion/api-contracts.md's error code table). Centrally mapped to an HTTP
// status by routes/error.ts — no service or route decides the status directly.

export class DomainError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}
