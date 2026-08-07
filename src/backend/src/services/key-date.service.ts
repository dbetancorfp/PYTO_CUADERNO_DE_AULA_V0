// elementId: academic-key-dates-table, holidays-table, public-holidays-table,
// free-disposal-days-table, evaluations-table, feoe-project-days-table (business-logic side
// of UC-02..UC-07, see views/fechas-senaladas/use-cases.md). key_dates is a single, shared,
// global table — one service handles all six categories (see api-contracts.md's "one
// resource, not six").
import { DomainError } from '../errors/domain-error';
import type { KeyDate, KeyDateRepository } from '../repositories/key-date.repository';

export class KeyDateService {
  constructor(private readonly keyDateRepository: KeyDateRepository) {}

  async list(category?: string): Promise<KeyDate[]> {
    return this.keyDateRepository.findAll(category);
  }

  /** Throws `DUPLICATE_NAME` when `(category, name, startDay, startMonth)` already exists. */
  async create(data: Omit<KeyDate, 'id'>): Promise<KeyDate> {
    const conflict = await this.keyDateRepository.findByNaturalKey(
      data.category,
      data.name,
      data.startDay,
      data.startMonth,
    );
    if (conflict) {
      throw new DomainError(
        'DUPLICATE_NAME',
        `A "${data.name}" key date already exists for this category on this date`,
      );
    }
    return this.keyDateRepository.create(data);
  }

  /** Returns `null` when `id` doesn't match an existing row. Throws `DUPLICATE_NAME` when
   * the change would collide with a different row's `(category, name, startDay,
   * startMonth)`. `category` is never editable. */
  async update(id: string, changes: Partial<Omit<KeyDate, 'id' | 'category'>>): Promise<KeyDate | null> {
    const existing = await this.keyDateRepository.findById(id);
    if (!existing) return null;

    const name = changes.name ?? existing.name;
    const startDay = changes.startDay ?? existing.startDay;
    const startMonth = changes.startMonth ?? existing.startMonth;
    const conflict = await this.keyDateRepository.findByNaturalKey(existing.category, name, startDay, startMonth);
    if (conflict && conflict.id !== id) {
      throw new DomainError(
        'DUPLICATE_NAME',
        `A "${name}" key date already exists for this category on this date`,
      );
    }

    return this.keyDateRepository.update(id, changes);
  }

  /** Returns `null` when `id` doesn't match an existing row. Deletes unconditionally
   * otherwise — nothing else in the schema references `key_dates`. */
  async delete(id: string): Promise<void | null> {
    const existing = await this.keyDateRepository.findById(id);
    if (!existing) return null;

    await this.keyDateRepository.delete(id);
  }
}
