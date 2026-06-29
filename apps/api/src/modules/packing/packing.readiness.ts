import type { UnitFlow } from '../test-flow/entities/unit-flow.entity';
import type { HandlingUnit } from './entities/handling-unit.entity';
import type { HandlingUnitStatus } from './packing.rules';

export interface PackedSerialInfo {
  serial: string;
  handlingUnitId: string;
  sscc: string | null;
  shipmentId: string | null;
  shipmentFolio: string | null;
  status: HandlingUnitStatus;
}

export interface PackingReadinessFilters {
  shipmentId?: string;
  workOrder?: string;
  model?: string;
  serial?: string;
}

export type PackingReadinessStatus =
  | 'AVAILABLE'
  | 'PACKED'
  | 'AWAITING_TEST'
  | 'BLOCKED';

export interface PackingReadinessUnit {
  serialNumber: string;
  workOrder: string | null;
  model: string | null;
  stage: UnitFlow['stage'];
  testResult: UnitFlow['testResult'];
  destination: UnitFlow['destination'];
  status: PackingReadinessStatus;
  packedIn: PackedSerialInfo | null;
}

export interface PackingReadiness {
  filters: PackingReadinessFilters;
  totals: {
    totalSerials: number;
    readyForPacking: number;
    available: number;
    packed: number;
    awaitingTest: number;
    blocked: number;
  };
  availableSerials: string[];
  units: PackingReadinessUnit[];
}

export function normalizeSerial(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

export function serialsFromContents(
  contents: HandlingUnit['contents'],
): string[] {
  return (contents ?? [])
    .flatMap((line) => line.serials ?? [])
    .map((serial) => String(serial).trim())
    .filter(Boolean);
}

export function duplicateSerials(serials: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const serial of serials) {
    const key = normalizeSerial(serial);
    if (!key) continue;
    if (seen.has(key)) dupes.add(serial);
    seen.add(key);
  }
  return [...dupes];
}

export function serialQuantityMismatches(
  contents: HandlingUnit['contents'],
): string[] {
  return (contents ?? [])
    .filter((line) => {
      const serialCount = serialsFromContents([line]).length;
      return serialCount > 0 && serialCount !== Number(line.quantity);
    })
    .map(
      (line) =>
        `${line.partNumber}: cantidad ${line.quantity}, seriales ${
          serialsFromContents([line]).length
        }`,
    );
}

export function buildPackedSerialIndex(
  handlingUnits: HandlingUnit[],
  excludeHandlingUnitId?: string,
): Map<string, PackedSerialInfo> {
  const index = new Map<string, PackedSerialInfo>();
  for (const unit of handlingUnits) {
    if (excludeHandlingUnitId && unit.id === excludeHandlingUnitId) continue;
    for (const serial of serialsFromContents(unit.contents)) {
      const key = normalizeSerial(serial);
      if (!key || index.has(key)) continue;
      index.set(key, {
        serial,
        handlingUnitId: unit.id,
        sscc: unit.sscc,
        shipmentId: unit.shipmentId,
        shipmentFolio: unit.shipmentFolio,
        status: unit.status,
      });
    }
  }
  return index;
}

export function isReadyForPacking(unit: UnitFlow | undefined | null): boolean {
  return (
    !!unit &&
    unit.stage === 'READY_FOR_PACKAGING' &&
    unit.testResult === 'PASS' &&
    unit.destination === 'PACKAGING'
  );
}

export function buildPackingReadiness(
  units: UnitFlow[],
  packedSerials: Map<string, PackedSerialInfo>,
  filters: PackingReadinessFilters = {},
): PackingReadiness {
  const needle = {
    workOrder: filters.workOrder?.trim().toLowerCase(),
    model: filters.model?.trim().toLowerCase(),
    serial: filters.serial?.trim().toLowerCase(),
  };

  const matches = (value: string | null | undefined, filter?: string) =>
    !filter || String(value ?? '').toLowerCase().includes(filter);

  const filtered = units.filter(
    (unit) =>
      matches(unit.workOrder, needle.workOrder) &&
      matches(unit.model, needle.model) &&
      matches(unit.serialNumber, needle.serial),
  );

  const shipmentId = filters.shipmentId?.trim();
  const readinessUnits: PackingReadinessUnit[] = filtered
    .map((unit) => {
      const packedIn = packedSerials.get(normalizeSerial(unit.serialNumber)) ?? null;
      const status: PackingReadinessStatus = packedIn
        ? 'PACKED'
        : isReadyForPacking(unit)
          ? 'AVAILABLE'
          : unit.stage === 'AWAITING_TEST'
            ? 'AWAITING_TEST'
            : 'BLOCKED';
      return {
        serialNumber: unit.serialNumber,
        workOrder: unit.workOrder,
        model: unit.model,
        stage: unit.stage,
        testResult: unit.testResult,
        destination: unit.destination,
        status,
        packedIn,
      };
    })
    .filter(
      (unit) =>
        !shipmentId ||
        unit.status === 'AVAILABLE' ||
        unit.packedIn?.shipmentId === shipmentId,
    )
    .sort((a, b) => {
      const rank: Record<PackingReadinessStatus, number> = {
        AVAILABLE: 0,
        PACKED: 1,
        AWAITING_TEST: 2,
        BLOCKED: 3,
      };
      return (
        rank[a.status] - rank[b.status] ||
        a.serialNumber.localeCompare(b.serialNumber)
      );
    });

  const count = (status: PackingReadinessStatus) =>
    readinessUnits.filter((unit) => unit.status === status).length;

  return {
    filters,
    totals: {
      totalSerials: readinessUnits.length,
      readyForPacking: readinessUnits.filter(
        (unit) => unit.status === 'AVAILABLE' || unit.status === 'PACKED',
      ).length,
      available: count('AVAILABLE'),
      packed: count('PACKED'),
      awaitingTest: count('AWAITING_TEST'),
      blocked: count('BLOCKED'),
    },
    availableSerials: readinessUnits
      .filter((unit) => unit.status === 'AVAILABLE')
      .map((unit) => unit.serialNumber),
    units: readinessUnits,
  };
}
