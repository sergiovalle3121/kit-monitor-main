import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestRecord } from './entities/test-record.entity';
import { TestingService } from './testing.service';
import { TestingController } from './testing.controller';
import { NumberingModule } from '../numbering/numbering.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { TestFlowModule } from '../test-flow/test-flow.module';

/**
 * Test Engineering / Yields. Self-contained, additive area that captures test
 * results and computes yield / first-pass-yield / failure Pareto. Consumes the
 * central numbering service for test-record folios. Routes each captured result
 * onward (PASS → Empaque, FAIL → Disposición) via the Eslabón 1 weave.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([TestRecord]),
    NumberingModule,
    EventLedgerModule,
    TestFlowModule,
  ],
  controllers: [TestingController],
  providers: [TestingService],
  exports: [TestingService],
})
export class TestingModule {}
