import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Kit } from '../kits/entities/kit.entity';
import { KitMaterial } from '../kit-materials/entities/kit-material.entity';
import { BayLayout } from '../bay-layout/entities/bay-layout.entity';
import { BomItem } from '../bom/entities/bom-item.entity';
import { ProductionBayEvent } from './entities/production-bay-event.entity';
import { ProductionBayIncident } from './entities/production-bay-incident.entity';
import { ProductionBayMaterialState } from './entities/production-bay-material-state.entity';
import { ProductionWip } from './entities/production-wip.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { ProductionRuntimeService } from './production-runtime.service';
import { ProductionRuntimeController } from './production-runtime.controller';
import { BottleneckService } from './bottleneck.service';
import { EnterpriseProgram } from '../enterprise-campus/entities/enterprise-program.entity';
import { EnterpriseLine } from '../enterprise-campus/entities/enterprise-line.entity';
import { GovernanceModule } from '../governance/governance.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Kit,
      KitMaterial,
      BayLayout,
      BomItem,
      ProductionBayEvent,
      ProductionBayIncident,
      ProductionBayMaterialState,
      ProductionWip,
      EnterpriseProgram,
      EnterpriseLine,
    ]),
    InventoryModule,
    GovernanceModule,
    AccountingModule,
  ],
  providers: [ProductionRuntimeService, BottleneckService],
  controllers: [ProductionRuntimeController],
  exports: [ProductionRuntimeService, BottleneckService],
})
export class ProductionRuntimeModule {}
