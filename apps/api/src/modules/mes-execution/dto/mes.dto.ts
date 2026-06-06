import type { AndonType } from '../entities/andon-call.entity';
import type {
  IncidentSeverity,
  IncidentDisposition,
} from '../entities/station-incident.entity';

/** Open (or re-open) a Work Order on the line by exploding its route + kit. */
export class OpenExecutionDto {
  planId?: number;
  workOrder?: string;
  revision?: string;
}

/** Confirm advance at a station → backflush. */
export class ConfirmAdvanceDto {
  quantity: number;
  scrap?: number;
  operator?: string;
  operatorPosition?: string;
  serial?: string;
  lot?: string;
  notes?: string;
  /** Idempotency token (anti double-tap / scanner repeat). */
  clientRequestId: string;
}

export class ReportIncidentDto {
  type: string;
  severity?: IncidentSeverity;
  description?: string;
  qtyAffected?: number;
  serial?: string;
  photoVisualAidId?: string;
  blocksFlow?: boolean;
  escalateToNcr?: boolean;
  operator?: string;
}

export class DispositionIncidentDto {
  disposition: IncidentDisposition;
  resolvedBy?: string;
  note?: string;
}

export class RaiseAndonDto {
  type: AndonType;
  stepId?: number;
  note?: string;
  raisedBy?: string;
}

export class AssignStationDto {
  stepId: number;
  operatorName: string;
  operatorId?: string;
}
