/// <reference types="cypress" />
// UC-04: Manage academic years

import { signInAsE2eUser, uniqueAcademicYearName } from './support/sign-in';

describe('UC-04: Manage academic years', () => {
  beforeEach(() => {
    signInAsE2eUser();
    cy.visit('/configuracion/ano-academico');
  });

  it('adds a new academic year, marks it current, and un-marks the previously current one', () => {
    const firstName = uniqueAcademicYearName('AY-A');
    const secondName = uniqueAcademicYearName('AY-B');

    cy.intercept('POST', '/api/academic-years').as('createYear');
    cy.get('[data-element-id="academic-year-table-add-button"]').click();
    cy.get('[data-element-id="academic-year-table-row-new-name"]').type(firstName);
    cy.get('[data-element-id="academic-year-table-row-new-save"]').click();
    cy.wait('@createYear').then(({ response }) => {
      expect(response?.statusCode).to.eq(201);
      const firstId = (response?.body as { id: string }).id;
      cy.get(`[data-element-id="academic-year-table-row-${firstId}-set-current"]`).click();
      cy.contains(`[data-element-id="academic-year-table-row-${firstId}"]`, 'En curso').should('exist');

      cy.get('[data-element-id="academic-year-table-add-button"]').click();
      cy.get('[data-element-id="academic-year-table-row-new-name"]').type(secondName);
      cy.get('[data-element-id="academic-year-table-row-new-save"]').click();
      cy.wait('@createYear').then(({ response: secondResponse }) => {
        const secondId = (secondResponse?.body as { id: string }).id;
        cy.get(`[data-element-id="academic-year-table-row-${secondId}-set-current"]`).click();

        cy.get(`[data-element-id="academic-year-table-row-${firstId}"]`).should('not.contain.text', 'En curso');
        cy.contains(`[data-element-id="academic-year-table-row-${secondId}"]`, 'En curso').should('exist');

        // cleanup: delete the now-non-current row. secondId is left current and unremoved —
        // the API has no way to unset "current" without marking a different row, so at least
        // one academic year is always left current once any has ever been marked; it's
        // clearly labeled e2e debris, same tradeoff the next test documents in full.
        cy.request('DELETE', `/api/academic-years/${firstId}`);
      });
    });
  });

  it('rejects deleting the row marked current, showing academic-year-delete-blocked-message', () => {
    const name = uniqueAcademicYearName('AY-Blk');
    let yearId: string;

    cy.request('POST', '/api/academic-years', { name })
      .then(({ body }) => {
        yearId = (body as { id: string }).id;
        return cy.request('PATCH', `/api/academic-years/${yearId}`, { isCurrent: true });
      })
      .then(() => {
        cy.reload();
        cy.get(`[data-element-id="academic-year-table-row-${yearId}-delete"]`).click();
        cy.get('[data-element-id="academic-year-delete-blocked-message"]').should('be.visible');
        cy.get(`[data-element-id="academic-year-table-row-${yearId}"]`).should('exist');

        // cleanup: mark a throwaway year current to unmark this one, so it can be deleted.
        // The throwaway itself is left current and unremoved by design — the API has no way
        // to unset "current" without marking a different row, so at least one academic year
        // is always left current once any has ever been marked; it's clearly labeled so it's
        // identifiable as e2e debris, same tradeoff every other seeded fixture in this suite
        // accepts.
        return cy.request('POST', '/api/academic-years', { name: uniqueAcademicYearName('AY-Clean') });
      })
      .then(({ body }) => {
        const cleanupId = (body as { id: string }).id;
        cy.request('PATCH', `/api/academic-years/${cleanupId}`, { isCurrent: true });
        cy.request('DELETE', `/api/academic-years/${yearId}`);
      });
  });
});
