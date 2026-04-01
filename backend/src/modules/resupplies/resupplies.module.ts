import { Module } from '@nestjs/common';
import { ResuppliesService } from './resupplies.service';
import { ResuppliesController } from './resupplies.controller';

@Module({
  controllers: [ResuppliesController],
  providers: [ResuppliesService],
  exports: [ResuppliesService],
})
export class ResuppliesModule {}
