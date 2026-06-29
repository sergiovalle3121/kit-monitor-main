import type { WorkOrderStatus } from './wo-state';

export interface CancellationGuardWorkOrder {
  status: WorkOrderStatus;
  materialReady?: boolean | null;
  quantityCompleted?: number | null;
  startedAt?: Date | string | null;
}

export function unsafeCancellationReasons(wo: CancellationGuardWorkOrder): string[] {
  const reasons: string[] = [];
  const completedQty = Number(wo.quantityCompleted ?? 0);

  if (wo.materialReady || wo.status === 'STAGED') {
    reasons.push('material ya montado');
  }
  if (wo.status === 'IN_EXECUTION' || completedQty > 0 || !!wo.startedAt) {
    reasons.push('ejecucion ya iniciada');
  }

  return reasons;
}

export function assertSafeCancellation(wo: CancellationGuardWorkOrder): void {
  const reasons = unsafeCancellationReasons(wo);
  if (reasons.length > 0) {
    throw new Error(
      `No se puede cancelar una WO con ${reasons.join(' y ')}. ` +
        'Primero retira staging abierto o registra una disposicion operativa.',
    );
  }
}
