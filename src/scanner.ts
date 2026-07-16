import { Project } from 'ts-morph';
import { extractRoutes } from './adapters/hono/route-extractor';
import type { ValidationResult } from './core/ir';

export function runScanner(project: Project): ValidationResult {
  return extractRoutes(project);
}
