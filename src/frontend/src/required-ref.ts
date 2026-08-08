/**
 * Holds a dependency that must be injected (via a property setter) before a component uses
 * it — collapses the repeated "private field + getter that throws if unset + setter"
 * triplet that every Configuración screen's `sessionService`/`*Service` properties used to
 * duplicate into one call site per dependency.
 */
export class RequiredRef<T> {
  private _value: T | null = null;

  constructor(private readonly message: string) {}

  set(value: T): void {
    this._value = value;
  }

  get(): T {
    if (this._value === null) {
      throw new Error(this.message);
    }
    return this._value;
  }
}
