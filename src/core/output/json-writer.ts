import * as fs from 'fs';
import * as path from 'path';

export function writeJson(doc: any, outputDir: string): void {
  const outputPath = path.join(outputDir, 'openapi.json');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(doc, null, 2), 'utf-8');
}
