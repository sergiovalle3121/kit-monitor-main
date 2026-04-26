import { Controller, Get, Param, Query } from '@nestjs/common';
import { EventLedgerService } from './event-ledger.service';
import { LedgerEvent } from './entities/ledger-event.entity';

@Controller('ledger')
export class EventLedgerController {
  constructor(private readonly ledgerService: EventLedgerService) {}

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
