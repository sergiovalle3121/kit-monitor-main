import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CorrectiveProposal } from './entities/corrective-proposal.entity';
import { AutopilotService } from './autopilot.service';
import { AutopilotController } from './autopilot.controller';
import { ProductionWip } from '../production-runtime/entities/production-wip.entity';
import { Resupply } from '../resupplies/entities/resupply.entity';
import { ProductionRuntimeModule } from '../production-runtime/production-runtime.module';
import { DecisionIntelligenceModule } from '../decision-intelligence/decision-intelligence.module';
import { SignalModule } from '../../common/gateway/signal.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CorrectiveProposal, ProductionWip, Resupply]),
    ProductionRuntimeModule,
    DecisionIntelligenceModule,
    SignalModule,
  ],
  providers:   [AutopilotService],
  controllers: [AutopilotController],
  exports:     [AutopilotService],
})
export class AutopilotModule {}
