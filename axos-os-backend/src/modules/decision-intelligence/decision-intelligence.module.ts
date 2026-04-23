import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DecisionIntelligenceService } from './decision-intelligence.service';
import { DecisionIntelligenceController } from './decision-intelligence.controller';
import { ForecastRun } from './entities/forecast-run.entity';
import { ForecastSeriesResult } from './entities/forecast-series-result.entity';
import { PlanScenario } from './entities/plan-scenario.entity';
import { PlanPublication } from './entities/plan-publication.entity';
import { ProductionBayMaterialState } from '../production-runtime/entities/production-bay-material-state.entity';
import { ForecastErrorHistory } from './entities/forecast-error-history.entity';
import { ScenarioSimulationResult } from './entities/scenario-simulation-result.entity';
import { PlanActualOutcome } from './entities/plan-actual-outcome.entity';
import { ScoreCalibrationPoint } from './entities/score-calibration-point.entity';

// Site Overview Dependencies
import { ProductionWip } from '../production-runtime/entities/production-wip.entity';
import { NCR } from '../ncr/entities/ncr.entity';
import { WarehouseTask } from '../inventory/entities/warehouse-task.entity';
import { Shipment } from '../shipping/entities/shipment.entity';
import { InventoryPosition } from '../inventory/entities/inventory-position.entity';
import { EnterpriseBuilding } from '../enterprise-campus/entities/enterprise-building.entity';
import { FinalInspection } from '../quality/entities/final-inspection.entity';
import { IQCInspection } from '../quality/entities/iqc-inspection.entity';
import { CAPA } from '../quality/entities/capa.entity';
import { SCAR } from '../suppliers/entities/scar.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    ForecastRun,
    ForecastSeriesResult,
    PlanScenario,
    PlanPublication,
    ProductionBayMaterialState,
    ForecastErrorHistory,
    ScenarioSimulationResult,
    PlanActualOutcome,
    ScoreCalibrationPoint,
    ProductionWip,
    NCR,
    WarehouseTask,
    Shipment,
    InventoryPosition,
    EnterpriseBuilding,
    FinalInspection,
    IQCInspection,
    CAPA,
    SCAR,
    Supplier
  ])],
  providers: [DecisionIntelligenceService],
  controllers: [DecisionIntelligenceController],
})
export class DecisionIntelligenceModule {}
