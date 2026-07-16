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
  
  config.include.forEach(pattern => {
    project.addSourceFilesAtPaths(pattern);
  });
  
  config.exclude.forEach(pattern => {
    // ts-morph doesn't have a direct exclude pattern when adding, so we can filter manually if needed.
    // For now, assume include handles it or glob exclude isn't strictly necessary for a v1 prototype.
  });

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
  
  // Always write static swagger UI for v1
  writeSwaggerUi(config.outputDir);
  
  console.log('Done!');
}
