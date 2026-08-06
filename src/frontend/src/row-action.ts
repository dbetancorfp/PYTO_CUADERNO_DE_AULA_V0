// Shared `<tableId>-row-<id>[-<action>]` elementId parser for inline-edit CRUD tables (see
// lib/patterns/crud-table-component.md), used by `training-catalog-settings-view.ts`'s two
// tables (`catalog-training-cycle-table`, `catalog-module-table`) and (as of the 2026-08-05
// real-backend redesign) `academic-year-settings-view.ts`'s four tables
// (`academic-year-table`, `training-cycle-table`, `module-table`, `module-selection-table`).
//
// `set-current`/`checkbox` were added for that redesign — `set-current` for
// `academic-year-table`'s "Marcar en curso" row action, `checkbox` for
// `training-cycle-table`'s/`module-selection-table`'s adding-mode checkbox columns. Longer
// suffixes are checked before shorter ones with the same trailing token, but none of the
// existing consumers' row ids end in `-set-current`/`-checkbox`, so this is additive only.

export type RowActionKind = 'edit' | 'cancel' | 'save' | 'delete' | 'name' | 'course' | 'set-current' | 'checkbox' | 'row';

export interface RowAction {
  rowId: string;
  action: RowActionKind;
}

const ROW_ACTION_SUFFIXES: readonly Exclude<RowActionKind, 'row'>[] = [
  'set-current',
  'checkbox',
  'cancel',
  'save',
  'edit',
  'delete',
  'name',
  'course',
];

/**
 * Parses a `<tableId>-row-<id>[-<action>]` elementId into the row id it targets and which
 * action was clicked. Returns `null` when `elementId` isn't a row of `tableId` at all, so
 * callers can try the next table.
 */
export function parseRowAction(elementId: string, tableId: string): RowAction | null {
  const prefix = `${tableId}-row-`;
  if (!elementId.startsWith(prefix)) {
    return null;
  }
  const rest = elementId.slice(prefix.length);
  for (const suffix of ROW_ACTION_SUFFIXES) {
    if (rest.endsWith(`-${suffix}`)) {
      return { rowId: rest.slice(0, rest.length - suffix.length - 1), action: suffix };
    }
  }
  return { rowId: rest, action: 'row' };
}
