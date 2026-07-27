import { z } from 'zod';

export const ComponentType = z.enum([
  'button', 'submit-button', 'icon-button',
  'text-input', 'password-input', 'number-input',
  'select', 'checkbox', 'textarea',
  'table', 'table-header-cell', 'table-data-cell',
  'table-editable-cell', 'table-selectable-cell',
  'modal', 'form', 'nav', 'tab', 'tab-group',
  'reactive-filter',
  'paragraph', 'heading', 'image', 'icon',
  'list', 'card', 'badge', 'link',
  'dropdown', 'file-upload',
  'container', 'section',
]);

export const StateSchema = z.object({
  name: z.string(),
  description: z.string(),
  visual_cues: z.array(z.string()).min(1),
  condition: z.string().optional(),
});

export const InteractionSchema = z.object({
  trigger: z.string(),
  event: z.string(),
  payload: z.record(z.unknown()).optional(),
  response: z.string(),
  target_elements: z.array(z.string()).optional(),
});

export const ValidationRuleSchema = z.object({
  rule: z.string(),
  message: z.string(),
  when: z.string().optional(),
});

export const AccessibilitySchema = z.object({
  role: z.string().optional(),
  aria_label: z.string().optional(),
  aria_live: z.enum(['polite', 'assertive', 'off']).optional(),
  keyboard: z.string().optional(),
});

export const PropsSchema = z.object({
  placeholder: z.string().optional(),
  icon: z.string().optional(),
  variant: z.enum(['primary', 'secondary', 'danger', 'ghost', 'link']).optional(),
  size: z.enum(['sm', 'md', 'lg']).optional(),
  role_guard: z.array(z.string()).optional(),
  columns: z.array(z.string()).optional(),
  is_read_only: z.boolean().optional(),
  is_editable: z.boolean().optional(),
  accepts: z.string().optional(),
  is_reactive: z.boolean().optional(),
  debounce_ms: z.number().int().optional(),
}).catchall(z.unknown());

export const ComponentSchema = z.object({
  elementId: z.string().min(1),
  type: ComponentType,
  label: z.string().optional(),
  props: PropsSchema,
  states: z.array(StateSchema).min(1),
  interactions: z.array(InteractionSchema),
  accessibility: AccessibilitySchema.optional(),
  validation: z.array(ValidationRuleSchema).optional(),
  depends_on: z.array(z.string()).optional(),
  note: z.string().optional(),
});

export const ScreenSchema = z.object({
  screen_id: z.string(),
  screen_name: z.string(),
  file: z.string(),
  route: z.string(),
  role_guard: z.array(z.string()),
  element_ids: z.array(z.string()),
  components: z.array(ComponentSchema),
  data_needs: z.array(z.string()),
  notes: z.string().optional(),
});

export const UISpecSchema = z.object({
  view_id: z.string(),
  version: z.number().int().positive().default(1),
  generated_at: z.string().datetime(),
  agent: z.literal('view-designer'),
  model: z.string(),
  total_elements: z.number().int().positive(),
  screens: z.array(ScreenSchema),
});
