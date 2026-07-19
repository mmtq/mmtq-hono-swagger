import * as path from 'path';
import * as fs from 'fs';
import { ConfigSchema, Config } from './schema';

export async function loadConfig(cwd: string = process.cwd()): Promise<Config> {
  const tsConfigPath = path.join(cwd, 'openapi.config.ts');
  const jsConfigPath = path.join(cwd, 'openapi.config.js');

  let rawConfig: any;

  if (fs.existsSync(tsConfigPath)) {
    try {
      const jiti = require('jiti')(__filename);
      const mod = jiti(tsConfigPath);
      rawConfig = mod.default || mod;
    } catch (e) {
      console.warn(`Failed to load openapi.config.ts natively using jiti: ${e}`);
    }
  } else if (fs.existsSync(jsConfigPath)) {
    rawConfig = require(jsConfigPath);
  } else {
    throw new Error('Could not find openapi.config.ts or openapi.config.js');
  }

  return ConfigSchema.parse(rawConfig);
}
