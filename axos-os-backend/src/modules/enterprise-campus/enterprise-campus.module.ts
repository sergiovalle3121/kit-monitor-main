import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnterpriseCampusController } from './enterprise-campus.controller';
import { EnterpriseCampusService } from './enterprise-campus.service';
import { Kit } from '../kits/entities/kit.entity';
import { Plan } from '../plans/entities/plan.entity';
import { CancellationRequest } from '../cancellation-requests/entities/cancellation-request.entity';
import { ProductionBayIncident } from '../production-runtime/entities/production-bay-incident.entity';
import { EnterpriseBuilding } from './entities/enterprise-building.entity';
import { EnterpriseWarehouse } from './entities/enterprise-warehouse.entity';
import { EnterpriseCustomer } from './entities/enterprise-customer.entity';
import { EnterpriseProgram } from './entities/enterprise-program.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Kit,
      Plan,
      CancellationRequest,
      ProductionBayIncident,
      EnterpriseBuilding,
      EnterpriseWarehouse,
      EnterpriseCustomer,
      EnterpriseProgram,
    ]),
  ],
  controllers: [EnterpriseCampusController],
  providers: [EnterpriseCampusService],
})
export class EnterpriseCampusModule {}
