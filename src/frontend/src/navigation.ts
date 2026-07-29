// Shared full-page navigation helper, used by every view that needs to redirect the
// browser (session gate, nav links). Mirrors `login-view.ts`'s original `redirectTo`
// (kept local there, and in `dashboard-view.ts`, as pre-existing precedent this task
// doesn't touch) — extracted once here so the two new Configuración views (and
// `settings-nav.ts`) share a single implementation instead of a third/fourth copy.
//
// A plain relative assignment (`window.location.href = path`) degrades silently (no-op,
// no thrown error — see happy-dom's `BrowserFrameURL.getRelativeURL`) when the current
// document has an opaque URL such as `about:blank`, the default starting page in this
// project's unit-test environment. Resolving explicitly first keeps the redirect
// deterministic in both cases.
export function redirectTo(path: string): void {
  try {
    window.location.href = new URL(path, window.location.href).href;
  } catch {
    window.location.href = new URL(path, 'http://localhost').href;
  }
}
