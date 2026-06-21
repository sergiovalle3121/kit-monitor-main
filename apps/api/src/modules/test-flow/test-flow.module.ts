import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UnitFlow } from './entities/unit-flow.entity';
import { TestFlowService } from './test-flow.service';
import { TestFlowController } from './test-flow.controller';

import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { FloorQualityModule } from '../floor-quality/floor-quality.module';
import { GenealogyModule } from '../genealogy/genealogy.module';

/**
 * Frente Pruebas · Eslabón 1 — the additive weave that ties the MES assembly
 * line to Pruebas and then to Empaque (PASS) or Disposición (FAIL), threaded by
 * serial number. Reuses floor-quality holds, the Event Ledger and genealogy;
 * it owns only the lightweight `test_flow_units` bridge table.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([UnitFlow]),
    EventLedgerModule,
    FloorQualityModule,
    GenealogyModule,
  ],
  controllers: [TestFlowController],
  providers: [TestFlowService],
  exports: [TestFlowService],
})
export class TestFlowModule {}
