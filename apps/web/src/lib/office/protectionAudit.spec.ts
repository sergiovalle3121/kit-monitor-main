import { auditWorkbookProtection, formatProtectionAudit } from './protectionAudit';

let passed = 0; const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (a: unknown, b: unknown, msg: string) => { if (a === b) passed++; else fails.push(`${msg} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const audit = auditWorkbookProtection({
  sheets: [
    { name: 'Ops', axosProtection: { sheetLocked: true, ranges: [{ range: 'A1:B2', locked: true }] } },
    { name: 'ERP', axosProtection: { ranges: [{ range: 'C1:D4', locked: true, connectorId: 'c1', connectorType: 'inventory_snapshot' }] } },
    { name: 'Open', axosProtection: { ranges: [{ range: 'E1:F4', locked: false, connectorId: 'c2', connectorType: 'oee_by_line' }] } },
  ],
  connectors: [
    { id: 'c1', type: 'inventory_snapshot', label: 'Inventory', sheetIndex: 1, range: 'C1:D4' },
    { id: 'c2', type: 'oee_by_line', label: 'OEE', sheetIndex: 2, range: 'E1:F4' },
  ],
});

eq(audit.sheetLocks, 1, 'cuenta hojas bloqueadas');
eq(audit.ranges.length, 3, 'cuenta rangos');
eq(audit.lockedRanges, 2, 'cuenta rangos locked');
eq(audit.connectorRanges, 2, 'cuenta rangos connector');
eq(audit.unprotectedConnectors.length, 1, 'detecta conector desprotegido');
eq(audit.unprotectedConnectors[0].id, 'c2', 'reporta conector correcto');
ok(formatProtectionAudit(audit).includes('Conector sin protección'), 'formatea conector desprotegido');

const total = passed + fails.length;
if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`✅ ${passed}/${total}`);
