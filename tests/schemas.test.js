import { describe, it, expect } from 'bun:test';
import { UISpecSchema, ComponentSchema } from '../lib/schemas/ui-spec.schema.js';
import { FunctionalSpecSchema } from '../lib/schemas/functional-spec.schema.js';

describe('ComponentSchema', () => {
  it('accepts a component with a string elementId', () => {
    const result = ComponentSchema.safeParse({
      elementId: 'login-button',
      type: 'submit-button',
      props: {},
      states: [{ name: 'default', description: 'idle', visual_cues: ['enabled'] }],
      interactions: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a component with a numeric elementId (sketchNumber is gone)', () => {
    const result = ComponentSchema.safeParse({
      elementId: 3,
      type: 'submit-button',
      props: {},
      states: [{ name: 'default', description: 'idle', visual_cues: ['enabled'] }],
      interactions: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('UISpecSchema', () => {
  it('accepts a minimal valid spec keyed by view_id', () => {
    const result = UISpecSchema.safeParse({
      view_id: 'login',
      version: 1,
      generated_at: new Date().toISOString(),
      agent: 'view-designer',
      model: 'claude-sonnet-5',
      total_elements: 1,
      screens: [{
        screen_id: 'login-screen',
        screen_name: 'Login',
        file: 'login.md',
        route: '/login',
        role_guard: [],
        element_ids: ['login-button'],
        components: [{
          elementId: 'login-button',
          type: 'submit-button',
          props: {},
          states: [{ name: 'default', description: 'idle', visual_cues: ['enabled'] }],
          interactions: [],
        }],
        data_needs: [],
      }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects the old designer-front agent literal', () => {
    const result = UISpecSchema.safeParse({
      view_id: 'login',
      version: 1,
      generated_at: new Date().toISOString(),
      agent: 'designer-front',
      model: 'claude-sonnet-5',
      total_elements: 0,
      screens: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('FunctionalSpecSchema', () => {
  it('accepts an elementSpec keyed by string elementId', () => {
    const result = FunctionalSpecSchema.safeParse({
      appOverview: 'A generic view.',
      elementSpecs: [{
        elementId: 'login-button',
        behavior: 'Submits the login form.',
        businessRules: [],
        dataNeeds: [],
        acceptanceCriteria: ['Shows an error after three failed attempts.'],
      }],
      globalRules: [],
    });
    expect(result.success).toBe(true);
  });
});
