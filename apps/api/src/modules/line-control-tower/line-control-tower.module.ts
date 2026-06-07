import { Module } from '@nestjs/common';
import { LineControlTowerService } from './line-control-tower.service';
import { LineControlTowerController } from './line-control-tower.controller';
import { ProductionPlanModule } from '../production-plan/production-plan.module';
import { MaterialStagingModule } from '../material-staging/material-staging.module';
import { OperatorTerminalModule } from '../operator-terminal/operator-terminal.module';
import { FloorQualityModule } from '../floor-quality/floor-quality.module';

/**
 * Line Control Tower (Block L) — capstone aggregator over the shop-floor modules.
 * No tables of its own; injects the floor services and rolls them up per line.
 */
@Module({
  imports: [
    ProductionPlanModule,
    MaterialStagingModule,
    OperatorTerminalModule,
    FloorQualityModule,
  ],
  controllers: [LineControlTowerController],
  providers: [LineControlTowerService],
  exports: [LineControlTowerService],
})
export class LineControlTowerModule {}
