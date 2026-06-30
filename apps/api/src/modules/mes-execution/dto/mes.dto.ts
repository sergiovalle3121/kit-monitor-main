import type { AndonType } from '../entities/andon-call.entity';
import type { DowntimeReason } from '../entities/mes-downtime.entity';
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
  reel?: string;
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
  containment?: {
    lot?: string | null;
    serialCount?: number;
    shipmentCount?: number;
    customers?: string[];
  };
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
  downtimeReason?: DowntimeReason;
}

export class AssignStationDto {
  stepId: number;
  operatorName: string;
  operatorId?: string;
}

export type ReplayableMesActionType = 'confirm' | 'incident' | 'andon';

export class ReplayOfflineActionDto {
  id: string;
  type: ReplayableMesActionType;
  label?: string;
  payload: Record<string, unknown>;
  endpoint?: string;
  method?: 'POST';
  createdAt?: string;
  attempts?: number;
}

export class ReplayOfflineQueueDto {
  actions: ReplayOfflineActionDto[];
}

export class AcknowledgeFollowUpDto {
  executionId: number;
  followUpKey: string;
  label: string;
  owner?: string;
  source?: 'containment' | 'andon' | 'material' | 'offline' | 'quality';
  status?: string;
  note?: string;
}

export class EscalateFollowUpDto {
  executionId: number;
  followUpKey: string;
  label: string;
  owner?: string;
  escalatedTo: string;
  source?: 'containment' | 'andon' | 'material' | 'offline' | 'quality';
  reason?: string;
}
