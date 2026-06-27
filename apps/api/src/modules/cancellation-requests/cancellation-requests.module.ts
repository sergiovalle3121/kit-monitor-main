import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CancellationRequest } from './entities/cancellation-request.entity';
import { CancellationRequestsService } from './cancellation-requests.service';
import { CancellationRequestsController } from './cancellation-requests.controller';
import { Plan } from '../plans/entities/plan.entity';
import { Kit } from '../kits/entities/kit.entity';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([CancellationRequest, Plan, Kit]),
    EventLedgerModule,
  ],
  controllers: [CancellationRequestsController],
  providers: [
    CancellationRequestsService,
    provideTenantScopedRepository(CancellationRequest),
    provideTenantScopedRepository(Plan),
    provideTenantScopedRepository(Kit),
  ],
  exports: [CancellationRequestsService],
})
export class CancellationRequestsModule {}
