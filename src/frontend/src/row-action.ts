// Shared `<tableId>-row-<id>[-<action>]` elementId parser for inline-edit CRUD tables (see
// lib/patterns/crud-table-component.md), used by `training-catalog-settings-view.ts`'s two
// tables (`catalog-training-cycle-table`, `catalog-module-table`).
//
// `academic-year-settings-view.ts` implements an equivalent private parser of its own
// instead of importing this one — that file's UI and interactions are frozen as of the
// 2026-08-04 redesign (see views/configuracion/functional-spec.json's "NOT WIRED" notes),
// so it is intentionally left untouched rather than migrated to this shared helper.

export type RowActionKind = 'edit' | 'cancel' | 'save' | 'delete' | 'name' | 'course' | 'row';

export interface RowAction {
  rowId: string;
  action: RowActionKind;
}

const ROW_ACTION_SUFFIXES: readonly Exclude<RowActionKind, 'row'>[] = [
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
