// elementId: (shared frontend infrastructure — attachSharedStyles, no single elementId;
// backs every component's Shadow DOM styling, see tecnologias/tecnologia_ux.md)
//
// Closes reviewer's cycle-1 requires-tdd-engineer gap (views/login/review-report.md): the
// fetch-succeeds path had zero test coverage even though it's real, working code.
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  attachSharedStyles,
  __resetSharedStyleSheetCacheForTests,
} from '../src/styles/shadow-styles';

describe('attachSharedStyles', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    __resetSharedStyleSheetCacheForTests();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    __resetSharedStyleSheetCacheForTests();
  });

  it('fetches /dist/tailwind.css once and adopts it into every shadow root', async () => {
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response('.a{color:red}', { status: 200 });
    }) as typeof fetch;

    const hostA = document.createElement('div');
    const shadowA = hostA.attachShadow({ mode: 'open' });
    const hostB = document.createElement('div');
    const shadowB = hostB.attachShadow({ mode: 'open' });

    attachSharedStyles(shadowA);
    attachSharedStyles(shadowB);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchCalls).toBe(1);
    expect(shadowA.adoptedStyleSheets.length).toBe(1);
    expect(shadowB.adoptedStyleSheets.length).toBe(1);
    expect(shadowA.adoptedStyleSheets[0]).toBe(shadowB.adoptedStyleSheets[0]);
  });

  it('does not adopt the same sheet twice when called again on the same shadow root', async () => {
    globalThis.fetch = (async () => new Response('.a{color:red}', { status: 200 })) as typeof fetch;

    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });

    attachSharedStyles(shadow);
    await new Promise((resolve) => setTimeout(resolve, 0));
    attachSharedStyles(shadow);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(shadow.adoptedStyleSheets.length).toBe(1);
  });

  it('leaves the shadow root unstyled when the response is not ok', async () => {
    globalThis.fetch = (async () => new Response(null, { status: 404 })) as typeof fetch;

    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });

    attachSharedStyles(shadow);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(shadow.adoptedStyleSheets.length).toBe(0);
  });

  it('leaves the shadow root unstyled, without throwing, when fetch itself rejects', async () => {
    globalThis.fetch = (async () => {
      throw new Error('network error');
    }) as typeof fetch;

    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });

    expect(() => attachSharedStyles(shadow)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(shadow.adoptedStyleSheets.length).toBe(0);
  });
});
