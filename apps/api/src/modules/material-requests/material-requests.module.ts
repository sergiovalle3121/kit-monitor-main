import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialRequest } from './entities/material-request.entity';
import { Kit } from '../kits/entities/kit.entity';
import { MaterialRequestsService } from './material-requests.service';
import { MaterialRequestsController } from './material-requests.controller';
import { SignalModule } from '../../common/gateway/signal.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { GovernanceModule } from '../governance/governance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MaterialRequest, Kit]),
    SignalModule,
    EventLedgerModule,
    GovernanceModule, // provides AuditService required by PermissionsGuard
  ],
  controllers: [MaterialRequestsController],
  providers: [MaterialRequestsService],
  exports: [MaterialRequestsService],
})
export class MaterialRequestsModule {}
