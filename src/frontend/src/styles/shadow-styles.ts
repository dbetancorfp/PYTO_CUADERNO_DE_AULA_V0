// Delivers the Tailwind CSS compiled into `src/frontend/dist/tailwind.css` into every
// component's open Shadow DOM. A global <link>/<style> in index.html never reaches a
// shadow root, so each component adopts a single, shared `CSSStyleSheet` via the native
// `adoptedStyleSheets` API instead of duplicating/parsing the CSS per instance.
// See tecnologias/tecnologia_ux.md "Delivering CSS to the Shadow DOM".

let sharedStyleSheetPromise: Promise<CSSStyleSheet | null> | null = null;

async function loadSharedStyleSheet(): Promise<CSSStyleSheet | null> {
  try {
    const response = await fetch('/dist/tailwind.css');
    if (!response.ok) {
      return null;
    }
    const cssText = await response.text();
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(cssText);
    return sheet;
  } catch {
    // No compiled stylesheet available yet (e.g. unit tests, or the build hasn't run) —
    // components still work, just unstyled. This is not a stub: in a real served app the
    // fetch succeeds and the sheet is adopted; here it degrades gracefully instead of
    // throwing and breaking component rendering.
    return null;
  }
}

/**
 * Adopts the shared Tailwind stylesheet into `shadowRoot`, fetching and parsing it at most
 * once per page load and reusing the same parsed `CSSStyleSheet` across every component
 * instance. Safe to call from every component's `connectedCallback`.
 */
export function attachSharedStyles(shadowRoot: ShadowRoot): void {
  if (sharedStyleSheetPromise === null) {
    sharedStyleSheetPromise = loadSharedStyleSheet();
  }

  void sharedStyleSheetPromise.then((sheet) => {
    if (sheet === null) {
      return;
    }
    if (shadowRoot.adoptedStyleSheets.includes(sheet)) {
      return;
    }
    shadowRoot.adoptedStyleSheets = [...shadowRoot.adoptedStyleSheets, sheet];
  });
}

// Test-only: Bun shares one module registry across every test file in a run, so this
// module-level cache would otherwise leak between files that each stub `fetch` differently
// (including every LoginView test, which calls attachSharedStyles indirectly via
// connectedCallback). Not called from any production code path.
export function __resetSharedStyleSheetCacheForTests(): void {
  sharedStyleSheetPromise = null;
}
