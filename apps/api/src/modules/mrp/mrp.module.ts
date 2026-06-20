import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MrpService } from './mrp.service';
import { MrpController } from './mrp.controller';
import { BomTreeModule } from '../bom-tree/bom-tree.module';
import { MaterialMasterModule } from '../material-master/material-master.module';
import { InventoryPosition } from '../inventory/entities/inventory-position.entity';

/**
 * MRP — net requirements over the ERP core. Reuses the BOM explosion + material
 * master, and reads inventory positions (read-only) to net demand vs supply.
 * No new tables, no writes.
 */
@Module({
  imports: [
    BomTreeModule,
    MaterialMasterModule,
    TypeOrmModule.forFeature([InventoryPosition]),
  ],
  controllers: [MrpController],
  providers: [MrpService],
  exports: [MrpService],
})
export class MrpModule {}
