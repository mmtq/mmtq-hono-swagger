import { Project } from 'ts-morph';
import { loadConfig } from '../../config/loader';
import { runScanner } from '../../scanner';
import { assembleOpenAPI } from '../../core/openapi-assembler';
import { writeJson } from '../../core/output/json-writer';
import { writeYaml } from '../../core/output/yaml-writer';
import { writeSwaggerUi } from '../../core/output/swagger-ui';

export async function generateAction() {
  console.log('Loading config...');
  const config = await loadConfig();

  console.log('Parsing project files...');
  const project = new Project();
  
  const allPatterns = [
    ...config.include,
    ...config.exclude.map(pattern => pattern.startsWith('!') ? pattern : `!${pattern}`)
  ];
  project.addSourceFilesAtPaths(allPatterns);

  console.log('Scanning Hono routes...');
  const validationResult = runScanner(project);

  console.log(`Found ${validationResult.resolved.length} resolved routes.`);
  if (validationResult.unresolved.length > 0) {
    console.warn(`Warning: Found ${validationResult.unresolved.length} unresolved routes.`);
  }

  console.log('Assembling OpenAPI specification...');
  const doc = assembleOpenAPI(validationResult.resolved, config);

  console.log(`Writing outputs to ${config.outputDir}...`);
  if (config.formats.includes('json')) {
    writeJson(doc, config.outputDir);
  }
  if (config.formats.includes('yaml')) {
    writeYaml(doc, config.outputDir);
  }
  
  if (config.swaggerUi) {
    writeSwaggerUi(config.outputDir);
  }
  
  console.log('Done!');
}
