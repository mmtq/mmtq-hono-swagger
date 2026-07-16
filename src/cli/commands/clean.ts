import * as fs from 'fs';
import { loadConfig } from '../../config/loader';

export async function cleanAction() {
  const config = await loadConfig();
  if (fs.existsSync(config.outputDir)) {
    fs.rmSync(config.outputDir, { recursive: true, force: true });
    console.log(`Cleaned ${config.outputDir}`);
  } else {
    console.log(`${config.outputDir} does not exist. Nothing to clean.`);
  }
}
