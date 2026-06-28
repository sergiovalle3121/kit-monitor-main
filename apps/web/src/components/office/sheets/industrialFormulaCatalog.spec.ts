/* eslint-disable @typescript-eslint/no-explicit-any */
import { AXOS_FORMULA_CATALOG } from './industrialFormulaCatalog';
import { AXOS_INDUSTRIAL_FUNCTIONS } from './industrialFunctions';

let passed = 0; const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (a: any, b: any, msg: string) => { if (a === b) passed++; else fails.push(`${msg} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const functionNames = Object.keys(AXOS_INDUSTRIAL_FUNCTIONS).sort();
const catalogNames = AXOS_FORMULA_CATALOG.map((f) => f.name).sort();
eq(catalogNames.join('|'), functionNames.join('|'), 'catálogo documenta todas las funciones industriales registradas');
for (const entry of AXOS_FORMULA_CATALOG) {
  ok(entry.syntax.startsWith(`${entry.name}(`), `${entry.name} syntax consistente`);
  ok(entry.desc.length > 20, `${entry.name} descripción útil`);
  ok(entry.example.startsWith(`=${entry.name}(`), `${entry.name} ejemplo insertable`);
  ok(entry.args.every((arg) => arg.name && arg.desc), `${entry.name} argumentos documentados`);
}

const total = passed + fails.length;
if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`✅ ${passed}/${total}`);
