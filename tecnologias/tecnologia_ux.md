# UX / design technologies

Source: `src/frontend/src/styles/`, `views/`, `lib/agents/view-designer/`.

## Design system

- **Tailwind CSS 3.x** as the only styling language — no CSS-in-JS, no third-party UI
  component library (no Material, no Bootstrap, no shadcn). A neutral, professional palette
  agreed with the user of the concrete project being generated — extended in
  `tailwind.config.js`.
- **Single source of truth**: `classesFor(type, variant, size)`
  (`src/frontend/src/styles/classes-for.ts`) — a `type × variant × size → Tailwind classes`
  table. No component contains its own `if variant === '...'` logic; they all call this
  function. Chosen explicitly to avoid code duplication (Sonar penalizes duplication, see
  `tecnologia_qa.md`).
- The `variant` vocabulary is closed and reused straight from the UI spec schema itself
  (`props.variant: primary | secondary | danger | ghost | link` in
  `lib/schemas/ui-spec.schema.js`) — no new values invented per view.
- Size scale (`size`): `sm` / `md` (default) / `lg`, applied as padding + text size.

## Delivering CSS to the Shadow DOM

- Since every component uses an open Shadow DOM, a global `<link>`/`<style>` in
  `index.html` **doesn't** reach the shadow roots — Tailwind classes would have no visual
  effect without an extra step.
- Solution: **`adoptedStyleSheets`** (native Shadow DOM API) —
  `src/frontend/src/styles/shadow-styles.ts` lazily builds a single `CSSStyleSheet`
  (`fetch('/dist/tailwind.css')` + `replaceSync`), shared across every component instance,
  and adopts it into each shadow root via `attachSharedStyles(shadowRoot)`. Avoids
  duplicating/parsing the CSS per instance.

## View description → UI specification (a process, not a tool)

- **There is no visual mockup** (annotated HTML, Figma, etc.) in this project. The only
  source of truth for "what exists in a view" is
  `views/<view>/description_<view>.md` — free text written by the user: what the "client"
  wants from that view, what data it handles, which database tables are involved.
- The **`view-designer`** agent (`lib/agents/view-designer/view-designer.md`) designs the
  UI from that description: it decides components, states and interactions, and assigns
  each one its own `elementId` (there's no external numbering to follow, unlike the old
  mockup's `sketchNumber`). The result is `ui-spec.json` + `functional-spec.json` per view.
- Nothing shows up in later phases (use cases, tests, code) without first being designed by
  `view-designer` with its own `elementId`.

## Reusable interaction patterns

- **Reactive filters**: when a view lists filterable data, filters must apply as the user
  types (explicit `CLAUDE.md` rule) — implemented in `controllers/` via query-cascade
  functions, not third-party debounce.
- **Bulk import**: when a view needs bulk data entry, use a `file-upload` component with
  its own Tailwind variant (`file:mr-3 file:rounded...`), integrated into the same
  `classesFor` system.
- **State accessibility**: the `danger` variant is reused consistently across inputs,
  buttons and paragraphs to signal errors/failed validation throughout the system, instead
  of a different color per component.
- **Selection matrices** (item × level, cell by cell): when a view requires the user to
  pick a value per matrix cell, each cell is an independent state that must be validatable
  visually without ambiguity (use `variant="danger"` for the failed-validation state, not
  an ad-hoc style).

## Design tools

There is no external design tool (Figma, Sketch...) in the flow: each view's Markdown
description **is** the input artifact, edited directly and versioned in git — a deliberate
decision so that a view's specification is plain, readable, versionable text with no
external tooling required.
