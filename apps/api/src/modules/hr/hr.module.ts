import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HrEmployee } from './entities/hr-employee.entity';
import { HrRequisition } from './entities/hr-requisition.entity';
import { HrCandidate } from './entities/hr-candidate.entity';
import { HrPerformanceReview } from './entities/hr-performance-review.entity';
import { HrAbsence } from './entities/hr-absence.entity';
import { HrService } from './hr.service';
import { HrController } from './hr.controller';
import { NumberingModule } from '../numbering/numbering.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { PeopleModule } from '../people/people.module';

/**
 * HR / Capital Humano — the workforce backbone (employees), talent acquisition
 * (requisitions + candidates), performance (9-box reviews), attendance and the
 * people-analytics cockpit. Additive area (tables prefixed `hr_`); consumes the
 * central numbering + event ledger, and PeopleService for skill-coverage in the
 * staffing-risk cross with production.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      HrEmployee,
      HrRequisition,
      HrCandidate,
      HrPerformanceReview,
      HrAbsence,
    ]),
    NumberingModule,
    EventLedgerModule,
    PeopleModule,
  ],
  controllers: [HrController],
  providers: [HrService],
  exports: [HrService],
})
export class HrModule {}
