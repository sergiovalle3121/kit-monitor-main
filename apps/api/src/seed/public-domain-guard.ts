/**
 * AXOS OS — Candado de DOMINIO PÚBLICO para los datos semilla.
 *
 * Garantía legal: en la app SOLO puede haber datos ficticios / de dominio público
 * (universo AXOS). CERO datos de clientes reales (p. ej. el prefijo confidencial
 * `OP-`) ni nombres de empresas reales (Motorola, Optics, Nvidia, …).
 *
 * Este módulo expone:
 *   • `assertPublicDomain(value)` — LANZA si el valor empieza con un prefijo
 *     prohibido o coincide (palabra completa, case-insensitive) con la lista negra.
 *   • Asserts especializados para el seed (modelo AX-, parte de prefijo permitido,
 *     cliente del universo Axos, texto libre).
 *   • `validateDemoCatalog()` — valida TODO el catálogo demo antes de tocar la BD
 *     (falla ruidosamente; nunca inserta datos sospechosos).
 *   • `findForbiddenReason()` / `isForbiddenValue()` — versión booleana que usa el
 *     script de purga para detectar (y borrar) datos ya desplegados.
 */
import {
  DEMO_CUSTOMERS,
  DEMO_MODELS,
  DEMO_PARTS,
  DEMO_PROGRAMS,
  DEMO_SUBASSEMBLIES,
  DEMO_SUBASSEMBLY_PARTS,
  DEMO_SUPPLIERS,
  DEMO_SUPPLIER_PRICES,
} from './seed-constants';

/**
 * Prefijos de número de parte/modelo PROHIBIDOS (datos de clientes reales).
 * `OP-` = cliente "Optics" (confidencial). El dueño puede añadir aquí cualquier
 * otro prefijo de cliente real que descubra; el seed y la purga lo respetarán.
 */
export const FORBIDDEN_PREFIXES: string[] = ['OP-'];

/**
 * Lista negra de NOMBRES DE EMPRESAS REALES (en minúsculas). Se compara por
 * palabra completa (\b…\b), case-insensitive. Editable por el dueño.
 * Nota: "ACME" es ficticio universal y "Robotics" sola (p. ej. "Robotics Cell")
 * son genéricos permitidos — NO van en la lista.
 */
export const REAL_COMPANY_BLACKLIST: string[] = [
  // De la incidencia / addendum:
  'motorola', 'optics', 'nvidia', 'cisco', 'ericsson', 'nokia', 'qualcomm',
  'broadcom', 'apple', 'samsung', 'huawei', 'tesla', 'jabil', 'foxconn',
  'flex', 'flextronics', 'celestica', 'sanmina',
  // EMS / semiconductores / OEM reconocibles (extensión defensiva):
  'intel', 'amd', 'infineon', 'stmicroelectronics', 'stmicro', 'nxp', 'micron',
  'texas instruments', 'analog devices', 'microchip', 'renesas', 'rohm', 'murata',
  'dell', 'lenovo', 'sony', 'panasonic', 'bosch', 'siemens', 'honeywell',
  'microsoft', 'oracle', 'ibm', 'hewlett', 'seagate', 'western digital',
  'boeing', 'airbus', 'continental', 'magna',
];

/** Prefijos de parte PERMITIDOS: AX- (marca AXOS) + commodities genéricos. */
export const ALLOWED_PART_PREFIXES: string[] = [
  'AX-', 'RES-', 'CAP-', 'IND-', 'LED-', 'CRYSTAL-', 'MOS-', 'IC-', 'PCB-',
  'CONN-', 'HDR-', 'SCR-', 'STANDOFF-', 'LABEL-', 'ENC-',
  // Familias de commodity adicionales del catálogo demo expandido:
  'FB-', 'XFMR-', 'DIO-', 'TVS-', 'BJT-', 'OSC-', 'TERM-', 'NUT-', 'WASH-',
  'THM-', 'HS-', 'SUB-', 'FUSE-', 'SW-', 'RLY-', 'POT-', 'FFC-',
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Devuelve el MOTIVO por el que un valor NO es de dominio público, o `null` si
 * está limpio. Base compartida por el assert (seed) y la detección (purga).
 */
export function findForbiddenReason(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const v = String(value).trim();
  if (!v) return null;

  const upper = v.toUpperCase();
  for (const prefix of FORBIDDEN_PREFIXES) {
    if (upper.startsWith(prefix.toUpperCase())) {
      return `prefijo de cliente prohibido "${prefix}"`;
    }
  }

  for (const name of REAL_COMPANY_BLACKLIST) {
    const re = new RegExp(`\\b${escapeRegex(name)}\\b`, 'i');
    if (re.test(v)) return `nombre de empresa real "${name}"`;
  }

  return null;
}

export function isForbiddenValue(value: string | null | undefined): boolean {
  return findForbiddenReason(value) !== null;
}

/** Marcador de redacción usado al anonimizar texto no-dominio-público. */
export const REDACTION_MARK = '[REDACTED]';

/**
 * Devuelve `value` con TODO lo prohibido removido (anonimizado):
 *   • nombres de empresas reales (palabra completa) → `[REDACTED]`.
 *   • si el valor EMPIEZA con un prefijo de cliente prohibido (p. ej. `OP-`) es un
 *     identificador completo de cliente → se redacta entero.
 * Lo usa la purga cuando una fila NO se puede borrar (FK desde datos legítimos):
 * se conserva la fila pero el texto de cliente real desaparece. Idempotente
 * (re-aplicarlo no cambia un valor ya limpio).
 */
export function scrubForbidden(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const trimmed = String(value).trim();
  for (const prefix of FORBIDDEN_PREFIXES) {
    if (trimmed.toUpperCase().startsWith(prefix.toUpperCase())) return REDACTION_MARK;
  }
  let out = String(value);
  for (const name of REAL_COMPANY_BLACKLIST) {
    out = out.replace(new RegExp(`\\b${escapeRegex(name)}\\b`, 'gi'), REDACTION_MARK);
  }
  return out;
}

/** Lanza si `value` no es de dominio público. Centinela legal del seed. */
export function assertPublicDomain(value: string | null | undefined, label = 'valor'): void {
  const reason = findForbiddenReason(value);
  if (reason) {
    throw new Error(
      `🚫 assertPublicDomain: ${label} "${value}" NO es de dominio público (${reason}). ` +
        `Bloqueado por seguridad legal — el seed nunca inserta datos de clientes reales.`,
    );
  }
}

/** Modelo: dominio público + debe ser de la marca AXOS (prefijo AX-). */
export function assertSeedModel(model: string): void {
  assertPublicDomain(model, 'modelNumber');
  if (!model.trim().toUpperCase().startsWith('AX-')) {
    throw new Error(`🚫 Modelo "${model}" debe usar el prefijo AXOS "AX-".`);
  }
}

/** Parte: dominio público + prefijo permitido (AX- o commodity genérico). */
export function assertSeedPart(partNumber: string): void {
  assertPublicDomain(partNumber, 'partNumber');
  const upper = partNumber.trim().toUpperCase();
  if (!ALLOWED_PART_PREFIXES.some((p) => upper.startsWith(p))) {
    throw new Error(
      `🚫 Parte "${partNumber}" no usa un prefijo permitido (${ALLOWED_PART_PREFIXES.join(', ')}).`,
    );
  }
}

/** Cliente: dominio público + del universo Axos (o ACME ficticio). */
export function assertSeedCustomer(customer: string): void {
  assertPublicDomain(customer, 'customer');
  const lower = customer.trim().toLowerCase();
  const ok = lower.startsWith('axos ') || lower === 'axos' || lower.includes('acme');
  if (!ok) {
    throw new Error(`🚫 Cliente "${customer}" no pertenece al universo Axos (ni ACME ficticio).`);
  }
}

/** Texto libre (nombre / descripción): sólo dominio público. */
export function assertSeedText(value: string | null | undefined, label = 'texto'): void {
  assertPublicDomain(value, label);
}

/**
 * Valida TODO el catálogo demo antes de tocar la BD. Si algo no pasa, lanza y el
 * seed aborta (falla ruidosamente). Devuelve el número de campos verificados.
 */
export function validateDemoCatalog(): number {
  let checked = 0;
  const bump = (fn: () => void) => {
    fn();
    checked++;
  };

  for (const part of [...DEMO_PARTS, ...DEMO_SUBASSEMBLY_PARTS]) {
    bump(() => assertSeedPart(part.partNumber));
    bump(() => assertSeedText(part.description, `descripción de ${part.partNumber}`));
    for (const v of part.avl ?? []) {
      bump(() => assertSeedText(v.manufacturer, `fabricante (AVL) de ${part.partNumber}`));
      bump(() => assertSeedText(v.mpn, `MPN (AVL) de ${part.partNumber}`));
    }
  }

  for (const sa of DEMO_SUBASSEMBLIES) {
    bump(() => assertSeedPart(sa.partNumber));
    bump(() => assertSeedText(sa.description, `descripción de sub-ensamble ${sa.partNumber}`));
    for (const line of sa.bom) bump(() => assertSeedPart(line.part));
  }

  for (const s of DEMO_SUPPLIERS) {
    bump(() => assertSeedText(s.name, `nombre de proveedor ${s.code}`));
    bump(() => assertSeedText(s.country, `país de proveedor ${s.code}`));
  }

  for (const sp of DEMO_SUPPLIER_PRICES) {
    bump(() => assertSeedPart(sp.partNumber));
  }

  for (const model of DEMO_MODELS) {
    bump(() => assertSeedModel(model.modelNumber));
    bump(() => assertSeedCustomer(model.customer));
    bump(() => assertSeedText(model.name, `nombre de ${model.modelNumber}`));
    bump(() => assertSeedText(model.description, `descripción de ${model.modelNumber}`));
    for (const line of model.bom) {
      bump(() => assertSeedPart(line.part));
    }
  }

  for (const c of DEMO_CUSTOMERS) {
    bump(() => assertSeedCustomer(c.name));
    bump(() => assertSeedText(c.industry, `industria de ${c.code}`));
  }

  for (const p of DEMO_PROGRAMS) {
    bump(() => assertSeedText(p.name, `nombre de programa ${p.code}`));
  }

  return checked;
}
