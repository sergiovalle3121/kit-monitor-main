import { Injectable, Logger } from '@nestjs/common';

/**
 * SAP integration seam (STUB). AXOS runs standalone today; this is where a real
 * SAP connector would post a goods-issue against the production order. The design
 * is deliberately laid out so a future implementation just fills the body:
 *  - idempotent by `idempotencyKey` (so retries never double-post),
 *  - movement type 261 (goods issue for an order),
 *  - an outbox row would be marked SENT/ACK by a worker.
 *
 * For now it logs and returns a stub document number so the rest of the flow
 * (ConsumptionEvent.outboxStatus) is exercised end-to-end.
 */
export interface GoodsIssue261 {
  idempotencyKey: string;
  orderFolio: string | null;
  material: string;
  quantity: number;
  plant: string | null;
  unitSerial?: string | null;
}

export interface SapPostResult {
  posted: boolean;
  stub: boolean;
  sapDocument: string | null;
}

@Injectable()
export class SapAdapter {
  private readonly logger = new Logger(SapAdapter.name);

  /** STUB: pretend to post a 261 goods issue. Never throws — outbox stays PENDING. */
  async postGoodsIssue261(mv: GoodsIssue261): Promise<SapPostResult> {
    this.logger.debug(
      `[SAP STUB] MV261 order=${mv.orderFolio ?? '—'} material=${mv.material} qty=${mv.quantity} key=${mv.idempotencyKey}`,
    );
    // Real impl: BAPI_GOODSMVT_CREATE with idempotency on mv.idempotencyKey.
    return { posted: false, stub: true, sapDocument: null };
  }
}
