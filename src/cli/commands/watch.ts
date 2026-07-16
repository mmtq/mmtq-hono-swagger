import { Project } from 'ts-morph';
import * as chokidar from 'chokidar';
import { loadConfig } from '../../config/loader';
import { runScanner } from '../../scanner';
import { assembleOpenAPI } from '../../core/openapi-assembler';
import { writeJson } from '../../core/output/json-writer';
import { writeYaml } from '../../core/output/yaml-writer';
import { writeSwaggerUi } from '../../core/output/swagger-ui';

export async function watchAction() {
  const config = await loadConfig();

  const project = new Project();
  config.include.forEach(pattern => project.addSourceFilesAtPaths(pattern));

  console.log('Initial generation...');
  generate(project, config);

  console.log('Watching for changes...');
  const watcher = chokidar.watch(config.include, {
    ignored: config.exclude,
    persistent: true
  });

  let debounceTimer: NodeJS.Timeout | null = null;

  watcher.on('change', path => {
    console.log(`File changed: ${path}`);
    
    // Refresh the source file in ts-morph
    const sourceFile = project.getSourceFile(path);
    if (sourceFile) {
      sourceFile.refreshFromFileSystemSync();
    } else {
      project.addSourceFileAtPath(path);
    }

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log('Regenerating docs...');
      generate(project, config);
    }, 250);
  });
}

function generate(project: Project, config: any) {
  try {
    const result = runScanner(project);
    const doc = assembleOpenAPI(result.resolved, config);
    if (config.formats.includes('json')) writeJson(doc, config.outputDir);
    if (config.formats.includes('yaml')) writeYaml(doc, config.outputDir);
    writeSwaggerUi(config.outputDir);
    console.log('Docs updated successfully.');
  } catch (e) {
    console.error('Error regenerating docs:', e);
  }
}
