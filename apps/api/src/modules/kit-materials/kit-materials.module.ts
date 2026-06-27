import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KitMaterial } from './entities/kit-material.entity';
import { KitMaterialsService } from './kit-materials.service';
import { KitMaterialsController } from './kit-materials.controller';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

@Module({
  imports: [TypeOrmModule.forFeature([KitMaterial])],
  controllers: [KitMaterialsController],
  providers: [KitMaterialsService, provideTenantScopedRepository(KitMaterial)],
  exports: [KitMaterialsService],
})
export class KitMaterialsModule {}
