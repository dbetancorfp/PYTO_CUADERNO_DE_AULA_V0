// Single source of truth for mapping a component's (type, variant, size) to Tailwind
// classes — see tecnologias/tecnologia_ux.md "Design system". No component may compute
// its own Tailwind classes with inline conditionals; every visual/interactive element
// calls `classesFor` instead.

export type ComponentVisualType =
  | 'button'
  | 'submit-button'
  | 'icon-button'
  | 'text-input'
  | 'password-input'
  | 'number-input'
  | 'select'
  | 'checkbox'
  | 'textarea'
  | 'heading'
  | 'paragraph'
  | 'link'
  | 'card'
  | 'badge';

export type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';

export type Size = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'text-sm px-2 py-1',
  md: 'text-base px-3 py-2',
  lg: 'text-lg px-4 py-3',
};

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-slate-900 text-white hover:bg-slate-700 disabled:bg-slate-400 disabled:cursor-not-allowed',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 disabled:opacity-60',
  danger: 'text-red-600',
  ghost: 'bg-transparent text-slate-500 hover:text-slate-800 disabled:opacity-60',
  link: 'text-blue-600 underline hover:text-blue-800',
};

const BASE_CLASSES: Record<ComponentVisualType, string> = {
  button: 'rounded-md font-medium transition-colors',
  'submit-button': 'w-full rounded-md font-medium transition-colors',
  'icon-button': 'rounded-full inline-flex items-center justify-center transition-colors',
  'text-input': 'w-full rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400',
  'password-input': 'w-full rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400',
  'number-input': 'w-full rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400',
  select: 'w-full rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400',
  checkbox: 'rounded border-slate-300',
  textarea: 'w-full rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400',
  heading: 'text-2xl font-semibold text-slate-900',
  paragraph: 'text-sm',
  link: 'underline cursor-pointer',
  card: 'rounded-lg shadow-md bg-white',
  badge: 'inline-flex items-center rounded-full',
};

/**
 * Maps a component's (type, variant, size) to a single Tailwind class string.
 * `variant`/`size` are the values `view-designer` assigned to the elementId in
 * `ui-spec.json` — never re-derived with inline `if` logic in a component.
 */
export function classesFor(type: ComponentVisualType, variant?: Variant, size?: Size): string {
  const base = BASE_CLASSES[type];
  const variantClasses = variant !== undefined ? VARIANT_CLASSES[variant] : '';
  const sizeClasses = size !== undefined ? SIZE_CLASSES[size] : '';
  return [base, variantClasses, sizeClasses].filter((value) => value.length > 0).join(' ');
}
