import { Project } from 'ts-morph';
import { loadConfig } from '../../config/loader';
import { runScanner } from '../../scanner';

export async function validateAction(options: { ci?: boolean }) {
  const config = await loadConfig();

  const project = new Project();
  config.include.forEach(pattern => project.addSourceFilesAtPaths(pattern));

  const validationResult = runScanner(project);

  const total = validationResult.resolved.length + validationResult.unresolved.length;
  console.log(`Validation Results:`);
  console.log(`- Resolved: ${validationResult.resolved.length}`);
  console.log(`- Unresolved: ${validationResult.unresolved.length}`);

  if (validationResult.unresolved.length > 0) {
    console.log('\nUnresolved Routes:');
    validationResult.unresolved.forEach(r => {
      console.log(`  [${r.method.toUpperCase()}] ${r.path} - ${r.reason} (${r.sourceFile}:${r.sourceLine})`);
    });
  }

  if (options.ci) {
    const unresolvedPercent = (validationResult.unresolved.length / total) * 100;
    if (unresolvedPercent > config.unresolvedThreshold) {
      console.error(`\nCI Check Failed: Unresolved routes (${unresolvedPercent.toFixed(2)}%) exceed threshold (${config.unresolvedThreshold}%).`);
      process.exit(1);
    } else {
       console.log(`\nCI Check Passed.`);
    }
  }
}
