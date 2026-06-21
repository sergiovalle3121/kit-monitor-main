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
// Cada parte lleva un AVL ficticio (fabricante + MPN) — ver buildAvl().
// ─────────────────────────────────────────────────────────────────────────────
export interface DemoAvl {
  manufacturer: string; // fabricante FICTICIO (dominio público)
  mpn: string; // número de parte del fabricante (ficticio)
}

export interface DemoPart {
  partNumber: string;
  description: string;
  uom: string;
  category: string;
  standardCost: number;
  abcClass: 'A' | 'B' | 'C';
  recvQty: number;
  avl: DemoAvl[]; // lista de fabricantes aprobados (Approved Vendor List)
}

/**
 * Fabricantes FICTICIOS del universo AXOS (cero marcas reales). Se asignan por
 * familia de componente para armar un AVL plausible (fabricante + MPN) por parte.
 */
export const DEMO_MANUFACTURERS: Record<string, { name: string; code: string }> = {
  passive: { name: 'Ferrum Passives', code: 'FRM' },
  capacitor: { name: 'Voltaic Components', code: 'VLT' },
  magnetic: { name: 'Kestrel Magnetics', code: 'KST' },
  semi: { name: 'Norvel Semiconductors', code: 'NVL' },
  ic: { name: 'Axon Microelectronics', code: 'AXN' },
  opto: { name: 'Lumina Optoelectronics', code: 'LMN' },
  sensor: { name: 'Sentinel Sensors', code: 'SNT' },
  timing: { name: 'Quartzon Timing', code: 'QTZ' },
  connector: { name: 'Cobalt Connectors', code: 'CBT' },
  mech: { name: 'Granite Hardware', code: 'GRN' },
  pcb: { name: 'Strataboard Fab', code: 'STB' },
};

/** Mapea categoría → familia de fabricante para el AVL. */
function mfgFamily(category: string): keyof typeof DEMO_MANUFACTURERS {
  const c = category.toLowerCase();
  if (c.includes('resist')) return 'passive';
  if (c.includes('capacitor')) return 'capacitor';
  if (c.includes('inductor') || c.includes('ferrite') || c.includes('transformador')) return 'magnetic';
  if (c.includes('mosfet') || c.includes('diodo') || c.includes('transistor')) return 'semi';
  if (c.includes('sensor')) return 'sensor';
  if (c === 'ic' || c.includes('regulador') || c.includes('memoria')) return 'ic';
  if (c.includes('opto') || c.includes('led')) return 'opto';
  if (c.includes('frecuencia') || c.includes('oscilador') || c.includes('cristal')) return 'timing';
  if (c.includes('conector')) return 'connector';
  if (c.includes('pcb')) return 'pcb';
  return 'mech';
}

/** Construye un AVL ficticio (fabricante + MPN derivado del partNumber). */
function buildAvl(part: Omit<DemoPart, 'avl'>): DemoAvl[] {
  const fam = DEMO_MANUFACTURERS[mfgFamily(part.category)];
  const suffix = part.partNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(-9);
  const avl: DemoAvl[] = [{ manufacturer: fam.name, mpn: `${fam.code}-${suffix}` }];
  // Las partes A reciben una 2ª fuente aprobada (alterna) para que el AVL sea lista.
  if (part.abcClass === 'A') {
    avl.push({ manufacturer: DEMO_MANUFACTURERS.ic.name, mpn: `AXN2-${suffix}` });
  }
  return avl;
}

const RAW_PARTS: Array<Omit<DemoPart, 'avl'>> = [
  // ── Resistores ──
  { partNumber: 'RES-0R-0402', description: 'Resistencia 0Ω 0402 (jumper)', uom: 'EA', category: 'Resistor', standardCost: 0.003, abcClass: 'C', recvQty: 20000 },
  { partNumber: 'RES-10K-0402', description: 'Resistencia 10kΩ 0402 1%', uom: 'EA', category: 'Resistor', standardCost: 0.004, abcClass: 'C', recvQty: 20000 },
  { partNumber: 'RES-1K-0402', description: 'Resistencia 1kΩ 0402 1%', uom: 'EA', category: 'Resistor', standardCost: 0.004, abcClass: 'C', recvQty: 20000 },
  { partNumber: 'RES-100R-0603', description: 'Resistencia 100Ω 0603 1%', uom: 'EA', category: 'Resistor', standardCost: 0.005, abcClass: 'C', recvQty: 20000 },
  { partNumber: 'RES-220R-0402', description: 'Resistencia 220Ω 0402 1%', uom: 'EA', category: 'Resistor', standardCost: 0.004, abcClass: 'C', recvQty: 18000 },
  { partNumber: 'RES-470R-0402', description: 'Resistencia 470Ω 0402 1%', uom: 'EA', category: 'Resistor', standardCost: 0.004, abcClass: 'C', recvQty: 18000 },
  { partNumber: 'RES-2K2-0402', description: 'Resistencia 2.2kΩ 0402 1%', uom: 'EA', category: 'Resistor', standardCost: 0.004, abcClass: 'C', recvQty: 18000 },
  { partNumber: 'RES-4K7-0603', description: 'Resistencia 4.7kΩ 0603 1%', uom: 'EA', category: 'Resistor', standardCost: 0.005, abcClass: 'C', recvQty: 16000 },
  { partNumber: 'RES-47K-0402', description: 'Resistencia 47kΩ 0402 1%', uom: 'EA', category: 'Resistor', standardCost: 0.004, abcClass: 'C', recvQty: 16000 },
  { partNumber: 'RES-100K-0402', description: 'Resistencia 100kΩ 0402 1%', uom: 'EA', category: 'Resistor', standardCost: 0.004, abcClass: 'C', recvQty: 16000 },
  { partNumber: 'RES-1M-0603', description: 'Resistencia 1MΩ 0603 1%', uom: 'EA', category: 'Resistor', standardCost: 0.006, abcClass: 'C', recvQty: 12000 },
  { partNumber: 'RES-SHUNT-5M', description: 'Resistencia shunt 5mΩ 2512 1W', uom: 'EA', category: 'Resistor', standardCost: 0.12, abcClass: 'B', recvQty: 6000 },
  // ── Capacitores ──
  { partNumber: 'CAP-100N-0603', description: 'Capacitor 100nF 0603 X7R', uom: 'EA', category: 'Capacitor', standardCost: 0.012, abcClass: 'C', recvQty: 20000 },
  { partNumber: 'CAP-1N-0402', description: 'Capacitor 1nF 0402 C0G', uom: 'EA', category: 'Capacitor', standardCost: 0.01, abcClass: 'C', recvQty: 18000 },
  { partNumber: 'CAP-10N-0603', description: 'Capacitor 10nF 0603 X7R', uom: 'EA', category: 'Capacitor', standardCost: 0.011, abcClass: 'C', recvQty: 18000 },
  { partNumber: 'CAP-1U-0402', description: 'Capacitor 1µF 0402 X5R', uom: 'EA', category: 'Capacitor', standardCost: 0.018, abcClass: 'C', recvQty: 15000 },
  { partNumber: 'CAP-2U2-0805', description: 'Capacitor 2.2µF 0805 X5R', uom: 'EA', category: 'Capacitor', standardCost: 0.024, abcClass: 'C', recvQty: 14000 },
  { partNumber: 'CAP-10U-0805', description: 'Capacitor 10µF 0805 X5R', uom: 'EA', category: 'Capacitor', standardCost: 0.03, abcClass: 'C', recvQty: 15000 },
  { partNumber: 'CAP-22U-1206', description: 'Capacitor 22µF 1206 X5R', uom: 'EA', category: 'Capacitor', standardCost: 0.055, abcClass: 'B', recvQty: 9000 },
  { partNumber: 'CAP-47U-1210', description: 'Capacitor 47µF 1210 X5R', uom: 'EA', category: 'Capacitor', standardCost: 0.11, abcClass: 'B', recvQty: 7000 },
  { partNumber: 'CAP-100U-ELEC', description: 'Capacitor electrolítico 100µF 25V', uom: 'EA', category: 'Capacitor', standardCost: 0.14, abcClass: 'B', recvQty: 6000 },
  { partNumber: 'CAP-470U-ELEC', description: 'Capacitor electrolítico 470µF 35V', uom: 'EA', category: 'Capacitor', standardCost: 0.26, abcClass: 'B', recvQty: 4000 },
  // ── Inductores / magnéticos ──
  { partNumber: 'IND-1U0-0805', description: 'Inductor 1.0µH 0805 blindado', uom: 'EA', category: 'Inductor', standardCost: 0.06, abcClass: 'B', recvQty: 8000 },
  { partNumber: 'IND-4U7-1210', description: 'Inductor 4.7µH 1210 blindado', uom: 'EA', category: 'Inductor', standardCost: 0.085, abcClass: 'B', recvQty: 8000 },
  { partNumber: 'IND-10U-1210', description: 'Inductor 10µH 1210 blindado', uom: 'EA', category: 'Inductor', standardCost: 0.11, abcClass: 'B', recvQty: 6000 },
  { partNumber: 'FB-600R-0805', description: 'Ferrite bead 600Ω@100MHz 0805', uom: 'EA', category: 'Ferrite', standardCost: 0.02, abcClass: 'C', recvQty: 12000 },
  { partNumber: 'XFMR-FLYBACK-5W', description: 'Transformador flyback 5W genérico', uom: 'EA', category: 'Transformador', standardCost: 1.45, abcClass: 'A', recvQty: 1500 },
  // ── Diodos / protección ──
  { partNumber: 'DIO-SCH-40V', description: 'Diodo Schottky 40V 1A SMA', uom: 'EA', category: 'Diodo', standardCost: 0.05, abcClass: 'B', recvQty: 10000 },
  { partNumber: 'DIO-RECT-1A', description: 'Diodo rectificador 1A 100V', uom: 'EA', category: 'Diodo', standardCost: 0.04, abcClass: 'C', recvQty: 10000 },
  { partNumber: 'DIO-ZEN-5V1', description: 'Diodo Zener 5.1V SOD-323', uom: 'EA', category: 'Diodo', standardCost: 0.035, abcClass: 'C', recvQty: 9000 },
  { partNumber: 'TVS-5V0-SOD', description: 'Diodo TVS/ESD 5V unidireccional SOD-523', uom: 'EA', category: 'Diodo', standardCost: 0.06, abcClass: 'B', recvQty: 9000 },
  // ── Transistores ──
  { partNumber: 'MOS-NCH-30V', description: 'MOSFET canal N 30V SOT-23', uom: 'EA', category: 'MOSFET', standardCost: 0.09, abcClass: 'B', recvQty: 8000 },
  { partNumber: 'MOS-PCH-20V', description: 'MOSFET canal P 20V SOT-23', uom: 'EA', category: 'MOSFET', standardCost: 0.11, abcClass: 'B', recvQty: 6000 },
  { partNumber: 'MOS-NCH-60V', description: 'MOSFET canal N 60V potencia PPAK', uom: 'EA', category: 'MOSFET', standardCost: 0.34, abcClass: 'A', recvQty: 5000 },
  { partNumber: 'BJT-NPN-SOT23', description: 'Transistor NPN 40V SOT-23', uom: 'EA', category: 'Transistor', standardCost: 0.03, abcClass: 'C', recvQty: 10000 },
  { partNumber: 'BJT-PNP-SOT23', description: 'Transistor PNP 40V SOT-23', uom: 'EA', category: 'Transistor', standardCost: 0.03, abcClass: 'C', recvQty: 10000 },
  // ── Circuitos integrados ──
  { partNumber: 'IC-MCU-32B', description: 'Microcontrolador 32-bit genérico LQFP48', uom: 'EA', category: 'IC', standardCost: 2.35, abcClass: 'A', recvQty: 3000 },
  { partNumber: 'IC-MCU-32B-LQFP64', description: 'Microcontrolador 32-bit genérico LQFP64', uom: 'EA', category: 'IC', standardCost: 3.1, abcClass: 'A', recvQty: 2500 },
  { partNumber: 'IC-OPAMP-DUAL', description: 'Amplificador operacional dual SOIC-8', uom: 'EA', category: 'IC', standardCost: 0.31, abcClass: 'B', recvQty: 4000 },
  { partNumber: 'IC-OPAMP-SINGLE', description: 'Amplificador operacional sencillo SOT-23-5', uom: 'EA', category: 'IC', standardCost: 0.19, abcClass: 'C', recvQty: 5000 },
  { partNumber: 'IC-COMP-DUAL', description: 'Comparador dual SOIC-8', uom: 'EA', category: 'IC', standardCost: 0.28, abcClass: 'B', recvQty: 4000 },
  { partNumber: 'IC-LDO-3V3', description: 'Regulador LDO 3.3V SOT-223', uom: 'EA', category: 'Regulador', standardCost: 0.18, abcClass: 'B', recvQty: 5000 },
  { partNumber: 'IC-BUCK-2A', description: 'Regulador buck síncrono 2A QFN', uom: 'EA', category: 'Regulador', standardCost: 0.62, abcClass: 'A', recvQty: 3000 },
  { partNumber: 'IC-BOOST-1A', description: 'Regulador boost 1A TSOT', uom: 'EA', category: 'Regulador', standardCost: 0.48, abcClass: 'B', recvQty: 3000 },
  { partNumber: 'IC-GATE-DRV', description: 'Driver de compuerta medio puente SOIC-8', uom: 'EA', category: 'IC', standardCost: 0.74, abcClass: 'A', recvQty: 3000 },
  { partNumber: 'IC-XCVR-CAN', description: 'Transceptor CAN genérico SOIC-8', uom: 'EA', category: 'IC', standardCost: 0.56, abcClass: 'A', recvQty: 3000 },
  { partNumber: 'IC-XCVR-485', description: 'Transceptor RS-485 half-duplex SOIC-8', uom: 'EA', category: 'IC', standardCost: 0.45, abcClass: 'B', recvQty: 3000 },
  { partNumber: 'IC-USB-XCVR', description: 'Transceptor USB full-speed QFN', uom: 'EA', category: 'IC', standardCost: 0.66, abcClass: 'B', recvQty: 2500 },
  { partNumber: 'IC-ETH-PHY', description: 'PHY Ethernet 10/100 genérico QFN-32', uom: 'EA', category: 'IC', standardCost: 1.2, abcClass: 'A', recvQty: 2000 },
  { partNumber: 'IC-EEPROM-256K', description: 'EEPROM I2C 256kbit SOIC-8', uom: 'EA', category: 'Memoria', standardCost: 0.16, abcClass: 'B', recvQty: 4000 },
  { partNumber: 'IC-ADC-12B', description: 'ADC 12-bit SPI MSOP-10', uom: 'EA', category: 'IC', standardCost: 1.05, abcClass: 'A', recvQty: 2500 },
  { partNumber: 'IC-DAC-10B', description: 'DAC 10-bit I2C SOT-23-6', uom: 'EA', category: 'IC', standardCost: 0.72, abcClass: 'B', recvQty: 2500 },
  { partNumber: 'IC-VREF-2V5', description: 'Referencia de voltaje 2.5V SOT-23', uom: 'EA', category: 'IC', standardCost: 0.34, abcClass: 'B', recvQty: 3000 },
  { partNumber: 'IC-CURR-SENSE', description: 'Amplificador de corriente bidireccional MSOP', uom: 'EA', category: 'IC', standardCost: 0.58, abcClass: 'B', recvQty: 3000 },
  { partNumber: 'IC-RTC-I2C', description: 'Reloj de tiempo real I2C SOIC-8', uom: 'EA', category: 'IC', standardCost: 0.52, abcClass: 'B', recvQty: 3000 },
  // ── Sensores ──
  { partNumber: 'IC-SENSOR-TEMP', description: 'Sensor de temperatura digital genérico', uom: 'EA', category: 'Sensor', standardCost: 0.48, abcClass: 'A', recvQty: 4000 },
  { partNumber: 'IC-ACCEL-3AX', description: 'Acelerómetro 3 ejes I2C LGA', uom: 'EA', category: 'Sensor', standardCost: 0.95, abcClass: 'A', recvQty: 2500 },
  { partNumber: 'IC-PRESS-SENSE', description: 'Sensor de presión barométrico genérico', uom: 'EA', category: 'Sensor', standardCost: 1.1, abcClass: 'A', recvQty: 2000 },
  { partNumber: 'IC-HALL-SW', description: 'Sensor Hall de conmutación SOT-23', uom: 'EA', category: 'Sensor', standardCost: 0.22, abcClass: 'B', recvQty: 4000 },
  // ── Optoelectrónica ──
  { partNumber: 'LED-GRN-0603', description: 'LED verde 0603', uom: 'EA', category: 'Optoelectrónica', standardCost: 0.025, abcClass: 'C', recvQty: 10000 },
  { partNumber: 'LED-RED-0603', description: 'LED rojo 0603', uom: 'EA', category: 'Optoelectrónica', standardCost: 0.025, abcClass: 'C', recvQty: 10000 },
  { partNumber: 'LED-RGB-PLCC', description: 'LED RGB PLCC-6', uom: 'EA', category: 'Optoelectrónica', standardCost: 0.11, abcClass: 'B', recvQty: 6000 },
  // ── Frecuencia / timing ──
  { partNumber: 'CRYSTAL-16M', description: 'Cristal 16MHz HC-49 SMD', uom: 'EA', category: 'Frecuencia', standardCost: 0.22, abcClass: 'B', recvQty: 6000 },
  { partNumber: 'CRYSTAL-8M', description: 'Cristal 8MHz SMD 3.2x2.5', uom: 'EA', category: 'Frecuencia', standardCost: 0.2, abcClass: 'B', recvQty: 6000 },
  { partNumber: 'CRYSTAL-32K768', description: 'Cristal 32.768kHz para RTC', uom: 'EA', category: 'Frecuencia', standardCost: 0.18, abcClass: 'B', recvQty: 6000 },
  { partNumber: 'OSC-25M-CMOS', description: 'Oscilador CMOS 25MHz SMD', uom: 'EA', category: 'Oscilador', standardCost: 0.55, abcClass: 'B', recvQty: 3000 },
  // ── PCBs (placas desnudas) ──
  { partNumber: 'PCB-AX100-4L', description: 'PCB 4 capas FR4 — AX-DRIVE-100', uom: 'EA', category: 'PCB', standardCost: 6.5, abcClass: 'A', recvQty: 800 },
  { partNumber: 'PCB-AX200-6L', description: 'PCB 6 capas FR4 — AX-POWER-200', uom: 'EA', category: 'PCB', standardCost: 11.2, abcClass: 'A', recvQty: 800 },
  { partNumber: 'PCB-AX300-2L', description: 'PCB 2 capas FR4 — AX-SENSE-300', uom: 'EA', category: 'PCB', standardCost: 2.4, abcClass: 'A', recvQty: 800 },
  { partNumber: 'PCB-AX400-4L', description: 'PCB 4 capas FR4 — AX-COMM-400', uom: 'EA', category: 'PCB', standardCost: 5.8, abcClass: 'A', recvQty: 800 },
  { partNumber: 'PCB-AX500-6L', description: 'PCB 6 capas FR4 — AX-MOTOR-500', uom: 'EA', category: 'PCB', standardCost: 9.4, abcClass: 'A', recvQty: 600 },
  { partNumber: 'PCB-AX600-4L', description: 'PCB 4 capas FR4 — AX-GATE-600', uom: 'EA', category: 'PCB', standardCost: 6.1, abcClass: 'A', recvQty: 600 },
  { partNumber: 'PCB-AX700-4L', description: 'PCB 4 capas FR4 — AX-METER-700', uom: 'EA', category: 'PCB', standardCost: 4.9, abcClass: 'A', recvQty: 600 },
  { partNumber: 'PCB-AX800-2L', description: 'PCB 2 capas FR4 — AX-NODE-800', uom: 'EA', category: 'PCB', standardCost: 2.1, abcClass: 'A', recvQty: 600 },
  // ── Conectores ──
  { partNumber: 'CONN-2540-08', description: 'Conector header 2.54mm 8 pines', uom: 'EA', category: 'Conector', standardCost: 0.15, abcClass: 'B', recvQty: 8000 },
  { partNumber: 'CONN-USB-C', description: 'Conector USB-C SMD', uom: 'EA', category: 'Conector', standardCost: 0.42, abcClass: 'B', recvQty: 4000 },
  { partNumber: 'CONN-RJ45-MAG', description: 'Conector RJ45 con magnetics', uom: 'EA', category: 'Conector', standardCost: 0.89, abcClass: 'A', recvQty: 2000 },
  { partNumber: 'CONN-JST-PH-2', description: 'Conector JST-PH 2 pines paso 2.0mm', uom: 'EA', category: 'Conector', standardCost: 0.09, abcClass: 'C', recvQty: 8000 },
  { partNumber: 'CONN-B2B-20', description: 'Conector board-to-board 20 pines 0.5mm', uom: 'EA', category: 'Conector', standardCost: 0.55, abcClass: 'B', recvQty: 3000 },
  { partNumber: 'TERM-2P-508', description: 'Bloque terminal 2 pines paso 5.08mm', uom: 'EA', category: 'Conector', standardCost: 0.21, abcClass: 'C', recvQty: 5000 },
  { partNumber: 'HDR-TEST-04', description: 'Header de prueba 4 pines', uom: 'EA', category: 'Conector', standardCost: 0.08, abcClass: 'C', recvQty: 6000 },
  // ── Mecánica / térmico / etiquetado / carcasa ──
  { partNumber: 'SCR-M3-8', description: 'Tornillo M3x8 acero inoxidable', uom: 'EA', category: 'Tornillería', standardCost: 0.015, abcClass: 'C', recvQty: 20000 },
  { partNumber: 'SCR-M2-6', description: 'Tornillo M2x6 acero inoxidable', uom: 'EA', category: 'Tornillería', standardCost: 0.012, abcClass: 'C', recvQty: 20000 },
  { partNumber: 'NUT-M3-HEX', description: 'Tuerca hexagonal M3 acero', uom: 'EA', category: 'Tornillería', standardCost: 0.01, abcClass: 'C', recvQty: 20000 },
  { partNumber: 'WASH-M3-FLAT', description: 'Arandela plana M3 acero', uom: 'EA', category: 'Tornillería', standardCost: 0.008, abcClass: 'C', recvQty: 20000 },
  { partNumber: 'STANDOFF-M3', description: 'Separador M3 nylon', uom: 'EA', category: 'Tornillería', standardCost: 0.04, abcClass: 'C', recvQty: 12000 },
  { partNumber: 'THM-PAD-1MM', description: 'Almohadilla térmica 1mm 20x20', uom: 'EA', category: 'Térmico', standardCost: 0.18, abcClass: 'C', recvQty: 5000 },
  { partNumber: 'HS-TO220-CLIP', description: 'Disipador con clip TO-220', uom: 'EA', category: 'Térmico', standardCost: 0.28, abcClass: 'B', recvQty: 4000 },
  { partNumber: 'LABEL-QR-AX', description: 'Etiqueta QR de trazabilidad', uom: 'EA', category: 'Etiqueta', standardCost: 0.03, abcClass: 'C', recvQty: 15000 },
  { partNumber: 'ENC-AX-ALU', description: 'Carcasa de aluminio extruido genérica', uom: 'EA', category: 'Carcasa', standardCost: 3.2, abcClass: 'A', recvQty: 800 },
  { partNumber: 'ENC-GASKET-IP65', description: 'Empaque sellador IP65 genérico', uom: 'EA', category: 'Carcasa', standardCost: 0.42, abcClass: 'C', recvQty: 3000 },
];

export const DEMO_PARTS: DemoPart[] = RAW_PARTS.map((p) => ({ ...p, avl: buildAvl(p) }));

export const DEMO_PART_NUMBERS: string[] = DEMO_PARTS.map((p) => p.partNumber);

// ─────────────────────────────────────────────────────────────────────────────
// Proveedores ficticios (Supplier) + precios (ErpSupplierPrice) — para que
// compras / requisiciones / sourcing se vean vivos. Nombres FICTICIOS (no
// clientes Axos; se validan como texto de dominio público, no como customer).
// ─────────────────────────────────────────────────────────────────────────────
export interface DemoSupplier {
  code: string;
  name: string;
  country: string;
  qualityScore: number;
}

export const DEMO_SUPPLIERS: DemoSupplier[] = [
  { code: 'AX-SUP-FERRUM', name: 'Ferrum Passives', country: 'México', qualityScore: 98 },
  { code: 'AX-SUP-VOLTAIC', name: 'Voltaic Components', country: 'México', qualityScore: 97 },
  { code: 'AX-SUP-NORVEL', name: 'Norvel Semiconductors', country: 'Estados Unidos', qualityScore: 95 },
  { code: 'AX-SUP-AXON', name: 'Axon Microelectronics', country: 'Estados Unidos', qualityScore: 96 },
  { code: 'AX-SUP-COBALT', name: 'Cobalt Connectors', country: 'Alemania', qualityScore: 94 },
  { code: 'AX-SUP-KESTREL', name: 'Kestrel Magnetics', country: 'Japón', qualityScore: 93 },
  { code: 'AX-SUP-QUARTZON', name: 'Quartzon Timing', country: 'Japón', qualityScore: 95 },
  { code: 'AX-SUP-LUMINA', name: 'Lumina Optoelectronics', country: 'Corea del Sur', qualityScore: 94 },
  { code: 'AX-SUP-SENTINEL', name: 'Sentinel Sensors', country: 'Estados Unidos', qualityScore: 96 },
  { code: 'AX-SUP-GRANITE', name: 'Granite Hardware', country: 'México', qualityScore: 99 },
  { code: 'AX-SUP-STRATA', name: 'Strataboard Fab', country: 'México', qualityScore: 97 },
  { code: 'AX-SUP-ORION', name: 'Orion Global Distribution', country: 'Singapur', qualityScore: 92 },
];

export const DEMO_SUPPLIER_CODES: string[] = DEMO_SUPPLIERS.map((s) => s.code);

export interface DemoSupplierPrice {
  partNumber: string;
  supplierCode: string;
  unitPrice: number;
  currency: string;
  moq: number;
  leadTimeDays: number;
  preferred: boolean;
}

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;
const SUPPLIER_BY_MFG = new Map(DEMO_SUPPLIERS.map((s) => [s.name, s.code]));
const ALT_SUPPLIER = 'AX-SUP-ORION'; // distribuidor alterno (segunda fuente)

/**
 * Construye precios de proveedor por parte: una fuente PREFERIDA (el fabricante
 * del AVL, con markup ~18%) y, para partes A, una segunda fuente (distribuidor
 * Orion, markup ~32%, mayor lead time). MOQ/lead time por clase ABC.
 */
function buildSupplierPrices(): DemoSupplierPrice[] {
  const moqByAbc = { A: 500, B: 2000, C: 10000 } as const;
  const leadByAbc = { A: 21, B: 14, C: 7 } as const;
  const prices: DemoSupplierPrice[] = [];
  for (const part of DEMO_PARTS) {
    const preferredCode = SUPPLIER_BY_MFG.get(part.avl[0]?.manufacturer ?? '') ?? ALT_SUPPLIER;
    prices.push({
      partNumber: part.partNumber,
      supplierCode: preferredCode,
      unitPrice: round6(Math.max(part.standardCost * 1.18, 0.001)),
      currency: 'USD',
      moq: moqByAbc[part.abcClass],
      leadTimeDays: leadByAbc[part.abcClass],
      preferred: true,
    });
    if (part.abcClass === 'A' && preferredCode !== ALT_SUPPLIER) {
      prices.push({
        partNumber: part.partNumber,
        supplierCode: ALT_SUPPLIER,
        unitPrice: round6(Math.max(part.standardCost * 1.32, 0.001)),
        currency: 'USD',
        moq: moqByAbc[part.abcClass],
        leadTimeDays: leadByAbc[part.abcClass] + 7,
        preferred: false,
      });
    }
  }
  return prices;
}

export const DEMO_SUPPLIER_PRICES: DemoSupplierPrice[] = buildSupplierPrices();

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
  part: string; // debe existir en DEMO_PARTS o DEMO_SUBASSEMBLIES
  qty: number; // cantidad por unidad terminada
  ref?: string; // designadores de referencia
  level?: number; // 2 = referencia a sub-ensamble (se explota en su propio BOM); hoja = default
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

// ─────────────────────────────────────────────────────────────────────────────
// Sub-ensambles intermedios (buildables) para BOMs MULTINIVEL. Se registran como
// materiales (para validar componentes) con costo = rollup de su BOM, y tienen su
// PROPIO BOM. ORDEN: los más profundos primero (su costo se usa aguas arriba).
// ─────────────────────────────────────────────────────────────────────────────
export interface DemoSubAssembly {
  partNumber: string;
  name: string;
  description: string;
  category: string;
  abcClass: 'A' | 'B' | 'C';
  recvQty: number;
  bom: DemoBomLine[];
}

const RAW_SUBASSEMBLIES: DemoSubAssembly[] = [
  // Nivel más profundo: sub-módulo de potencia (usado dentro del PCBA-500).
  {
    partNumber: 'AX-PWRSTAGE-500',
    name: 'Sub-módulo Etapa de Potencia Trifásica',
    description: 'Etapa de potencia (3 medios puentes) para controlador de motor (universo demo AXOS).',
    category: 'Sub-módulo',
    abcClass: 'A',
    recvQty: 300,
    bom: [
      { part: 'MOS-NCH-60V', qty: 6, ref: 'Q1-Q6' },
      { part: 'IC-GATE-DRV', qty: 3, ref: 'U1-U3' },
      { part: 'DIO-SCH-40V', qty: 6, ref: 'D1-D6' },
      { part: 'RES-SHUNT-5M', qty: 3, ref: 'RS1-RS3' },
      { part: 'CAP-10U-0805', qty: 6, ref: 'C1-C6' },
      { part: 'CAP-100N-0603', qty: 6, ref: 'C7-C12' },
    ],
  },
  // PCBAs (uno por modelo nuevo).
  {
    partNumber: 'AX-PCBA-500',
    name: 'PCBA Controlador de Motor',
    description: 'Tarjeta ensamblada del controlador de motor (universo demo AXOS).',
    category: 'Sub-ensamble PCBA',
    abcClass: 'A',
    recvQty: 400,
    bom: [
      { part: 'PCB-AX500-6L', qty: 1, ref: 'PCB1' },
      { part: 'AX-PWRSTAGE-500', qty: 1, ref: 'ASSY-PWR', level: 2 },
      { part: 'IC-MCU-32B-LQFP64', qty: 1, ref: 'U10' },
      { part: 'IC-CURR-SENSE', qty: 3, ref: 'U11-U13' },
      { part: 'IC-LDO-3V3', qty: 1, ref: 'U14' },
      { part: 'CAP-10U-0805', qty: 8, ref: 'C20-C27' },
      { part: 'CAP-1U-0402', qty: 10, ref: 'C28-C37' },
      { part: 'RES-10K-0402', qty: 12, ref: 'R1-R12' },
      { part: 'CRYSTAL-16M', qty: 1, ref: 'Y1' },
      { part: 'CONN-2540-08', qty: 2, ref: 'J1-J2' },
    ],
  },
  {
    partNumber: 'AX-PCBA-600',
    name: 'PCBA Gateway Industrial',
    description: 'Tarjeta ensamblada del gateway industrial Ethernet/RS-485 (universo demo AXOS).',
    category: 'Sub-ensamble PCBA',
    abcClass: 'A',
    recvQty: 400,
    bom: [
      { part: 'PCB-AX600-4L', qty: 1, ref: 'PCB1' },
      { part: 'IC-MCU-32B-LQFP64', qty: 1, ref: 'U1' },
      { part: 'IC-ETH-PHY', qty: 1, ref: 'U2' },
      { part: 'IC-XCVR-485', qty: 1, ref: 'U3' },
      { part: 'IC-EEPROM-256K', qty: 1, ref: 'U4' },
      { part: 'IC-LDO-3V3', qty: 1, ref: 'U5' },
      { part: 'CONN-RJ45-MAG', qty: 1, ref: 'J1' },
      { part: 'CONN-USB-C', qty: 1, ref: 'J2' },
      { part: 'OSC-25M-CMOS', qty: 1, ref: 'Y1' },
      { part: 'CAP-100N-0603', qty: 12, ref: 'C1-C12' },
      { part: 'CAP-10U-0805', qty: 3, ref: 'C13-C15' },
      { part: 'RES-10K-0402', qty: 8, ref: 'R1-R8' },
      { part: 'RES-4K7-0603', qty: 4, ref: 'R9-R12' },
      { part: 'LED-GRN-0603', qty: 2, ref: 'D1-D2' },
      { part: 'LED-RED-0603', qty: 1, ref: 'D3' },
    ],
  },
  {
    partNumber: 'AX-PCBA-700',
    name: 'PCBA Medidor de Energía',
    description: 'Tarjeta ensamblada del medidor de energía multicanal (universo demo AXOS).',
    category: 'Sub-ensamble PCBA',
    abcClass: 'A',
    recvQty: 400,
    bom: [
      { part: 'PCB-AX700-4L', qty: 1, ref: 'PCB1' },
      { part: 'IC-MCU-32B', qty: 1, ref: 'U1' },
      { part: 'IC-ADC-12B', qty: 2, ref: 'U2-U3' },
      { part: 'IC-CURR-SENSE', qty: 3, ref: 'U4-U6' },
      { part: 'IC-VREF-2V5', qty: 1, ref: 'U7' },
      { part: 'IC-OPAMP-DUAL', qty: 2, ref: 'U8-U9' },
      { part: 'IC-RTC-I2C', qty: 1, ref: 'U10' },
      { part: 'IC-LDO-3V3', qty: 1, ref: 'U11' },
      { part: 'CRYSTAL-32K768', qty: 1, ref: 'Y1' },
      { part: 'RES-SHUNT-5M', qty: 3, ref: 'RS1-RS3' },
      { part: 'CAP-100N-0603', qty: 10, ref: 'C1-C10' },
      { part: 'CAP-1U-0402', qty: 4, ref: 'C11-C14' },
      { part: 'RES-10K-0402', qty: 12, ref: 'R1-R12' },
      { part: 'CONN-2540-08', qty: 2, ref: 'J1-J2' },
    ],
  },
  {
    partNumber: 'AX-PCBA-800',
    name: 'PCBA Nodo de Sensores',
    description: 'Tarjeta ensamblada del nodo de sensores IoT (universo demo AXOS).',
    category: 'Sub-ensamble PCBA',
    abcClass: 'A',
    recvQty: 400,
    bom: [
      { part: 'PCB-AX800-2L', qty: 1, ref: 'PCB1' },
      { part: 'IC-MCU-32B', qty: 1, ref: 'U1' },
      { part: 'IC-ACCEL-3AX', qty: 1, ref: 'U2' },
      { part: 'IC-PRESS-SENSE', qty: 1, ref: 'U3' },
      { part: 'IC-SENSOR-TEMP', qty: 2, ref: 'U4-U5' },
      { part: 'IC-LDO-3V3', qty: 1, ref: 'U6' },
      { part: 'CAP-100N-0603', qty: 8, ref: 'C1-C8' },
      { part: 'CAP-1U-0402', qty: 3, ref: 'C9-C11' },
      { part: 'RES-10K-0402', qty: 6, ref: 'R1-R6' },
      { part: 'LED-RGB-PLCC', qty: 1, ref: 'D1' },
      { part: 'CONN-JST-PH-2', qty: 2, ref: 'J1-J2' },
      { part: 'CONN-USB-C', qty: 1, ref: 'J3' },
      { part: 'HDR-TEST-04', qty: 1, ref: 'TP1' },
    ],
  },
];

const PART_COST = new Map(DEMO_PARTS.map((p) => [p.partNumber, p.standardCost]));

/** Rollup de costo de un BOM (resuelve sub-ensambles por su costo ya calculado). */
function rollupCost(bom: DemoBomLine[], subCost: Map<string, number>): number {
  let c = 0;
  for (const l of bom) c += l.qty * (subCost.get(l.part) ?? PART_COST.get(l.part) ?? 0);
  return round6(c);
}

const SUBASM_COST = new Map<string, number>();
for (const sa of RAW_SUBASSEMBLIES) SUBASM_COST.set(sa.partNumber, rollupCost(sa.bom, SUBASM_COST));

export const DEMO_SUBASSEMBLIES: DemoSubAssembly[] = RAW_SUBASSEMBLIES;
export const DEMO_SUBASSEMBLY_NUMBERS: string[] = RAW_SUBASSEMBLIES.map((s) => s.partNumber);

/** Sub-ensambles como "partes" (material_master) — para validar componentes + costo rollup. */
export const DEMO_SUBASSEMBLY_PARTS: DemoPart[] = RAW_SUBASSEMBLIES.map((s) => ({
  partNumber: s.partNumber,
  description: s.description,
  uom: 'EA',
  category: s.category,
  standardCost: SUBASM_COST.get(s.partNumber) ?? 0,
  abcClass: s.abcClass,
  recvQty: s.recvQty,
  avl: [{ manufacturer: 'Axos Manufacturing', mpn: s.partNumber }],
}));

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
  // ── Modelos con BOM MULTINIVEL (ensamble final → PCBA → [sub-módulo]) ──
  {
    modelNumber: 'AX-MOTOR-500',
    name: 'Controlador de Motor Trifásico',
    customer: 'Axos Mobility',
    programCode: 'AX-MOBILITY-P',
    revision: 'A',
    description: 'Controlador de motor trifásico con etapa de potencia (3 niveles: sub-módulo→PCBA→final; universo demo AXOS).',
    bom: [
      { part: 'AX-PCBA-500', qty: 1, ref: 'ASSY1', level: 2 },
      { part: 'ENC-AX-ALU', qty: 1, ref: 'ENC1' },
      { part: 'HS-TO220-CLIP', qty: 2, ref: 'HS1-HS2' },
      { part: 'THM-PAD-1MM', qty: 2, ref: 'TH1-TH2' },
      { part: 'SCR-M3-8', qty: 6, ref: 'HW1-HW6' },
      { part: 'LABEL-QR-AX', qty: 1, ref: 'LBL1' },
    ],
  },
  {
    modelNumber: 'AX-GATE-600',
    name: 'Gateway Industrial',
    customer: 'Axos Aero',
    programCode: 'AX-AERO-P',
    revision: 'A',
    description: 'Gateway industrial Ethernet/RS-485 (ensamble final → PCBA; universo demo AXOS).',
    bom: [
      { part: 'AX-PCBA-600', qty: 1, ref: 'ASSY1', level: 2 },
      { part: 'ENC-AX-ALU', qty: 1, ref: 'ENC1' },
      { part: 'STANDOFF-M3', qty: 4, ref: 'HW1-HW4' },
      { part: 'SCR-M3-8', qty: 4, ref: 'HW5-HW8' },
      { part: 'LABEL-QR-AX', qty: 1, ref: 'LBL1' },
    ],
  },
  {
    modelNumber: 'AX-METER-700',
    name: 'Medidor de Energía Trifásico',
    customer: 'Axos Power',
    programCode: 'AX-POWER-P',
    revision: 'B',
    description: 'Medidor de energía multicanal con RTC (ensamble final → PCBA; universo demo AXOS).',
    bom: [
      { part: 'AX-PCBA-700', qty: 1, ref: 'ASSY1', level: 2 },
      { part: 'ENC-GASKET-IP65', qty: 1, ref: 'ENC1' },
      { part: 'SCR-M2-6', qty: 4, ref: 'HW1-HW4' },
      { part: 'LABEL-QR-AX', qty: 1, ref: 'LBL1' },
    ],
  },
  {
    modelNumber: 'AX-NODE-800',
    name: 'Nodo de Sensores IoT',
    customer: 'Axos Medical',
    programCode: 'AX-MEDICAL-P',
    revision: 'A',
    description: 'Nodo de sensores IoT (acelerómetro/presión/temp) (ensamble final → PCBA; universo demo AXOS).',
    bom: [
      { part: 'AX-PCBA-800', qty: 1, ref: 'ASSY1', level: 2 },
      { part: 'ENC-GASKET-IP65', qty: 1, ref: 'ENC1' },
      { part: 'SCR-M2-6', qty: 4, ref: 'HW1-HW4' },
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

// ─────────────────────────────────────────────────────────────────────────────
// Piso de producción (shop floor): WOs `sf_work_orders` en distintos estados +
// historia simulada (avances, holds de calidad, paros/downtime). Da QUÉ mostrar a
// planeación/operador/almacén y datos para decision-intelligence (OEE/adherencia).
// ─────────────────────────────────────────────────────────────────────────────
export type SfState = 'RELEASED' | 'STAGED' | 'IN_EXECUTION' | 'COMPLETED';

export interface DemoSfWorkOrder {
  ref: string; // marcador idempotente (va en notes via SF_WO_NOTE)
  model: string;
  line: string;
  quantityPlanned: number;
  customer: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  taktTargetSec: number;
  state: SfState;
  completed?: number; // unidades avanzadas (IN_EXECUTION); COMPLETED usa quantityPlanned
  faiRequired?: boolean;
}

export const DEMO_SF_WORK_ORDERS: DemoSfWorkOrder[] = [
  { ref: 'D100-A', model: 'AX-DRIVE-100', line: 'L1', quantityPlanned: 50, customer: 'Axos Mobility', priority: 'HIGH', taktTargetSec: 95, state: 'COMPLETED' },
  { ref: 'D100-B', model: 'AX-DRIVE-100', line: 'L1', quantityPlanned: 120, customer: 'Axos Mobility', priority: 'MEDIUM', taktTargetSec: 95, state: 'IN_EXECUTION', completed: 45 },
  { ref: 'P200-A', model: 'AX-POWER-200', line: 'L2', quantityPlanned: 30, customer: 'Axos Power', priority: 'URGENT', taktTargetSec: 120, state: 'IN_EXECUTION', completed: 12 },
  { ref: 'P200-B', model: 'AX-POWER-200', line: 'L2', quantityPlanned: 75, customer: 'Axos Power', priority: 'MEDIUM', taktTargetSec: 120, state: 'STAGED' },
  { ref: 'S300-A', model: 'AX-SENSE-300', line: 'L5', quantityPlanned: 200, customer: 'Axos Medical', priority: 'MEDIUM', taktTargetSec: 60, state: 'COMPLETED' },
  { ref: 'C400-A', model: 'AX-COMM-400', line: 'L7', quantityPlanned: 40, customer: 'Axos Aero', priority: 'MEDIUM', taktTargetSec: 110, state: 'RELEASED' },
  { ref: 'M500-A', model: 'AX-MOTOR-500', line: 'L3', quantityPlanned: 25, customer: 'Axos Mobility', priority: 'HIGH', taktTargetSec: 150, state: 'IN_EXECUTION', completed: 8, faiRequired: true },
  { ref: 'G600-A', model: 'AX-GATE-600', line: 'L4', quantityPlanned: 60, customer: 'Axos Aero', priority: 'MEDIUM', taktTargetSec: 100, state: 'STAGED' },
  { ref: 'E700-A', model: 'AX-METER-700', line: 'L6', quantityPlanned: 100, customer: 'Axos Power', priority: 'LOW', taktTargetSec: 80, state: 'RELEASED' },
  { ref: 'N800-A', model: 'AX-NODE-800', line: 'L8', quantityPlanned: 150, customer: 'Axos Medical', priority: 'MEDIUM', taktTargetSec: 70, state: 'IN_EXECUTION', completed: 60 },
];

export interface DemoSfHold {
  woRef: string; // liga a DEMO_SF_WORK_ORDERS.ref
  part: string;
  qty: number;
  defectType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export const DEMO_SF_HOLDS: DemoSfHold[] = [
  { woRef: 'D100-B', part: 'PCB-AX100-4L', qty: 5, defectType: 'Soldadura insuficiente en QFP', severity: 'HIGH' },
  { woRef: 'M500-A', part: 'AX-PCBA-500', qty: 2, defectType: 'Falla en prueba funcional de potencia', severity: 'CRITICAL' },
];

export interface DemoSfDowntime {
  line: string;
  reasonCode: 'EQUIPMENT' | 'MATERIAL' | 'QUALITY' | 'CHANGEOVER' | 'NO_OPERATOR' | 'OTHER';
  note: string;
  startMinAgo: number; // inicio = ahora − startMinAgo (minutos)
  durationMin: number; // > 0 → cerrado con esa duración; 0 → queda OPEN
}

export const DEMO_SF_DOWNTIME: DemoSfDowntime[] = [
  { line: 'L1', reasonCode: 'EQUIPMENT', note: 'Cambio de boquilla en SMT', startMinAgo: 200, durationMin: 25 },
  { line: 'L2', reasonCode: 'MATERIAL', note: 'Espera de componente surtido', startMinAgo: 150, durationMin: 18 },
  { line: 'L3', reasonCode: 'CHANGEOVER', note: 'Cambio de modelo (SMED)', startMinAgo: 110, durationMin: 32 },
  { line: 'L7', reasonCode: 'NO_OPERATOR', note: 'Falta de operador certificado', startMinAgo: 75, durationMin: 20 },
  { line: 'L5', reasonCode: 'EQUIPMENT', note: 'Mantenimiento no programado en horno', startMinAgo: 40, durationMin: 0 },
];

/** Marcadores idempotentes / de borrado para los datos de piso. */
export const SF_WO_NOTE = (ref: string): string => `AX-SEED-WO:${ref}`;
export const SF_HOLD_LOT = (ref: string): string => `AX-SEED-H:${ref}`;
export const SF_DOWNTIME_PREFIX = 'AX-SEED ·';

/** Igual que EnterpriseCampusService.slug — para predecir ids de cliente/programa. */
export function slugCode(code: string): string {
  return code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// RUTEO / LAYOUT POR ESTACIÓN (sustrato de piso de producción).
//
// Pieza maestra del paso: por cada modelo AX se define una RUTA de estaciones
// (sequence, NP esperado tomado del BOM REAL del modelo, factor de uso = qty/u,
// tiempo estándar para balanceo, CTQ, feeder y ayuda visual). De este ÚNICO
// catálogo cuelgan, de forma consistente:
//   • SfLineStation  (line-engineering, revisión 'A')  → stationRequirements()
//                      → surtido / Material Staging (C) y Operador (D).
//   • ProcessStep + ProcessStepMaterial (process-routing, revisión '1.0')
//                      → lo que mes-execution explota en pasos reales.
//   • VisualAid      (una por modelo+estación)          → enlazada desde el ruteo.
//   • BayLayout      (colocación NP→bahía con stock mín).
//
// 100% universo AXOS: todos los NP provienen del BOM del modelo (DEMO_MODELS),
// sin prefijo OP- ni marcas reales (pasa assertDatabasePublicDomain).
// ─────────────────────────────────────────────────────────────────────────────

/** Revisión del ruteo de ingeniería (SfLineStation). Igual al default de
 *  SfWorkOrder.revision ('A') para que stationRequirements(model,'A') case el
 *  surtido de la WO de piso. */
export const DEMO_ROUTING_REVISION = 'A';

/** Revisión de la ruta de proceso (ProcessStep) que explota mes-execution. */
export const DEMO_PROCESS_REVISION = '1.0';

/** Tipos de estación (mes_execution_steps.stationType / process_steps.stationType). */
export type DemoStationType = 'smt' | 'assembly' | 'inspection' | 'test' | 'packing';

export interface DemoRoutingStation {
  sequence: number;
  station: string; // código corto (≤32), p. ej. 'EST-10'
  name: string; // nombre legible del paso
  stationType: DemoStationType;
  npExpected: string; // NP REAL del BOM del modelo (poka-yoke)
  useFactor: number; // qty por unidad terminada (= línea de BOM) → backflush
  stdTimeSec: number; // tiempo estándar (≤ takt) para balanceo
  ctq: boolean; // característica crítica de calidad
  feederPosition: string; // p. ej. 'F-01'
  bahia: number; // 1–6 (BayLayout)
  minStock: number; // punto de reorden manual (BayLayout)
  visualAidId: string; // VisualAid.id
  visualAidFile: string; // VisualAid.pdfUrl / filename (placeholder de dominio público)
  visualAidUrl: string; // SfLineStation.visualAidUrl (ruta servida) — enlace al asset
  visualAidTitle: string;
}

export interface DemoRouting {
  model: string;
  line: string;
  programId: string;
  stations: DemoRoutingStation[];
}

/**
 * Arquetipos de estación (hasta 6) usados para armar una ruta plausible sobre el
 * BOM real de cada modelo. `taktRatio` escala el tiempo estándar contra el takt
 * del modelo (estaciones siempre por debajo del takt → balanceo realista).
 * Nombres neutrales que sirven tanto a una línea SMT como a un box-build.
 */
const STATION_ARCHETYPES: ReadonlyArray<{
  station: string;
  name: string;
  stationType: DemoStationType;
  ctq: boolean;
  taktRatio: number;
}> = [
  { station: 'EST-10', name: 'Preparación y carga de tarjeta', stationType: 'smt', ctq: false, taktRatio: 0.35 },
  { station: 'EST-20', name: 'Colocación de componentes clave', stationType: 'smt', ctq: true, taktRatio: 0.62 },
  { station: 'EST-30', name: 'Integración de subensamble', stationType: 'assembly', ctq: false, taktRatio: 0.52 },
  { station: 'EST-40', name: 'Inspección de calidad (AOI/visual)', stationType: 'inspection', ctq: true, taktRatio: 0.44 },
  { station: 'EST-50', name: 'Ensamble final y fijación', stationType: 'assembly', ctq: false, taktRatio: 0.66 },
  { station: 'EST-60', name: 'Prueba funcional y etiquetado', stationType: 'test', ctq: false, taktRatio: 0.50 },
];

/** Identidad determinística de la ayuda visual de un modelo+estación. */
export const VISUAL_AID_ID = (model: string, station: string): string => `AX-VA-${model}-${station}`;
export const VISUAL_AID_FILE = (model: string, station: string): string =>
  `${model.toLowerCase()}-${station.toLowerCase()}.pdf`;
/** Ruta servida por VisualAidsController (GET /visual-aids/file/:filename). */
export const VISUAL_AID_URL = (model: string, station: string): string =>
  `/visual-aids/file/${VISUAL_AID_FILE(model, station)}`;

/** Primer WO de piso por modelo → presta línea y takt al ruteo (mismos de DEMO_SF_WORK_ORDERS). */
const sfWoByModel = new Map<string, DemoSfWorkOrder>();
for (const w of DEMO_SF_WORK_ORDERS) if (!sfWoByModel.has(w.model)) sfWoByModel.set(w.model, w);
const programByModelCode = new Map(DEMO_MODELS.map((m) => [m.modelNumber, slugCode(m.programCode)]));

function buildRouting(model: DemoModel): DemoRouting {
  const sfwo = sfWoByModel.get(model.modelNumber);
  const line = sfwo?.line ?? 'L1';
  const takt = sfwo?.taktTargetSec ?? 90;
  // Hasta 6 estaciones, una por línea de BOM (parte REAL del modelo).
  const count = Math.min(STATION_ARCHETYPES.length, model.bom.length);
  const stations: DemoRoutingStation[] = [];
  for (let i = 0; i < count; i++) {
    const arch = STATION_ARCHETYPES[i];
    const line0 = model.bom[i];
    const useFactor = line0.qty;
    stations.push({
      sequence: (i + 1) * 10,
      station: arch.station,
      name: arch.name,
      stationType: arch.stationType,
      npExpected: line0.part,
      useFactor,
      stdTimeSec: Math.max(15, Math.round(takt * arch.taktRatio)),
      ctq: arch.ctq,
      feederPosition: `F-${String(i + 1).padStart(2, '0')}`,
      bahia: i + 1, // 1–6
      minStock: Math.max(10, Math.ceil(useFactor * 6)),
      visualAidId: VISUAL_AID_ID(model.modelNumber, arch.station),
      visualAidFile: VISUAL_AID_FILE(model.modelNumber, arch.station),
      visualAidUrl: VISUAL_AID_URL(model.modelNumber, arch.station),
      visualAidTitle: `Ayuda visual ${arch.station} — ${arch.name}`,
    });
  }
  return {
    model: model.modelNumber,
    line,
    programId: programByModelCode.get(model.modelNumber) ?? '',
    stations,
  };
}

/** Ruteo por modelo AX (keystone). Derivado del BOM real → NP siempre válido. */
export const DEMO_ROUTINGS: DemoRouting[] = DEMO_MODELS.map(buildRouting);

/** Planes AX publicados que se abren en mes-execution (≥1 con paso in_process). */
export const DEMO_MES_WORK_ORDERS: string[] = DEMO_PLANS.filter((p) => p.publish).map((p) => p.workOrder);

/** Unidades a "caminar" en la 1ª estación para dejarla in_process (operador con WO viva). */
export const DEMO_MES_WALK_UNITS = 8;

/** Token idempotente del avance de operador sembrado (mes_execution_events.clientRequestId). */
export const MES_SEED_CRID = (workOrder: string): string => `AX-SEED-MES:${workOrder}:S1`;
