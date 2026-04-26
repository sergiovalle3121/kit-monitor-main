import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plan } from './entities/plan.entity';
import { LineCapacity } from './entities/line-capacity.entity';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';
import { EnterpriseProgram } from '../enterprise-campus/entities/enterprise-program.entity';
import { EnterpriseLine } from '../enterprise-campus/entities/enterprise-line.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { QualityModule } from '../quality/quality.module';
import { GovernanceModule } from '../governance/governance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Plan, LineCapacity, EnterpriseProgram, EnterpriseLine]),
    InventoryModule,
    QualityModule,
    GovernanceModule,
  ],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
