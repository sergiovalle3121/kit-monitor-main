import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Resupply } from './entities/resupply.entity';
import { ResuppliesService } from './resupplies.service';
import { ResuppliesController } from './resupplies.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Resupply])],
  controllers: [ResuppliesController],
  providers: [ResuppliesService],
  exports: [ResuppliesService],
})
export class ResuppliesModule {}
