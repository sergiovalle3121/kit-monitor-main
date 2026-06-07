import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from './entities/contract.entity';
import { LegalService } from './legal.service';
import { LegalController } from './legal.controller';
import { NumberingModule } from '../numbering/numbering.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';

/**
 * Legal / Compliance: contracts repository with expiry alerts. Self-contained,
 * additive area that consumes the central numbering service for contract folios.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Contract]),
    NumberingModule,
    EventLedgerModule,
  ],
  controllers: [LegalController],
  providers: [LegalService],
  exports: [LegalService],
})
export class LegalModule {}
