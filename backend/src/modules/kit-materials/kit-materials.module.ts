import { Module } from '@nestjs/common';
import { KitMaterialsService } from './kit-materials.service';
import { KitMaterialsController } from './kit-materials.controller';

@Module({
  controllers: [KitMaterialsController],
  providers: [KitMaterialsService],
  exports: [KitMaterialsService],
})
export class KitMaterialsModule {}
