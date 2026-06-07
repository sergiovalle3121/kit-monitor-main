import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Opportunity } from './entities/opportunity.entity';
import { CrmService } from './crm.service';
import { CrmController } from './crm.controller';
import { NumberingModule } from '../numbering/numbering.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';

/**
 * CRM / Sales pipeline. Self-contained additive area (customer denormalized)
 * that consumes the central numbering service for opportunity folios.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Opportunity]),
    NumberingModule,
    EventLedgerModule,
  ],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
