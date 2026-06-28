import { isExcelFormulaError, normalizeFormulaError } from './formulaErrors';
let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };
ok(isExcelFormulaError('#DIV/0!'), 'reconoce error Excel');
ok(!isExcelFormulaError('#BAD!'), 'rechaza error no Excel');
ok(normalizeFormulaError('ReferenceError') === '#REF!', 'normaliza ref');
ok(normalizeFormulaError('division by zero') === '#DIV/0!', 'normaliza div0');
ok(normalizeFormulaError('noop') === null, 'sin error');
const total = passed + fails.length;
if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
else console.log(`✅ ${passed}/${total}`);
