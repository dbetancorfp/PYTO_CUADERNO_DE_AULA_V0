# Pattern — Reactive filter

When it applies: a list must filter as the user types (`props.is_reactive: true` in
`ui-spec.json`). Project rule: no third-party debounce, and no server re-fetch on every
keystroke if the dataset is already in memory.

## Controller — filtering extracted out of the component (SRP)

```ts
// controllers/reactive-filter.controller.ts
export class ReactiveFilterController<T> {
  private allItems: T[] = [];

  constructor(private readonly matches: (item: T, term: string) => boolean) {}

  setItems(items: T[]): void {
    this.allItems = items;
  }

  filter(term: string): T[] {
    const normalized = term.trim().toLowerCase();
    if (normalized === '') return this.allItems;
    return this.allItems.filter((item) => this.matches(item, normalized));
  }
}
```

## Usage from the component

```ts
private readonly filterCtrl = new ReactiveFilterController<Entity>(
  (item, term) => item.name.toLowerCase().includes(term),
);

private _handleInput(term: string): void {
  this._visibleRows = this.filterCtrl.filter(term);   // triggers _render(), no network
}
```

## When you do need the network (large dataset, doesn't fit in memory)

If the dataset is too large to filter client-side, the reactive filter calls the backend —
but still without third-party debounce: use `AbortController` to cancel the previous
request if the user keeps typing, not a `setTimeout`.

```ts
private _pendingFilter: AbortController | null = null;

private async _handleInput(term: string): Promise<void> {
  this._pendingFilter?.abort();
  this._pendingFilter = new AbortController();
  const rows = await this.api.search(term, { signal: this._pendingFilter.signal });
  this._visibleRows = rows;
}
```

## Rules

- The component delegates filtering (or the network call) to the controller — it doesn't
  contain its own `if (term.length > 0) { ... }` logic scattered between the render and
  the handler.
- The "no results" state is an explicit component state (`states` in `ui-spec.json`), not
  an empty array with no visual feedback.
