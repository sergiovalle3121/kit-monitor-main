export type MaterialRequestStatus =
  | 'pending'
  | 'authorized'
  | 'rejected'
  | 'fulfilled'
  | 'cancelled';

export interface MaterialRequestQueueItem {
  id: number;
  kitId: number;
  requestedBy: string;
  status: MaterialRequestStatus;
  note?: string | null;
  createdAt?: string | null;
  model?: string | null;
  workOrder?: string | null;
  line?: string | number | null;
  quantity?: number | null;
  station?: string | null;
  partNumber?: string | null;
  requestedQty?: number | null;
  unit?: string | null;
}

export interface MaterialRequestQueueSummary {
  active: number;
  pending: number;
  authorized: number;
}

const ACTIVE_STATUSES = new Set<MaterialRequestStatus>([
  'pending',
  'authorized',
]);

export function isActiveMaterialRequest(status: MaterialRequestStatus): boolean {
  return ACTIVE_STATUSES.has(status);
}

export function activeMaterialRequestQueue(
  requests: readonly MaterialRequestQueueItem[],
): MaterialRequestQueueItem[] {
  const timestamp = (value?: string | null) => {
    const parsed = Date.parse(value ?? '');
    return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
  };

  return requests
    .filter((request) => isActiveMaterialRequest(request.status))
    .slice()
    .sort((a, b) => {
      const byDate = timestamp(b.createdAt) - timestamp(a.createdAt);
      return byDate || b.id - a.id;
    });
}

export function summarizeMaterialRequestQueue(
  requests: readonly MaterialRequestQueueItem[],
): MaterialRequestQueueSummary {
  return requests.reduce<MaterialRequestQueueSummary>(
    (summary, request) => {
      if (!isActiveMaterialRequest(request.status)) return summary;
      summary.active += 1;
      if (request.status === 'pending') summary.pending += 1;
      if (request.status === 'authorized') summary.authorized += 1;
      return summary;
    },
    { active: 0, pending: 0, authorized: 0 },
  );
}

export function materialRequestContextLabel(
  request: MaterialRequestQueueItem,
): string {
  const part = request.partNumber?.trim();
  const unit = request.unit?.trim();
  const requestedQty =
    typeof request.requestedQty === 'number' && request.requestedQty > 0
      ? request.requestedQty
      : null;
  const partLabel = part
    ? `${part}${requestedQty ? ` x${requestedQty}${unit ? ` ${unit}` : ''}` : ''}`
    : null;
  return [
    partLabel,
    request.station?.trim(),
    request.line ? `linea ${request.line}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
