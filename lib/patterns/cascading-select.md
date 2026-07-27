# Pattern — Cascading select

When it applies: changing one select must reload another's options (parent → child), and
reset the selects that depend on it. `ui-spec.json` flags this via `depends_on` on the
child component.

## Controller — cascade logic extracted out of the component (SRP)

```ts
// controllers/cascade-select.controller.ts
export interface CascadeLevel<T> {
  elementId: string;
  fetchOptions: (parentValue: string | null) => Promise<T[]>;
  onReset?: () => void;
}

export class CascadeSelectController<T> {
  private readonly levels: CascadeLevel<T>[];

  constructor(levels: CascadeLevel<T>[]) {
    this.levels = levels;   // order = dependency order, parent first
  }

  async onLevelChanged(index: number, value: string | null): Promise<Map<string, T[]>> {
    const results = new Map<string, T[]>();
    for (let i = index + 1; i < this.levels.length; i++) {
      const level = this.levels[i];
      level.onReset?.();
      const options = value === null ? [] : await level.fetchOptions(value);
      results.set(level.elementId, options);
      value = null; // only the immediately affected level receives the real value
    }
    return results;
  }
}
```

## Usage from the component — the component only renders, it doesn't decide the cascade

```ts
private readonly cascade = new CascadeSelectController([
  { elementId: 'year-select', fetchOptions: () => this.api.years() },
  { elementId: 'group-select', fetchOptions: (year) => this.api.groups(year!) },
  { elementId: 'module-select', fetchOptions: (group) => this.api.modules(group!) },
]);

private async _handleYearChange(value: string): Promise<void> {
  const resets = await this.cascade.onLevelChanged(0, value);
  this._optionsByLevel = resets;   // triggers _render()
}
```

## Rules

- The component never decides "what to reload next" inline — that's exactly the
  responsibility `CascadeSelectController` extracts (if you write it inside the component,
  `reviewer` will flag it as an SRP violation).
- A button/action that depends on **every** level having a value (e.g. "Download") gets
  disabled by checking the last level of the cascade, not each level separately.
- If any level must be filtered by the authenticated user (e.g. "only my modules"), that
  filter goes in `fetchOptions`, never in the generic controller.
