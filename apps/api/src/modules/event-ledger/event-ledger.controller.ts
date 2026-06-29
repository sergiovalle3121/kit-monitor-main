import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  createApiSuccessEnvelope,
  type ApiSuccessEnvelope,
} from '@axos/contracts';
import { EventLedgerService } from './event-ledger.service';
import type {
  LedgerEventQueryResult,
  QueryLedgerEventsDto,
} from './event-ledger.service';
import { LedgerEvent } from './entities/ledger-event.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Require authentication. This audit/activity ledger was readable anonymously.
@UseGuards(JwtAuthGuard)
@Controller('ledger')
export class EventLedgerController {
  constructor(private readonly ledgerService: EventLedgerService) {}

  /** Feed global: eventos recientes de toda la bitácora (para el timeline). */
  @Get()
  async list(@Query('limit') limit?: string): Promise<LedgerEvent[]> {
    const n = limit ? parseInt(limit, 10) : 200;
    return this.ledgerService.findRecent(Number.isFinite(n) ? n : 200);
  }

  /** Audit-ready server-side query with composable filters and pagination. */
  @Get('query')
  async query(
    @Query() query: QueryLedgerEventsDto,
  ): Promise<LedgerEventQueryResult> {
    return this.ledgerService.queryEvents(query);
  }

  /**
   * Envelope-adopted variant for clients migrating to the shared response
   * contract. The legacy `/ledger/query` shape stays unchanged.
   */
  @Get('query/envelope')
  async queryEnvelope(
    @Query() query: QueryLedgerEventsDto,
  ): Promise<ApiSuccessEnvelope<LedgerEventQueryResult>> {
    const result = await this.ledgerService.queryEvents(query);
    return createApiSuccessEnvelope(result);
  }

  @Get('reference/:type/:id')
  async getByReference(
    @Param('type') type: string,
    @Param('id') id: string,
  ): Promise<LedgerEvent[]> {
    return this.ledgerService.getEventsByReference(type.toUpperCase(), id);
  }

  @Get('work-order/:wo')
  async getByWorkOrder(@Param('wo') wo: string): Promise<LedgerEvent[]> {
    return this.ledgerService.getEventsByWorkOrder(wo);
  }
}
