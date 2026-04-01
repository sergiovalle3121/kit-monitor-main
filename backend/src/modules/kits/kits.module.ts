import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Kit } from './entities/kit.entity';
import { Plan } from '../plans/entities/plan.entity';
import { BomItem } from '../bom/entities/bom-item.entity';
import { KitMaterial } from '../kit-materials/entities/kit-material.entity';
import { KitsService } from './kits.service';
import { KitsController } from './kits.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Kit, Plan, BomItem, KitMaterial])],
  controllers: [KitsController],
  providers: [KitsService],
  exports: [KitsService],
})
export class KitsModule {}
