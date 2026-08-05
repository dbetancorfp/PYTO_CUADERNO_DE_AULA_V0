/// <reference types="cypress" />
// UC-04: Manage catalog training cycles
//
// New for the 2026-08-04 redesign: catalog-training-cycle-table is backed by the brand-new,
// standalone catalog_cycles table (GET/POST/PATCH/DELETE
// /api/catalog/training-cycles) — no relation to any año académico. Deletion always
// succeeds and cascades to the cycle's modules (catalog_modules' FK is ON DELETE CASCADE),
// unlike the old, now-dropped training_cycles table's dependency-blocked deletion.

import { signInAsE2eUser } from './support/sign-in';

describe('UC-04: Manage catalog training cycles', () => {
  beforeEach(() => {
    signInAsE2eUser();
    cy.visit('/configuracion/ciclos-modulos');
  });

  it('creates cycles, auto-selects the newest, reloads catalog-module-table on selection, and cascade-deletes', () => {
    const cycleAName = `E2E Catalog Cycle A ${Date.now()}`;
    const cycleBName = `E2E Catalog Cycle B ${Date.now()}`;
    const moduleAName = `E2E Catalog Module A ${Date.now()}`;

    cy.intercept('POST', '/api/catalog/training-cycles').as('createCycle');
    cy.get('[data-element-id="catalog-training-cycle-table-add-button"]').click();
    cy.get('[data-element-id="catalog-training-cycle-table-row-new-name"]').type(cycleAName);
    cy.get('[data-element-id="catalog-training-cycle-table-row-new-save"]').click();

    cy.wait('@createCycle').then(({ response }) => {
      expect(response?.statusCode).to.eq(201);
      const cycleAId = (response?.body as { id: string }).id;

      // Newly-created cycle A is auto-selected.
      cy.get(`[data-element-id="catalog-training-cycle-table-row-${cycleAId}"]`).should('have.class', 'bg-slate-100');

      // Give cycle A a module so switching selection later has something to prove.
      cy.intercept('POST', `/api/catalog/training-cycles/${cycleAId}/modules`).as('createModuleA');
      cy.get('[data-element-id="catalog-module-table-add-button"]').should('not.be.disabled').click();
      cy.get('[data-element-id="catalog-module-table-row-new-name"]').type(moduleAName);
      cy.get('[data-element-id="catalog-module-table-row-new-course"]').select('1');
      cy.get('[data-element-id="catalog-module-table-row-new-save"]').click();
      cy.wait('@createModuleA').its('response.statusCode').should('eq', 201);
      cy.contains('[data-element-id="catalog-module-table"]', moduleAName).should('exist');

      // Create cycle B — it becomes selected, and catalog-module-table reloads empty for it.
      cy.intercept('POST', '/api/catalog/training-cycles').as('createCycleB');
      cy.get('[data-element-id="catalog-training-cycle-table-add-button"]').click();
      cy.get('[data-element-id="catalog-training-cycle-table-row-new-name"]').type(cycleBName);
      cy.get('[data-element-id="catalog-training-cycle-table-row-new-save"]').click();

      cy.wait('@createCycleB').then(({ response: cycleBResponse }) => {
        const cycleBId = (cycleBResponse?.body as { id: string }).id;
        cy.get(`[data-element-id="catalog-training-cycle-table-row-${cycleBId}"]`).should('have.class', 'bg-slate-100');
        cy.get('[data-element-id="catalog-module-table"]').should('contain.text', 'Este ciclo todavía no tiene módulos.');
        cy.contains('[data-element-id="catalog-module-table"]', moduleAName).should('not.exist');

        // Selecting cycle A again reloads catalog-module-table filtered to its module.
        cy.get(`[data-element-id="catalog-training-cycle-table-row-${cycleAId}"]`).click();
        cy.contains('[data-element-id="catalog-module-table"]', moduleAName).should('exist');

        // A2 — deleting cycle A always succeeds, cascading its module, no confirmation.
        cy.intercept('DELETE', `/api/catalog/training-cycles/${cycleAId}`).as('deleteCycleA');
        cy.get(`[data-element-id="catalog-training-cycle-table-row-${cycleAId}-delete"]`).click();
        cy.wait('@deleteCycleA').its('response.statusCode').should('eq', 204);
        cy.get(`[data-element-id="catalog-training-cycle-table-row-${cycleAId}"]`).should('not.exist');

        // cleanup
        cy.request('DELETE', `/api/catalog/training-cycles/${cycleBId}`);
      });
    });
  });

  it('A1: rejects a duplicate cycle name with an inline error and keeps the draft open', () => {
    const cycleName = `E2E Catalog Dup Cycle ${Date.now()}`;

    cy.request('POST', '/api/catalog/training-cycles', { name: cycleName }).then(({ body }) => {
      const existingId = (body as { id: string }).id;
      cy.reload();

      cy.get('[data-element-id="catalog-training-cycle-table-add-button"]').click();
      cy.get('[data-element-id="catalog-training-cycle-table-row-new-name"]').type(cycleName);

      cy.intercept('POST', '/api/catalog/training-cycles').as('createDuplicate');
      cy.get('[data-element-id="catalog-training-cycle-table-row-new-save"]').click();
      cy.wait('@createDuplicate').its('response.statusCode').should('eq', 409);

      cy.contains('Ya existe un ciclo con ese nombre').should('be.visible');
      cy.get('[data-element-id="catalog-training-cycle-table-row-new-name"]').should('have.value', cycleName);
      cy.get('[data-element-id="catalog-training-cycle-table"]').find(`td:contains("${cycleName}")`).should('have.length', 1);

      cy.request('DELETE', `/api/catalog/training-cycles/${existingId}`);
    });
  });
});
