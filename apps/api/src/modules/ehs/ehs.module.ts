import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SafetyIncident } from './entities/safety-incident.entity';
import { EhsService } from './ehs.service';
import { EhsController } from './ehs.controller';
import { NumberingModule } from '../numbering/numbering.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';

/**
 * EHS — Safety & Environment. Self-contained additive area that consumes the
 * central numbering service for incident folios.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SafetyIncident]),
    NumberingModule,
    EventLedgerModule,
  ],
  controllers: [EhsController],
  providers: [EhsService],
  exports: [EhsService],
})
export class EhsModule {}
