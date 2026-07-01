import { Module } from '@nestjs/common';
import { ControlTowerService } from './control-tower.service';
import { ControlTowerController } from './control-tower.controller';
import { ImprovementModule } from '../improvement/improvement.module';
import { EhsModule } from '../ehs/ehs.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { TestingModule } from '../testing/testing.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { FloorQualityModule } from '../floor-quality/floor-quality.module';

/**
 * Control Tower / Executive Cockpit — read-only cross-area aggregator. Owns no
 * tables; imports the area modules (which export their services) and combines
 * their KPIs into a single executive summary. Fully additive.
 */
@Module({
  imports: [
    ImprovementModule,
    EhsModule,
    MaintenanceModule,
    TestingModule,
    ProcurementModule,
    FloorQualityModule,
  ],
  controllers: [ControlTowerController],
  providers: [ControlTowerService],
  exports: [ControlTowerService],
})
export class ControlTowerModule {}
