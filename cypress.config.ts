import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    specPattern: 'src/frontend/cypress/e2e/**/*.cy.ts',
    baseUrl: 'http://localhost:3050',
    includeShadowDom: true,
    supportFile: false,
  },
});
