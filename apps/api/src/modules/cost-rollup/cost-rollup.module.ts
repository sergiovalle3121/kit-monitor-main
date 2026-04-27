import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { GovernanceModule } from '../governance/governance.module';
import { CostRollupController } from './cost-rollup.controller';
import { CostRollupService } from './cost-rollup.service';
import { CostItem } from './entities/cost-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CostItem]), AuthModule, GovernanceModule],
  controllers: [CostRollupController],
  providers: [CostRollupService, PermissionsGuard],
  exports: [CostRollupService],
})
export class CostRollupModule {}
