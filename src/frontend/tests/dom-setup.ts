import { GlobalRegistrator } from '@happy-dom/global-registrator';

// Captured before GlobalRegistrator.register() replaces the global `fetch` with happy-dom's
// own DOM-aware implementation. src/backend/tests/setup.ts restores this for backend tests,
// which need real, unfiltered HTTP responses (see setup.ts for why).
(globalThis as { __nativeFetch?: typeof fetch }).__nativeFetch = fetch;

GlobalRegistrator.register();
