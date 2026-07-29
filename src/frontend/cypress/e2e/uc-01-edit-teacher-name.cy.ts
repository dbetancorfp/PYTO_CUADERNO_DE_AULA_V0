/// <reference types="cypress" />
// UC-01: Edit the teacher's name

import { signInAsE2eUser } from './support/sign-in';

describe('UC-01: Edit the teacher\'s name', () => {
  beforeEach(() => {
    signInAsE2eUser();
    cy.visit('/configuracion/profesor');
  });

  it('pre-fills with the current name, saves a new one, and shows success', () => {
    cy.get('[data-element-id="teacher-full-name-input"]').should('have.value', 'E2E Valid User');

    cy.intercept('PATCH', '/api/teacher/name').as('saveName');
    cy.get('[data-element-id="teacher-full-name-input"]').clear().type('E2E Valid User');
    cy.get('[data-element-id="teacher-save-name-button"]').click();

    cy.wait('@saveName').its('response.statusCode').should('eq', 200);
    cy.get('[data-element-id="teacher-name-save-message"]').should('not.be.empty');
  });

  it('shows an inline error and does not submit when the name is cleared', () => {
    cy.intercept('PATCH', '/api/teacher/name').as('saveName');
    cy.get('[data-element-id="teacher-full-name-input"]').clear();
    cy.get('[data-element-id="teacher-save-name-button"]').click();

    cy.contains('El nombre es obligatorio').should('be.visible');
    cy.get('@saveName.all').should('have.length', 0);
  });

  it('loads the shared Tailwind stylesheet into teacher-save-name-button\'s Shadow DOM', () => {
    // Proves attachSharedStyles actually fetched and adopted /dist/tailwind.css into the
    // component's shadow root — see e2e-engineer.md's "Style application proof".
    cy.get('[data-element-id="teacher-save-name-button"]').should('have.css', 'background-color', 'rgb(15, 23, 42)');
  });
});
