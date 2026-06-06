import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessStep } from './entities/process-step.entity';
import { ProcessStepMaterial } from './entities/process-step-material.entity';
import { ProcessRoutingService } from './process-routing.service';
import { ProcessRoutingController } from './process-routing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProcessStep, ProcessStepMaterial])],
  controllers: [ProcessRoutingController],
  providers: [ProcessRoutingService],
  exports: [ProcessRoutingService],
})
export class ProcessRoutingModule {}
