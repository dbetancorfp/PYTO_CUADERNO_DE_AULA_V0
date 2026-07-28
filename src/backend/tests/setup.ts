// Preloaded before every backend test file (see bunfig.toml). Tests run with
// --max-workers=1 (see tecnologias/tecnologia_qa.md), so a monotonically increasing port
// counter is enough to avoid EADDRINUSE across files that each spin up a real HTTP server.
process.env.DATA_BACKEND ??= 'memory';

// dom-setup.ts (preloaded before this file, see bunfig.toml) registers happy-dom globally
// for frontend tests, which replaces the global `fetch` with happy-dom's own — same-origin
// policy included. Backend route tests (auth.routes.test.ts) make real HTTP requests to a
// local server on a random port, which happy-dom's fetch treats as cross-origin and blocks.
// Disabling that policy only affects fetch's CORS enforcement in this test process, not
// anything backend routes/services do at runtime.
interface HappyDomGlobal {
  settings: { fetch: { disableSameOriginPolicy: boolean } };
}

const happyDom = (globalThis as { happyDOM?: HappyDomGlobal }).happyDOM;
if (happyDom) {
  happyDom.settings.fetch.disableSameOriginPolicy = true;
}

// happy-dom's fetch also strips the Set-Cookie/Set-Cookie2 response headers before they
// ever reach JS (node_modules/happy-dom/src/fetch/utilities/FetchResponseHeaderUtility.ts —
// "Set-Cookie and Set-Cookie2 are not allowed in response headers according to spec"),
// unlike a real HTTP client, and happy-dom exposes no settings flag to opt out of this
// (unlike disableSameOriginPolicy above). Backend tests that assert on a session cookie
// (session.routes.test.ts) need the real header — restore the native `fetch` that
// dom-setup.ts (preloaded before this file, see bunfig.toml) captured just before
// GlobalRegistrator.register() overwrote it. This only changes fetch's response-header
// visibility in this test process, not anything backend routes/services do at runtime, and
// doesn't affect frontend tests: none of them call fetch() directly, they inject
// API-service doubles per this project's DIP testing convention.
const nativeFetch = (globalThis as { __nativeFetch?: typeof fetch }).__nativeFetch;
if (nativeFetch) {
  globalThis.fetch = nativeFetch;
}

let nextPort = 4100;

export function allocateTestPort(): number {
  const port = nextPort;
  nextPort += 1;
  return port;
}
