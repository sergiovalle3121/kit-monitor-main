import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plan } from '../plans/entities/plan.entity';
import { Kit } from '../kits/entities/kit.entity';
import { BomItem } from '../bom/entities/bom-item.entity';
import { BomHeader } from '../bom/entities/bom-header.entity';
import { KitMaterial } from '../kit-materials/entities/kit-material.entity';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { GovernanceModule } from '../governance/governance.module';
import { PickListService } from './pick-list.service';
import { PickListController } from './pick-list.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Plan, Kit, BomItem, BomHeader, KitMaterial]),
    EventLedgerModule,
    GovernanceModule, // provides AuditService required by PermissionsGuard
  ],
  controllers: [PickListController],
  providers: [PickListService],
  exports: [PickListService],
})
export class PickListModule {}
