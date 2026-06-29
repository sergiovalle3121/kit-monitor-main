#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');

const specs = [
  'src/components/office/sheets/industrialFunctions.spec.ts',
  'src/components/office/sheets/industrialFormulaCatalog.spec.ts',
  'src/lib/office/axosConnectors.spec.ts',
  'src/lib/office/axosConnectorAudit.spec.ts',
  'src/lib/office/workbookPerformance.spec.ts',
  'src/lib/office/workbookHealth.spec.ts',
  'src/lib/office/workbookHealthSheet.spec.ts',
  'src/lib/office/workbookPublishGate.spec.ts',
  'src/lib/office/workbookInventorySheet.spec.ts',
  'src/lib/office/sheetWorkbench.spec.ts',
  'src/lib/office/sheetComments.spec.ts',
  'src/lib/office/formulaAudit.spec.ts',
  'src/lib/office/dataValidationAudit.spec.ts',
  'src/lib/office/dataValidationSheet.spec.ts',
  'src/lib/office/formulaDependencies.spec.ts',
  'src/lib/office/formulaErrorAudit.spec.ts',
  'src/lib/office/formulaErrorSheet.spec.ts',
  'src/lib/office/protectionAudit.spec.ts',
  'src/lib/office/pivotGovernance.spec.ts',
  'src/components/office/sheets/templateCharts.spec.ts',
  'src/components/office/sheets/templatePivots.spec.ts',
  'src/components/office/sheets/templateMrpControlRoom.spec.ts',
  'src/components/office/sheets/pivot.spec.ts',
  'src/components/office/sheets/slicer.spec.ts',
  'src/components/office/sheets/scenarios.spec.ts',
  'src/components/office/sheets/goalSeek.spec.ts',
  'src/components/office/sheets/solver.spec.ts',
  'src/components/office/sheets/validation.spec.ts',
  'src/lib/office/xlsxLinksComments.spec.ts',
  'src/lib/office/xlsxValidation.spec.ts',
  'src/lib/office/xlsxProtection.spec.ts',
];

const env = {
  ...process.env,
  TS_NODE_PROJECT: 'tsconfig.json',
  TS_NODE_TRANSPILE_ONLY: '1',
  TS_NODE_COMPILER_OPTIONS: JSON.stringify({ module: 'CommonJS', moduleResolution: 'Node' }),
};

let failed = 0;
const started = Date.now();
for (const spec of specs) {
  const rel = path.normalize(spec);
  process.stdout.write(`\n▶ ${rel}\n`);
  const result = spawnSync(process.execPath, ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register', rel], {
    cwd: webRoot,
    env,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    failed++;
    process.stderr.write(`✗ ${rel} failed with exit code ${result.status ?? 'signal'}\n`);
  }
}

const elapsed = ((Date.now() - started) / 1000).toFixed(1);
if (failed) {
  process.stderr.write(`\n❌ AXOS Sheets specs failed: ${failed}/${specs.length} (${elapsed}s)\n`);
  process.exit(1);
}
process.stdout.write(`\n✅ AXOS Sheets specs passed: ${specs.length}/${specs.length} (${elapsed}s)\n`);
