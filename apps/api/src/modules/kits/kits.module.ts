import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Kit } from './entities/kit.entity';
import { Plan } from '../plans/entities/plan.entity';
import { BomItem } from '../bom/entities/bom-item.entity';
import { KitMaterial } from '../kit-materials/entities/kit-material.entity';
import { BayLayout } from '../bay-layout/entities/bay-layout.entity';
import { ProductionBayMaterialState } from '../production-runtime/entities/production-bay-material-state.entity';
import { KitsService } from './kits.service';
import { KitsController } from './kits.controller';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { EnterpriseProgram } from '../enterprise-campus/entities/enterprise-program.entity';
import { EnterpriseLine } from '../enterprise-campus/entities/enterprise-line.entity';
import { GovernanceModule } from '../governance/governance.module';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Kit, Plan, BomItem, KitMaterial, BayLayout, ProductionBayMaterialState, EnterpriseProgram, EnterpriseLine]),
    EventLedgerModule,
    GovernanceModule,
  ],
  controllers: [KitsController],
  providers: [KitsService, provideTenantScopedRepository(Kit)],
  exports: [KitsService],
})
export class KitsModule {}
