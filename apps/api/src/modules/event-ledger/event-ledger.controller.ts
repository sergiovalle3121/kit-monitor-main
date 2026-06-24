import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { EventLedgerService } from './event-ledger.service';
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
