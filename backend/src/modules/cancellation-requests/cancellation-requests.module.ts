import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CancellationRequest } from './entities/cancellation-request.entity';
import { CancellationRequestsService } from './cancellation-requests.service';
import { CancellationRequestsController } from './cancellation-requests.controller';
import { Plan } from '../plans/entities/plan.entity';
import { Kit } from '../kits/entities/kit.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CancellationRequest, Plan, Kit])],
  controllers: [CancellationRequestsController],
  providers: [CancellationRequestsService],
  exports: [CancellationRequestsService],
})
export class CancellationRequestsModule {}
