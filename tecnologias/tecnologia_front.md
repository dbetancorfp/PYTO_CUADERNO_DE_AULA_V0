# Frontend technologies

Source: `src/frontend/`, `CLAUDE.md`.

## Base

- **Native Web Components** (`customElements.define`, `HTMLElement`) — no framework (no
  React/Vue/Svelte/Angular). One TypeScript file per component, with a prefix specific to
  the concrete project (e.g. `app-*`).
- **Shadow DOM always open** (`this.attachShadow({ mode: 'open' })` in
  `connectedCallback`). Hard project rule: **never** nest a custom element inside another
  one's Shadow DOM — every screen is a single custom element with a single Shadow Root, so
  `data-element-id="N"` is reachable via `shadowRoot.querySelector()` (unit tests) and via
  Cypress's `.type()`/`.click()`.
- **lit-html** (standalone, `^3.3.3`) as the only rendering engine — `html` + `render()`.
  Never `innerHTML`. Bindings: `.prop=`, `@event=`, `?attr=`, `${items.map(...)}` for
  simple lists, `${repeat(...)}` (`lit-html/directives/repeat.js`) for large lists with key
  tracking.
- **Strict TypeScript** (`strict: true` in `tsconfig.json`), no `any` or implicit returns
  (`CLAUDE.md` rule).

## Build

- **`bun build`** compiles `src/frontend/src/index.ts` → `src/frontend/dist/*.js`
  (`--target browser`), loaded in the HTML via `<script type="module">`.
- **Tailwind CSS 3.x** compiled separately with `bunx tailwindcss` (`build:css` in
  `package.json`) → `src/frontend/dist/tailwind.css`. Doesn't go through `bun build`; see
  `tecnologia_ux.md` for how it's injected into each Shadow DOM.
- No additional bundler (Webpack/Vite/standalone esbuild): `bun build` is the only step.

## Internal structure (`src/frontend/src/`)

- `components/` — one component per project view (a view = an entry under `views/`, see
  `CLAUDE.md`).
- `controllers/` — UI logic extracted out of the components (reactive filter cascades,
  shared CRUD flows: `create-row-flow.ts`, `edit-row-flow.ts`, `delete-row-flow.ts`,
  `form-cascade-engine.ts`) — an explicit pattern for sharing behavior **without** nesting
  Shadow DOM (plain functions/classes, not custom elements).
- `services/` — one HTTP client per entity (`auth.service.ts`, `student.service.ts`,
  `entity.service.ts`...) calling the Express API (`/api/*`) with `fetch`.
- `styles/` — `classes-for.ts` (mapping `type × variant × size → Tailwind classes`, the
  single source of truth for the design system), `shadow-styles.ts`
  (`adoptedStyleSheets`), `tailwind.css` (Tailwind's entry point).
- `utils/` — cross-cutting utilities.
- `router.ts` — a self-contained SPA router, no external library: maps `path →
  render(outlet)`, listens to `popstate`, exposes `navigate()`. The backend serves the same
  `index.html` for any non-API route (SPA fallback in `app.ts`).

## Communication with the backend

- Native `fetch` against the Express API (`/api/...`), session cookies (`session_id`) sent
  automatically (implicit same-origin `credentials`).
- Domain events of our own on the DOM: `new CustomEvent('app:verb-noun', { bubbles: true,
  composed: true, detail: {...} })` — `composed: true` is required for the event to cross
  the Shadow DOM boundary.

## Frontend testing (see also `tecnologia_qa.md`)

- Component unit tests with **`bun test`** (Jest-compatible API) +
  **`@happy-dom/global-registrator`** to simulate the DOM/Shadow DOM in Bun's runtime
  without a real browser.
- E2E with **Cypress** (`^15.18.1`), `includeShadowDom: true` in `cypress.config.ts` —
  required because `cy.get()` doesn't cross shadow roots by default.
