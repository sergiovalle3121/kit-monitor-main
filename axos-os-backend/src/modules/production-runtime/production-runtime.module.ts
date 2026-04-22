import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Kit } from '../kits/entities/kit.entity';
import { KitMaterial } from '../kit-materials/entities/kit-material.entity';
import { BayLayout } from '../bay-layout/entities/bay-layout.entity';
import { BomItem } from '../bom/entities/bom-item.entity';
import { ProductionBayEvent } from './entities/production-bay-event.entity';
import { ProductionBayIncident } from './entities/production-bay-incident.entity';
import { ProductionBayMaterialState } from './entities/production-bay-material-state.entity';
import { ProductionRuntimeService } from './production-runtime.service';
import { ProductionRuntimeController } from './production-runtime.controller';

@Module({
  imports: [TypeOrmModule.forFeature([
    Kit,
    KitMaterial,
    BayLayout,
    BomItem,
    ProductionBayEvent,
    ProductionBayIncident,
    ProductionBayMaterialState,
  ])],
  providers: [ProductionRuntimeService],
  controllers: [ProductionRuntimeController],
})
export class ProductionRuntimeModule {}
