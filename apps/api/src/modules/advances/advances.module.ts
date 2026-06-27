import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Advance } from './entities/advance.entity';
import { Kit } from '../kits/entities/kit.entity';
import { KitMaterial } from '../kit-materials/entities/kit-material.entity';
import { AdvancesService } from './advances.service';
import { AdvancesController } from './advances.controller';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Advance, Kit, KitMaterial])],
  controllers: [AdvancesController],
  providers: [
    AdvancesService,
    provideTenantScopedRepository(Advance),
    provideTenantScopedRepository(Kit),
    provideTenantScopedRepository(KitMaterial),
  ],
  exports: [AdvancesService],
})
export class AdvancesModule {}
