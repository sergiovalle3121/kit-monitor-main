import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BomNode } from './entities/bom-node.entity';
import { BomLine } from './entities/bom-line.entity';
import { BomTreeService } from './bom-tree.service';
import { BomTreeController } from './bom-tree.controller';
import { MaterialMasterModule } from '../material-master/material-master.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

/**
 * Multi-level BOM (Engineering) — `bom_node` (header per assembly) + `bom_line`
 * (components referencing the material master). Real explosion + where-used.
 * Additive, prefixed tables, coexisting with the legacy flat BOM. Reuses the
 * Material Master service (single source of parts) for lookups and validation.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([BomNode, BomLine]),
    MaterialMasterModule,
    EventLedgerModule,
  ],
  controllers: [BomTreeController],
  providers: [
    BomTreeService,
    provideTenantScopedRepository(BomNode),
    provideTenantScopedRepository(BomLine),
  ],
  exports: [BomTreeService],
})
export class BomTreeModule {}
