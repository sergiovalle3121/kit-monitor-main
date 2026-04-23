import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GovernanceService } from './governance.service';
import { GovernanceController } from './governance.controller';
import { UsersModule } from '../users/users.module';
import { EnterpriseCampusModule } from '../enterprise-campus/enterprise-campus.module';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';
import { OperationalException } from './entities/operational-exception.entity';
import { Notification } from './entities/notification.entity';
import { NotificationLog } from './entities/notification-log.entity';
import { GovernancePolicy } from './entities/governance-policy.entity';
import { NotificationService } from './notification.service';
import { EscalationTask } from './tasks/escalation.task';

import { GovernanceSeedService } from './governance-seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditLog, 
      OperationalException, 
      Notification, 
      NotificationLog, 
      GovernancePolicy
    ]),
    UsersModule,
    EnterpriseCampusModule,
    ScheduleModule.forRoot(),
  ],
  providers: [
    GovernanceService, 
    AuditService, 
    NotificationService, 
    EscalationTask, 
    GovernanceSeedService
  ],
  controllers: [GovernanceController],
  exports: [GovernanceService, AuditService, NotificationService],
})
export class GovernanceModule {}
