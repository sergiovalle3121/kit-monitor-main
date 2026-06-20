// ─────────────────────────────────────────────────────────────────────────────
// Scan-verified dock loading (Carga verificada) — pure, side-effect-free logic.
//
// At the dock the warehouse operator scans each handling unit's SSCC against the
// shipment it is being loaded onto. We mark matched units LOADED and block the
// shipment from advancing to READY until every assigned unit is verified — the
// hard poka-yoke against loading the wrong material onto the truck.
//
// Pure like packing.rules / packing.sscc / shipment-state so the decision logic is
// unit-tested without a database; the service does the IO and persists LOADED.
// ─────────────────────────────────────────────────────────────────────────────
import type { HandlingUnitStatus } from './packing.rules';

/** Minimal shape of a handling unit the loading logic needs. */
export interface LoadingUnitLike {
  id: string;
  sscc: string | null;
  status: HandlingUnitStatus;
  shipmentId: string | null;
  shipmentFolio?: string | null;
  type?: string;
}

/** Per-unit projection returned to the UI (one row of the loading checklist). */
export interface LoadingUnitView {
  id: string;
  sscc: string | null;
  type?: string;
  status: HandlingUnitStatus;
  loaded: boolean;
}

export interface LoadingState {
  shipmentId: string;
  total: number;
  loaded: number;
  pending: number;
  /** total > 0 and nothing pending — every assigned unit is verified on the truck. */
  complete: boolean;
  /** whether this shipment uses packing at all (has any assigned handling units). */
  hasUnits: boolean;
  units: LoadingUnitView[];
}

export type ScanResult = 'matched' | 'already' | 'unknown' | 'wrong-shipment';

export interface ScanOutcome {
  result: ScanResult;
  sscc: string;
  unit?: LoadingUnitLike;
  /** present on 'wrong-shipment': which shipment the scanned unit actually belongs to. */
  belongsToShipmentId?: string | null;
  belongsToFolio?: string | null;
}

const SSCC_LEN = 18;

/**
 * Normalize a scanned SSCC for comparison against the stored 18-digit value.
 * A raw GS1-128 scan carries the Application Identifier "00" (→ 20 digits) and may
 * include formatting like "(00) …"; strip everything but digits and drop a leading
 * AI "00" when that leaves a clean 18-digit SSCC. An 18-digit scan passes through.
 */
export function normalizeSscc(raw: string | null | undefined): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === SSCC_LEN + 2 && digits.startsWith('00')) {
    return digits.slice(2);
  }
  return digits;
}

/** Build the loading state for a shipment from its assigned handling units. */
export function computeLoadingState(
  shipmentId: string,
  units: LoadingUnitLike[],
): LoadingState {
  const views: LoadingUnitView[] = units.map((u) => ({
    id: u.id,
    sscc: u.sscc,
    type: u.type,
    status: u.status,
    loaded: u.status === 'LOADED',
  }));
  const total = views.length;
  const loaded = views.filter((v) => v.loaded).length;
  const pending = total - loaded;
  return {
    shipmentId,
    total,
    loaded,
    pending,
    complete: total > 0 && pending === 0,
    hasUnits: total > 0,
    units: views,
  };
}

/**
 * Classify a scan. `unit` is the handling unit found by SSCC within the current
 * tenant scope (or null if none matched). Pure — the caller persists LOADED on a
 * 'matched' result and surfaces the others as poka-yoke feedback.
 */
export function classifyScan(
  unit: LoadingUnitLike | null,
  targetShipmentId: string,
  sscc: string,
): ScanOutcome {
  if (!unit) return { result: 'unknown', sscc };
  if (unit.shipmentId !== targetShipmentId) {
    return {
      result: 'wrong-shipment',
      sscc,
      unit,
      belongsToShipmentId: unit.shipmentId,
      belongsToFolio: unit.shipmentFolio ?? null,
    };
  }
  if (unit.status === 'LOADED') return { result: 'already', sscc, unit };
  return { result: 'matched', sscc, unit };
}
