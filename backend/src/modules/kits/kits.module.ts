import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KitsService } from './kits.service';
import { KitsController } from './kits.controller';
import { Kit } from './entities/kit.entity';
import { Model } from '../models/entities/model.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Kit, Model]), // <-- Aquí agrega Model
  ],
  controllers: [KitsController],
  providers: [KitsService],
  exports: [KitsService], // Solo si necesitas exportarlo
})
export class KitsModule {}
