import type { KeyDate, KeyDateRepository } from '../key-date.repository';
import type { KeyDateStore } from './key-date-store';

/** In-memory double for `KeyDateRepository` — used in unit tests and `DATA_BACKEND=memory`
 * mode (see tecnologias/tecnologia_bbdd.md "Data access pattern"). */
export class InMemoryKeyDateRepository implements KeyDateRepository {
  constructor(private readonly store: KeyDateStore) {}

  async findAll(category?: string): Promise<KeyDate[]> {
    const all = [...this.store.keyDates.values()];
    return category === undefined ? all : all.filter((keyDate) => keyDate.category === category);
  }

  async findById(id: string): Promise<KeyDate | null> {
    return this.store.keyDates.get(id) ?? null;
  }

  async findByNaturalKey(category: string, name: string, startDay: number, startMonth: number): Promise<KeyDate | null> {
    return (
      [...this.store.keyDates.values()].find(
        (keyDate) =>
          keyDate.category === category &&
          keyDate.name === name &&
          keyDate.startDay === startDay &&
          keyDate.startMonth === startMonth,
      ) ?? null
    );
  }

  async create(data: Omit<KeyDate, 'id'>): Promise<KeyDate> {
    const keyDate: KeyDate = { id: crypto.randomUUID(), ...data };
    this.store.keyDates.set(keyDate.id, keyDate);
    return keyDate;
  }

  async update(id: string, changes: Partial<Omit<KeyDate, 'id' | 'category'>>): Promise<KeyDate> {
    const existing = this.store.keyDates.get(id);
    if (!existing) throw new Error(`Key date ${id} not found`);

    const updated: KeyDate = { ...existing, ...changes };
    this.store.keyDates.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.store.keyDates.delete(id);
  }
}
