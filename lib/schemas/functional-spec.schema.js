import { z } from 'zod';

export const FunctionalSpecSchema = z.object({
  appOverview: z.string(),
  elementSpecs: z.array(z.object({
    elementId: z.string().min(1),
    behavior: z.string(),
    businessRules: z.array(z.string()),
    dataNeeds: z.array(z.string()),
    acceptanceCriteria: z.array(z.string()),
  })),
  globalRules: z.array(z.string()),
});
