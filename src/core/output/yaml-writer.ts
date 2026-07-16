import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export function writeYaml(doc: any, outputDir: string): void {
  const outputPath = path.join(outputDir, 'swagger.yaml');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, yaml.dump(doc), 'utf-8');
}
