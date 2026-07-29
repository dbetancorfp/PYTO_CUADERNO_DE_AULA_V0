/// <reference types="cypress" />
// UC-02: Change password

import { signInAsE2eUser } from './support/sign-in';

describe('UC-02: Change password', () => {
  beforeEach(() => {
    signInAsE2eUser();
    cy.visit('/configuracion/profesor');
  });

  it('changes the password on success, clearing all three fields, then changes it back', () => {
    // Changes back to the seeded password at the end so this test stays independently
    // re-runnable without depending on db:seed:e2e having just reset it.
    cy.intercept('PATCH', '/api/teacher/password').as('savePassword');
    cy.get('[data-element-id="teacher-current-password-input"]').type('CorrectHorseBattery1');
    cy.get('[data-element-id="teacher-new-password-input"]').type('TemporaryPassword2');
    cy.get('[data-element-id="teacher-repeat-password-input"]').type('TemporaryPassword2');
    cy.get('[data-element-id="teacher-save-password-button"]').click();

    cy.wait('@savePassword').its('response.statusCode').should('eq', 200);
    cy.get('[data-element-id="teacher-password-save-message"]').should('not.be.empty');
    cy.get('[data-element-id="teacher-current-password-input"]').should('have.value', '');
    cy.get('[data-element-id="teacher-new-password-input"]').should('have.value', '');
    cy.get('[data-element-id="teacher-repeat-password-input"]').should('have.value', '');

    cy.get('[data-element-id="teacher-current-password-input"]').type('TemporaryPassword2');
    cy.get('[data-element-id="teacher-new-password-input"]').type('CorrectHorseBattery1');
    cy.get('[data-element-id="teacher-repeat-password-input"]').type('CorrectHorseBattery1');
    cy.get('[data-element-id="teacher-save-password-button"]').click();
    cy.wait('@savePassword').its('response.statusCode').should('eq', 200);
  });

  it('shows an error and does not clear the fields when the current password is wrong', () => {
    cy.intercept('PATCH', '/api/teacher/password').as('savePassword');
    cy.get('[data-element-id="teacher-current-password-input"]').type('TheWrongPassword1');
    cy.get('[data-element-id="teacher-new-password-input"]').type('NewPassword2');
    cy.get('[data-element-id="teacher-repeat-password-input"]').type('NewPassword2');
    cy.get('[data-element-id="teacher-save-password-button"]').click();

    cy.wait('@savePassword').its('response.statusCode').should('eq', 401);
    cy.get('[data-element-id="teacher-password-save-message"]').should('contain.text', 'Incorrect current password');
    cy.get('[data-element-id="teacher-current-password-input"]').should('have.value', 'TheWrongPassword1');
  });

  it('shows an inline error and does not submit when the repeat does not match the new password', () => {
    cy.intercept('PATCH', '/api/teacher/password').as('savePassword');
    cy.get('[data-element-id="teacher-current-password-input"]').type('CorrectHorseBattery1');
    cy.get('[data-element-id="teacher-new-password-input"]').type('NewPassword2');
    cy.get('[data-element-id="teacher-repeat-password-input"]').type('DoesNotMatch3');
    cy.get('[data-element-id="teacher-save-password-button"]').click();

    cy.contains('Las contraseñas no coinciden').should('be.visible');
    cy.get('@savePassword.all').should('have.length', 0);
  });
});
