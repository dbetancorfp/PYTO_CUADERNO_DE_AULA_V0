// Bootstrap entry point — registers every view's custom element and wires its injected
// service property to the real concrete client (never a test fake). One static entry point
// for the whole frontend (see CLAUDE.md's "Repository Structure").
import './login-view';
import type { LoginView } from './login-view';
import { HttpAuthApiService } from './http-auth-api-service';

document.addEventListener('DOMContentLoaded', () => {
  const loginView = document.querySelector('app-login-view') as LoginView | null;
  if (loginView) {
    loginView.service = new HttpAuthApiService();
  }
});
