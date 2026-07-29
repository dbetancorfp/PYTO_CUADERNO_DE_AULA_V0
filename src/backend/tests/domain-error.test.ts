// elementId: (backend infrastructure — no single elementId; shared by every Configuración
// service that rejects a create/update/delete for a domain reason, per
// lib/patterns/crud-table-component.md's "Dependency-blocked deletion pattern" and
// views/configuracion/api-contracts.md's error code table). New module, doesn't exist yet.
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import express from 'express';
import type { Server } from 'node:http';
import { DomainError } from '../src/errors/domain-error';
import { domainErrorHandler, statusForDomainErrorCode } from '../src/routes/error';
import { allocateTestPort } from './setup';

describe('DomainError', () => {
  it('carries a code and a message', () => {
    const error = new DomainError('DUPLICATE_NAME', 'Name already exists');

    expect(error.code).toBe('DUPLICATE_NAME');
    expect(error.message).toBe('Name already exists');
  });

  it('is a real Error instance', () => {
    const error = new DomainError('DUPLICATE_NAME', 'Name already exists');

    expect(error).toBeInstanceOf(Error);
  });

  it('carries optional extra details, defaulting to an empty object', () => {
    const withDetails = new DomainError('HAS_DEPENDENTS', 'Cannot delete: referenced', {
      academicYears: [{ id: 'a1', name: '2026/2027' }],
    });
    const withoutDetails = new DomainError('DUPLICATE_NAME', 'Name already exists');

    expect(withDetails.details).toEqual({ academicYears: [{ id: 'a1', name: '2026/2027' }] });
    expect(withoutDetails.details).toEqual({});
  });
});

describe('statusForDomainErrorCode', () => {
  it('maps DUPLICATE_NAME to 409', () => {
    expect(statusForDomainErrorCode('DUPLICATE_NAME')).toBe(409);
  });

  it('maps HAS_DEPENDENTS to 409', () => {
    expect(statusForDomainErrorCode('HAS_DEPENDENTS')).toBe(409);
  });

  it('maps IS_CURRENT to 409', () => {
    expect(statusForDomainErrorCode('IS_CURRENT')).toBe(409);
  });

  it('maps INVALID_CREDENTIALS to 401', () => {
    expect(statusForDomainErrorCode('INVALID_CREDENTIALS')).toBe(401);
  });

  it('maps an unmapped code to 500', () => {
    expect(statusForDomainErrorCode('SOMETHING_UNMAPPED')).toBe(500);
  });
});

describe('domainErrorHandler', () => {
  const port = allocateTestPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let server: Server;

  beforeAll(async () => {
    const app = express();
    app.get('/throws-domain-error', () => {
      throw new DomainError('DUPLICATE_NAME', 'Name already exists');
    });
    app.get('/throws-plain-error', () => {
      throw new Error('Something unexpected broke');
    });
    app.use(domainErrorHandler);
    await new Promise<void>((resolve) => {
      server = app.listen(port, () => resolve());
    });
  });

  afterAll(() => {
    server.close();
  });

  it('responds with the mapped status and the DomainError code/message for a DomainError', async () => {
    const response = await fetch(`${baseUrl}/throws-domain-error`);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: 'Name already exists', code: 'DUPLICATE_NAME' });
  });

  it('responds 500 with a generic message for any non-DomainError', async () => {
    const response = await fetch(`${baseUrl}/throws-plain-error`);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ message: 'Internal server error' });
  });
});
