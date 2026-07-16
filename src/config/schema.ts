import { z } from 'zod';

export const ConfigSchema = z.object({
  info: z.object({
    title: z.string(),
    version: z.string(),
    description: z.string().optional()
  }),
  servers: z.array(z.object({
    url: z.string(),
    description: z.string().optional()
  })).optional(),
  outputDir: z.string().default('./docs'),
  formats: z.array(z.enum(['json', 'yaml'])).default(['json', 'yaml']),
  include: z.array(z.string()).default(['src/**/*.ts']),
  exclude: z.array(z.string()).default([]),
  responseWrappers: z.record(z.string(), z.string()).optional(),
  unresolvedThreshold: z.number().min(0).max(100).default(0)
});

export type Config = z.output<typeof ConfigSchema>;
export type UserConfig = z.input<typeof ConfigSchema>;
