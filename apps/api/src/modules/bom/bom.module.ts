import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BomItem } from './entities/bom-item.entity';
import { BomHeader } from './entities/bom-header.entity';
import { BomComponent } from './entities/bom-component.entity';
import { BomService } from './bom.service';
import { BomController } from './bom.controller';
import { EnterpriseProgram } from '../enterprise-campus/entities/enterprise-program.entity';
import { MaterialMaster } from '../inventory/entities/material-master.entity';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

@Module({
  imports: [TypeOrmModule.forFeature([BomItem, BomHeader, BomComponent, EnterpriseProgram, MaterialMaster])],
  controllers: [BomController],
  providers: [
    BomService,
    provideTenantScopedRepository(BomItem),
    provideTenantScopedRepository(BomHeader),
    provideTenantScopedRepository(BomComponent),
    provideTenantScopedRepository(MaterialMaster),
  ],
  exports: [BomService],
})
export class BomModule {}
