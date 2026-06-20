import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MmMaterial } from './entities/mm-material.entity';
import { MmAvl } from './entities/mm-avl.entity';
import { MmMaterialAlt } from './entities/mm-material-alt.entity';
import { MaterialMasterService } from './material-master.service';
import { MaterialMasterController } from './material-master.controller';
import { NumberingModule } from '../numbering/numbering.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

/**
 * Material Master (MM) — the canonical, SAP-style single source of parts that
 * the new multi-level BOM and routing reference. Self-contained, additive;
 * consumes the central numbering service for MAT- folios. New prefixed tables
 * (`mm_`) coexisting with the legacy `material_master` until the supervised cut.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([MmMaterial, MmAvl, MmMaterialAlt]),
    NumberingModule,
    EventLedgerModule,
  ],
  controllers: [MaterialMasterController],
  providers: [
    MaterialMasterService,
    provideTenantScopedRepository(MmMaterial),
    provideTenantScopedRepository(MmAvl),
    provideTenantScopedRepository(MmMaterialAlt),
  ],
  exports: [MaterialMasterService],
})
export class MaterialMasterModule {}
