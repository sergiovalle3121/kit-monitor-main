import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DecisionIntelligenceService } from './decision-intelligence.service';
import { DecisionIntelligenceController } from './decision-intelligence.controller';
import { ForecastRun } from './entities/forecast-run.entity';
import { ForecastSeriesResult } from './entities/forecast-series-result.entity';
import { PlanScenario } from './entities/plan-scenario.entity';
import { PlanPublication } from './entities/plan-publication.entity';
import { ProductionBayMaterialState } from '../production-runtime/entities/production-bay-material-state.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    ForecastRun,
    ForecastSeriesResult,
    PlanScenario,
    PlanPublication,
    ProductionBayMaterialState,
  ])],
  providers: [DecisionIntelligenceService],
  controllers: [DecisionIntelligenceController],
})
export class DecisionIntelligenceModule {}
