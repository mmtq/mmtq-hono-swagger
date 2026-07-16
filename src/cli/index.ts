#!/usr/bin/env node
import { Command } from 'commander';
import { generateAction } from './commands/generate';
import { watchAction } from './commands/watch';
import { validateAction } from './commands/validate';
import { serveAction } from './commands/serve';
import { cleanAction } from './commands/clean';

const program = new Command();

program
  .name('hono-swagger')
  .description('Build-time OpenAPI generator for Hono + Zod')
  .version('1.0.0');

program.command('generate')
  .description('Generate OpenAPI docs from source files')
  .action(generateAction);

program.command('watch')
  .description('Watch source files and regenerate docs on change')
  .action(watchAction);

program.command('validate')
  .description('Validate that all routes in scope resolve fully in the OpenAPI spec')
  .option('--ci', 'Exit non-zero if unresolved percentage exceeds the threshold')
  .action(validateAction);

program.command('serve')
  .description('Serve the generated static Swagger UI locally')
  .option('-p, --port <port>', 'Port to serve on', '8080')
  .action(serveAction);

program.command('clean')
  .description('Remove the output directory')
  .action(cleanAction);

program.parse(process.argv);
