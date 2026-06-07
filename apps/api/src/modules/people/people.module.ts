import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Certification } from './entities/certification.entity';
import { PeopleService } from './people.service';
import { PeopleController } from './people.controller';
import { NumberingModule } from '../numbering/numbering.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';

/**
 * People / Capital Humano — skills & certifications with expiry alerts.
 * Self-contained additive area (employee denormalized) that consumes the central
 * numbering service for certification folios.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Certification]),
    NumberingModule,
    EventLedgerModule,
  ],
  controllers: [PeopleController],
  providers: [PeopleService],
  exports: [PeopleService],
})
export class PeopleModule {}
