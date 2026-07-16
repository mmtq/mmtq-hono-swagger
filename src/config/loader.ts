import * as path from 'path';
import * as fs from 'fs';
import { ConfigSchema, Config } from './schema';

export async function loadConfig(cwd: string = process.cwd()): Promise<Config> {
  const tsConfigPath = path.join(cwd, 'openapi.config.ts');
  const jsConfigPath = path.join(cwd, 'openapi.config.js');

  let rawConfig: any;

  if (fs.existsSync(tsConfigPath)) {
    // Basic dynamic import for ts using ts-node or similar in a real environment
    // For this prototype, we assume it's pre-compiled or we can require it
    // Actually, Node >= 20 might support it with loaders, or we can use tsx.
    // To keep zero-runtime-dependencies, we will require the user to use tsx, or we use a simple require hook.
    // For v1, we will just try to import the JS or rely on a wrapper.
    try {
      rawConfig = require(tsConfigPath).default || require(tsConfigPath);
    } catch (e) {
      console.warn(`Failed to load openapi.config.ts directly. Make sure you are using a runner like tsx: ${e}`);
    }
  } else if (fs.existsSync(jsConfigPath)) {
    rawConfig = require(jsConfigPath);
  } else {
    throw new Error('Could not find openapi.config.ts or openapi.config.js');
  }

  return ConfigSchema.parse(rawConfig);
}
