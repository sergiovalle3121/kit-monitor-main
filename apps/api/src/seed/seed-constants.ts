/**
 * AXOS OS — Datos semilla DEMO (universo AXOS, 100% ficticio y de dominio público).
 *
 * Catálogo ÚNICO compartido por:
 *   • seed-demo.ts        → siembra usando los servicios reales (estados, folios,
 *                            explosión de BOM y valuación se calculan de verdad).
 *   • seed-demo-clear.ts  → borra SOLO lo sembrado aquí (identidad determinística).
 *   • seed-verify.ts      → verifica el golden path con consultas reales.
 *
 * Reglas legales (estrictas):
 *   - Todo inventado y genérico. Cero marcas, números de parte de fabricantes
 *     reales, ni personas reales. Componentes descritos como commodities.
 *   - Correos con dominio @axos.example (TLD reservado para ejemplos, RFC 2606).
 *   - Sub-marcas ficticias de AXOS: Axos Mobility / Power / Medical / Aero.
 *
 * Marca de DEMO:
 *   - Entidades con `metadata` → `{ demo: true, ... }`.
 *   - Las demás → claves/folios reconocibles (modelos `AX-*`, partes del catálogo,
 *     almacenes `AX-WH-*`, órdenes `AX-WO-*`, correos `@axos.example`).
 *   El borrado usa coincidencia EXACTA contra estas listas (no adivina).
 */

/** Bandera de demo para entidades con columna `metadata`. */
export const DEMO_FLAG = { demo: true as const };

/** Actor (correo) usado para created_by / audit / folios durante la siembra. */
export const DEMO_ACTOR = 'seed-demo@axos.example';

/** Empresa / planta del universo demo (texto, no entidades nuevas). */
export const DEMO_COMPANY = 'Axos Manufacturing';
export const DEMO_PLANT = 'Axos Planta Norte';

// ─────────────────────────────────────────────────────────────────────────────
// Almacenes (EnterpriseWarehouse) — necesarios para crear posiciones de inventario
// (inventory_positions.warehouse_id es FK a enterprise_warehouses.id en Postgres).
// ─────────────────────────────────────────────────────────────────────────────
export interface DemoWarehouse {
  id: string;
  code: string;
  name: string;
  type: 'central' | 'building' | 'subwarehouse' | 'pou' | 'quarantine' | 'transit';
  locationCount: number;
  sortOrder: number;
}

export const DEMO_WAREHOUSES: DemoWarehouse[] = [
  {
    id: 'AX-WH-NORTE-RM',
    code: 'AX-WH-RM',
    name: 'Axos Planta Norte — Almacén Materia Prima',
    type: 'central',
    locationCount: 1200,
    sortOrder: 10,
  },
  {
    id: 'AX-WH-NORTE-WIP',
    code: 'AX-WH-WIP',
    name: 'Axos Planta Norte — Subalmacén WIP Línea',
    type: 'subwarehouse',
    locationCount: 240,
    sortOrder: 20,
  },
  {
    id: 'AX-WH-NORTE-QA',
    code: 'AX-WH-QA',
    name: 'Axos Planta Norte — Cuarentena Calidad',
    type: 'quarantine',
    locationCount: 80,
    sortOrder: 30,
  },
];

/** Almacén principal de materia prima donde se reciben y valúan las partes. */
export const DEMO_WH_RM = 'AX-WH-NORTE-RM';
export const DEMO_WH_WIP = 'AX-WH-NORTE-WIP';
export const DEMO_WH_QA = 'AX-WH-NORTE-QA';

// ─────────────────────────────────────────────────────────────────────────────
// Partes (MaterialMaster) — componentes electrónicos genéricos (commodities).
// standardCost en USD (float). recvQty = cantidad a recibir para tener existencias.
// ─────────────────────────────────────────────────────────────────────────────
export interface DemoPart {
  partNumber: string;
  description: string;
  uom: string;
  category: string;
  standardCost: number;
  abcClass: 'A' | 'B' | 'C';
  recvQty: number;
}

export const DEMO_PARTS: DemoPart[] = [
  // Pasivos
  { partNumber: 'RES-10K-0402', description: 'Resistencia 10kΩ 0402 1%', uom: 'EA', category: 'Resistor', standardCost: 0.004, abcClass: 'C', recvQty: 20000 },
  { partNumber: 'RES-1K-0402', description: 'Resistencia 1kΩ 0402 1%', uom: 'EA', category: 'Resistor', standardCost: 0.004, abcClass: 'C', recvQty: 20000 },
  { partNumber: 'RES-100R-0603', description: 'Resistencia 100Ω 0603 1%', uom: 'EA', category: 'Resistor', standardCost: 0.005, abcClass: 'C', recvQty: 20000 },
  { partNumber: 'CAP-100N-0603', description: 'Capacitor 100nF 0603 X7R', uom: 'EA', category: 'Capacitor', standardCost: 0.012, abcClass: 'C', recvQty: 20000 },
  { partNumber: 'CAP-10U-0805', description: 'Capacitor 10µF 0805 X5R', uom: 'EA', category: 'Capacitor', standardCost: 0.03, abcClass: 'C', recvQty: 15000 },
  { partNumber: 'CAP-1U-0402', description: 'Capacitor 1µF 0402 X5R', uom: 'EA', category: 'Capacitor', standardCost: 0.018, abcClass: 'C', recvQty: 15000 },
  { partNumber: 'IND-4U7-1210', description: 'Inductor 4.7µH 1210 blindado', uom: 'EA', category: 'Inductor', standardCost: 0.085, abcClass: 'B', recvQty: 8000 },
  { partNumber: 'LED-GRN-0603', description: 'LED verde 0603', uom: 'EA', category: 'Optoelectrónica', standardCost: 0.025, abcClass: 'C', recvQty: 10000 },
  { partNumber: 'CRYSTAL-16M', description: 'Cristal 16MHz HC-49 SMD', uom: 'EA', category: 'Frecuencia', standardCost: 0.22, abcClass: 'B', recvQty: 6000 },
  // Semiconductores
  { partNumber: 'MOS-NCH-30V', description: 'MOSFET canal N 30V SOT-23', uom: 'EA', category: 'MOSFET', standardCost: 0.09, abcClass: 'B', recvQty: 8000 },
  { partNumber: 'MOS-PCH-20V', description: 'MOSFET canal P 20V SOT-23', uom: 'EA', category: 'MOSFET', standardCost: 0.11, abcClass: 'B', recvQty: 6000 },
  { partNumber: 'IC-MCU-32B', description: 'Microcontrolador 32-bit genérico LQFP48', uom: 'EA', category: 'IC', standardCost: 2.35, abcClass: 'A', recvQty: 3000 },
  { partNumber: 'IC-OPAMP-DUAL', description: 'Amplificador operacional dual SOIC-8', uom: 'EA', category: 'IC', standardCost: 0.31, abcClass: 'B', recvQty: 4000 },
  { partNumber: 'IC-LDO-3V3', description: 'Regulador LDO 3.3V SOT-223', uom: 'EA', category: 'IC', standardCost: 0.18, abcClass: 'B', recvQty: 5000 },
  { partNumber: 'IC-XCVR-CAN', description: 'Transceptor CAN genérico SOIC-8', uom: 'EA', category: 'IC', standardCost: 0.56, abcClass: 'A', recvQty: 3000 },
  { partNumber: 'IC-SENSOR-TEMP', description: 'Sensor de temperatura digital genérico', uom: 'EA', category: 'IC', standardCost: 0.48, abcClass: 'A', recvQty: 4000 },
  // PCBs (placas desnudas)
  { partNumber: 'PCB-AX100-4L', description: 'PCB 4 capas FR4 — AX-DRIVE-100', uom: 'EA', category: 'PCB', standardCost: 6.5, abcClass: 'A', recvQty: 800 },
  { partNumber: 'PCB-AX200-6L', description: 'PCB 6 capas FR4 — AX-POWER-200', uom: 'EA', category: 'PCB', standardCost: 11.2, abcClass: 'A', recvQty: 800 },
  { partNumber: 'PCB-AX300-2L', description: 'PCB 2 capas FR4 — AX-SENSE-300', uom: 'EA', category: 'PCB', standardCost: 2.4, abcClass: 'A', recvQty: 800 },
  { partNumber: 'PCB-AX400-4L', description: 'PCB 4 capas FR4 — AX-COMM-400', uom: 'EA', category: 'PCB', standardCost: 5.8, abcClass: 'A', recvQty: 800 },
  // Conectores
  { partNumber: 'CONN-2540-08', description: 'Conector header 2.54mm 8 pines', uom: 'EA', category: 'Conector', standardCost: 0.15, abcClass: 'B', recvQty: 8000 },
  { partNumber: 'CONN-USB-C', description: 'Conector USB-C SMD', uom: 'EA', category: 'Conector', standardCost: 0.42, abcClass: 'B', recvQty: 4000 },
  { partNumber: 'CONN-RJ45-MAG', description: 'Conector RJ45 con magnetics', uom: 'EA', category: 'Conector', standardCost: 0.89, abcClass: 'A', recvQty: 2000 },
  { partNumber: 'HDR-TEST-04', description: 'Header de prueba 4 pines', uom: 'EA', category: 'Conector', standardCost: 0.08, abcClass: 'C', recvQty: 6000 },
  // Mecánica / etiquetado / carcasa
  { partNumber: 'SCR-M3-8', description: 'Tornillo M3x8 acero inoxidable', uom: 'EA', category: 'Tornillería', standardCost: 0.015, abcClass: 'C', recvQty: 20000 },
  { partNumber: 'STANDOFF-M3', description: 'Separador M3 nylon', uom: 'EA', category: 'Tornillería', standardCost: 0.04, abcClass: 'C', recvQty: 12000 },
  { partNumber: 'LABEL-QR-AX', description: 'Etiqueta QR de trazabilidad', uom: 'EA', category: 'Etiqueta', standardCost: 0.03, abcClass: 'C', recvQty: 15000 },
  { partNumber: 'ENC-AX-ALU', description: 'Carcasa de aluminio extruido genérica', uom: 'EA', category: 'Carcasa', standardCost: 3.2, abcClass: 'A', recvQty: 800 },
];

export const DEMO_PART_NUMBERS: string[] = DEMO_PARTS.map((p) => p.partNumber);

// ─────────────────────────────────────────────────────────────────────────────
// Clientes / Programas (EnterpriseCustomer + EnterpriseProgram) — sub-marcas AXOS.
// ─────────────────────────────────────────────────────────────────────────────
export interface DemoCustomer {
  code: string;
  name: string;
  industry: string;
}

export interface DemoProgram {
  code: string;
  name: string;
  customerCode: string;
  prefix: string; // primaryModelPrefix → liga planes/modelos al programa
  status: 'active' | 'npi' | 'ramping';
}

export const DEMO_CUSTOMERS: DemoCustomer[] = [
  { code: 'AX-MOBILITY', name: 'Axos Mobility', industry: 'Movilidad Eléctrica' },
  { code: 'AX-POWER', name: 'Axos Power', industry: 'Sistemas de Potencia' },
  { code: 'AX-MEDICAL', name: 'Axos Medical', industry: 'Dispositivos Médicos' },
  { code: 'AX-AERO', name: 'Axos Aero', industry: 'Aeroespacial' },
];

export const DEMO_PROGRAMS: DemoProgram[] = [
  { code: 'AX-MOBILITY-P', name: 'Axos Mobility — Tracción EV', customerCode: 'AX-MOBILITY', prefix: 'AX-DRIVE', status: 'active' },
  { code: 'AX-POWER-P', name: 'Axos Power — Módulos 48V', customerCode: 'AX-POWER', prefix: 'AX-POWER', status: 'ramping' },
  { code: 'AX-MEDICAL-P', name: 'Axos Medical — Sensores', customerCode: 'AX-MEDICAL', prefix: 'AX-SENSE', status: 'npi' },
  { code: 'AX-AERO-P', name: 'Axos Aero — Comunicaciones', customerCode: 'AX-AERO', prefix: 'AX-COMM', status: 'active' },
];

export const DEMO_CUSTOMER_CODES: string[] = DEMO_CUSTOMERS.map((c) => c.code);
export const DEMO_PROGRAM_CODES: string[] = DEMO_PROGRAMS.map((p) => p.code);

// ─────────────────────────────────────────────────────────────────────────────
// Modelos (ProductModel) + su BOM (componentes por unidad terminada).
// ─────────────────────────────────────────────────────────────────────────────
export interface DemoBomLine {
  part: string; // debe existir en DEMO_PARTS
  qty: number; // cantidad por unidad terminada
  ref?: string; // designadores de referencia
}

export interface DemoModel {
  modelNumber: string; // folio reconocible AX-*
  name: string;
  customer: string; // sub-marca AXOS (texto)
  programCode: string; // liga a DEMO_PROGRAMS.code
  revision: string;
  description: string;
  bom: DemoBomLine[];
}

export const DEMO_MODELS: DemoModel[] = [
  {
    modelNumber: 'AX-DRIVE-100',
    name: 'Tarjeta Controladora de Tracción',
    customer: 'Axos Mobility',
    programCode: 'AX-MOBILITY-P',
    revision: 'B',
    description: 'Controladora de tracción para plataforma EV (universo demo AXOS).',
    bom: [
      { part: 'PCB-AX100-4L', qty: 1, ref: 'PCB1' },
      { part: 'IC-MCU-32B', qty: 1, ref: 'U1' },
      { part: 'IC-XCVR-CAN', qty: 1, ref: 'U2' },
      { part: 'MOS-NCH-30V', qty: 6, ref: 'Q1-Q6' },
      { part: 'MOS-PCH-20V', qty: 2, ref: 'Q7-Q8' },
      { part: 'CAP-100N-0603', qty: 12, ref: 'C1-C12' },
      { part: 'CAP-10U-0805', qty: 4, ref: 'C13-C16' },
      { part: 'RES-10K-0402', qty: 10, ref: 'R1-R10' },
      { part: 'RES-1K-0402', qty: 6, ref: 'R11-R16' },
      { part: 'CRYSTAL-16M', qty: 1, ref: 'Y1' },
      { part: 'IC-LDO-3V3', qty: 1, ref: 'U3' },
      { part: 'CONN-2540-08', qty: 2, ref: 'J1-J2' },
      { part: 'LED-GRN-0603', qty: 2, ref: 'D1-D2' },
      { part: 'SCR-M3-8', qty: 4, ref: 'HW1-HW4' },
    ],
  },
  {
    modelNumber: 'AX-POWER-200',
    name: 'Módulo de Potencia 48V',
    customer: 'Axos Power',
    programCode: 'AX-POWER-P',
    revision: 'A',
    description: 'Módulo de potencia conmutada 48V (universo demo AXOS).',
    bom: [
      { part: 'PCB-AX200-6L', qty: 1, ref: 'PCB1' },
      { part: 'MOS-NCH-30V', qty: 8, ref: 'Q1-Q8' },
      { part: 'IC-LDO-3V3', qty: 2, ref: 'U1-U2' },
      { part: 'CAP-10U-0805', qty: 8, ref: 'C1-C8' },
      { part: 'CAP-1U-0402', qty: 6, ref: 'C9-C14' },
      { part: 'IND-4U7-1210', qty: 4, ref: 'L1-L4' },
      { part: 'RES-100R-0603', qty: 8, ref: 'R1-R8' },
      { part: 'IC-OPAMP-DUAL', qty: 2, ref: 'U3-U4' },
      { part: 'CONN-2540-08', qty: 3, ref: 'J1-J3' },
      { part: 'ENC-AX-ALU', qty: 1, ref: 'ENC1' },
      { part: 'SCR-M3-8', qty: 6, ref: 'HW1-HW6' },
      { part: 'STANDOFF-M3', qty: 4, ref: 'HW7-HW10' },
    ],
  },
  {
    modelNumber: 'AX-SENSE-300',
    name: 'Placa de Sensores Ambientales',
    customer: 'Axos Medical',
    programCode: 'AX-MEDICAL-P',
    revision: 'C',
    description: 'Placa de sensores ambientales para equipo médico (universo demo AXOS).',
    bom: [
      { part: 'PCB-AX300-2L', qty: 1, ref: 'PCB1' },
      { part: 'IC-SENSOR-TEMP', qty: 3, ref: 'U1-U3' },
      { part: 'IC-MCU-32B', qty: 1, ref: 'U4' },
      { part: 'IC-OPAMP-DUAL', qty: 1, ref: 'U5' },
      { part: 'CAP-100N-0603', qty: 8, ref: 'C1-C8' },
      { part: 'CAP-1U-0402', qty: 3, ref: 'C9-C11' },
      { part: 'RES-10K-0402', qty: 6, ref: 'R1-R6' },
      { part: 'RES-100R-0603', qty: 4, ref: 'R7-R10' },
      { part: 'LED-GRN-0603', qty: 3, ref: 'D1-D3' },
      { part: 'CONN-USB-C', qty: 1, ref: 'J1' },
      { part: 'HDR-TEST-04', qty: 1, ref: 'TP1' },
      { part: 'LABEL-QR-AX', qty: 1, ref: 'LBL1' },
    ],
  },
  {
    modelNumber: 'AX-COMM-400',
    name: 'Módulo de Comunicación Industrial',
    customer: 'Axos Aero',
    programCode: 'AX-AERO-P',
    revision: 'A',
    description: 'Módulo de comunicación industrial CAN/Ethernet (universo demo AXOS).',
    bom: [
      { part: 'PCB-AX400-4L', qty: 1, ref: 'PCB1' },
      { part: 'IC-MCU-32B', qty: 1, ref: 'U1' },
      { part: 'IC-XCVR-CAN', qty: 1, ref: 'U2' },
      { part: 'CONN-RJ45-MAG', qty: 1, ref: 'J1' },
      { part: 'CONN-USB-C', qty: 1, ref: 'J2' },
      { part: 'CAP-100N-0603', qty: 10, ref: 'C1-C10' },
      { part: 'CAP-10U-0805', qty: 2, ref: 'C11-C12' },
      { part: 'RES-10K-0402', qty: 8, ref: 'R1-R8' },
      { part: 'RES-1K-0402', qty: 4, ref: 'R9-R12' },
      { part: 'IND-4U7-1210', qty: 2, ref: 'L1-L2' },
      { part: 'IC-LDO-3V3', qty: 1, ref: 'U3' },
      { part: 'CRYSTAL-16M', qty: 1, ref: 'Y1' },
      { part: 'LED-GRN-0603', qty: 2, ref: 'D1-D2' },
      { part: 'LABEL-QR-AX', qty: 1, ref: 'LBL1' },
    ],
  },
];

export const DEMO_MODEL_NUMBERS: string[] = DEMO_MODELS.map((m) => m.modelNumber);

/** Revisión usada para todos los BOM demo (debe ser única por modelo). */
export const DEMO_BOM_REVISION = '1.0';

// ─────────────────────────────────────────────────────────────────────────────
// Planes / Órdenes de trabajo (Plan). `publish: true` → se explota el BOM en kit.
// ─────────────────────────────────────────────────────────────────────────────
export interface DemoPlan {
  workOrder: string; // folio reconocible AX-WO-*
  model: string; // debe existir en DEMO_MODELS
  quantity: number;
  line: number;
  shift: 'T1' | 'T2' | 'T3';
  publish: boolean;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export const DEMO_PLANS: DemoPlan[] = [
  { workOrder: 'AX-WO-0001', model: 'AX-DRIVE-100', quantity: 50, line: 1, shift: 'T1', publish: true, priority: 'high' },
  { workOrder: 'AX-WO-0002', model: 'AX-DRIVE-100', quantity: 120, line: 1, shift: 'T2', publish: false, priority: 'normal' },
  { workOrder: 'AX-WO-0003', model: 'AX-POWER-200', quantity: 30, line: 2, shift: 'T1', publish: true, priority: 'critical' },
  { workOrder: 'AX-WO-0004', model: 'AX-POWER-200', quantity: 75, line: 2, shift: 'T3', publish: false, priority: 'normal' },
  { workOrder: 'AX-WO-0005', model: 'AX-SENSE-300', quantity: 200, line: 5, shift: 'T2', publish: true, priority: 'normal' },
  { workOrder: 'AX-WO-0006', model: 'AX-SENSE-300', quantity: 60, line: 5, shift: 'T1', publish: false, priority: 'high' },
  { workOrder: 'AX-WO-0007', model: 'AX-COMM-400', quantity: 40, line: 7, shift: 'T1', publish: true, priority: 'normal' },
  { workOrder: 'AX-WO-0008', model: 'AX-COMM-400', quantity: 90, line: 7, shift: 'T2', publish: false, priority: 'normal' },
];

export const DEMO_WORK_ORDERS: string[] = DEMO_PLANS.map((p) => p.workOrder);

// ─────────────────────────────────────────────────────────────────────────────
// Usuarios demo (roles variados). Correos @axos.example. Contraseña demo.
// ─────────────────────────────────────────────────────────────────────────────
export interface DemoUser {
  email: string;
  username: string;
  name: string;
  role: string; // UserRole (string)
  position: string;
}

export const DEMO_USER_PASSWORD = 'AxosDemo#2025';

export const DEMO_USERS: DemoUser[] = [
  { email: 'planeacion@axos.example', username: 'ax.planner', name: 'Ana Planeación', role: 'Planner', position: 'Planeador' },
  { email: 'almacen@axos.example', username: 'ax.warehouse', name: 'Beto Almacén', role: 'Warehouse Operator', position: 'Almacenista' },
  { email: 'calidad@axos.example', username: 'ax.quality', name: 'Carla Calidad', role: 'Quality Engineer', position: 'Ingeniero de Calidad' },
  { email: 'materiales@axos.example', username: 'ax.materials', name: 'Diego Materiales', role: 'Materials Lead', position: 'Líder de Materiales' },
];

export const DEMO_USER_EMAILS: string[] = DEMO_USERS.map((u) => u.email);

// ─────────────────────────────────────────────────────────────────────────────
// Referencias de movimiento de inventario (para idempotencia + borrado).
// ─────────────────────────────────────────────────────────────────────────────
export const MV_REF_RECEIVE = 'AX-SEED-RCV';
export const MV_REF_CONSUME = 'AX-SEED-CON';
export const MV_REF_HOLD = 'AX-SEED-QA';
export const DEMO_MV_REF_TYPES: string[] = [MV_REF_RECEIVE, MV_REF_CONSUME, MV_REF_HOLD];

/**
 * Existencias en CALIDAD (cuarentena / inspección de entrada). Demuestran el
 * flujo de holds: material recibido en `AX-WH-NORTE-QA` con `holdStatus` distinto
 * de `available` (no se puede mover/consumir hasta liberarlo).
 */
export interface DemoHold {
  part: string;
  quantity: number;
  holdStatus: 'quarantine' | 'pending_iqc';
}

export const DEMO_HOLDS: DemoHold[] = [
  { part: 'PCB-AX200-6L', quantity: 120, holdStatus: 'pending_iqc' },
  { part: 'IC-MCU-32B', quantity: 300, holdStatus: 'pending_iqc' },
  { part: 'CONN-RJ45-MAG', quantity: 200, holdStatus: 'quarantine' },
];

/** Igual que EnterpriseCampusService.slug — para predecir ids de cliente/programa. */
export function slugCode(code: string): string {
  return code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
