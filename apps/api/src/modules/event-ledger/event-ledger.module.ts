import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerEvent } from './entities/ledger-event.entity';
import { EventLedgerService } from './event-ledger.service';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

import { EventLedgerController } from './event-ledger.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LedgerEvent])],
  controllers: [EventLedgerController],
  providers: [EventLedgerService, provideTenantScopedRepository(LedgerEvent)],
  exports: [EventLedgerService],
})
export class EventLedgerModule {}
