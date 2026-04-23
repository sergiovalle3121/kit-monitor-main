import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnterpriseCampusController } from './enterprise-campus.controller';
import { EnterpriseCampusService } from './enterprise-campus.service';
import { Kit } from '../kits/entities/kit.entity';
import { Plan } from '../plans/entities/plan.entity';
import { CancellationRequest } from '../cancellation-requests/entities/cancellation-request.entity';
import { ProductionBayIncident } from '../production-runtime/entities/production-bay-incident.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Kit, Plan, CancellationRequest, ProductionBayIncident])],
  controllers: [EnterpriseCampusController],
  providers: [EnterpriseCampusService],
})
export class EnterpriseCampusModule {}
