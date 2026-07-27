/// <reference types="cypress" />
// UC-03: Toggle password visibility

describe('UC-03: Toggle password visibility', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('reveals password-input as plain text after clicking password-toggle-button once', () => {
    cy.get('[data-element-id="password-input"]').type('CorrectHorseBattery1');
    cy.get('[data-element-id="password-toggle-button"]').click();

    cy.get('[data-element-id="password-input"]').should('have.prop', 'type', 'text');
  });

  it('masks password-input again after clicking password-toggle-button a second time', () => {
    cy.get('[data-element-id="password-input"]').type('CorrectHorseBattery1');
    cy.get('[data-element-id="password-toggle-button"]').click();
    cy.get('[data-element-id="password-toggle-button"]').click();

    cy.get('[data-element-id="password-input"]').should('have.prop', 'type', 'password');
  });
});
