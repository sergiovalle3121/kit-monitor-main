import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GovernanceService } from './governance.service';
import { GovernanceController } from './governance.controller';
import { UsersModule } from '../users/users.module';
import { EnterpriseCampusModule } from '../enterprise-campus/enterprise-campus.module';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';
import { OperationalException } from './entities/operational-exception.entity';
import { Notification } from './entities/notification.entity';
import { NotificationService } from './notification.service';

import { GovernanceSeedService } from './governance-seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog, OperationalException, Notification]),
    UsersModule,
    EnterpriseCampusModule,
  ],
  providers: [GovernanceService, AuditService, NotificationService, GovernanceSeedService],
  controllers: [GovernanceController],
  exports: [GovernanceService, AuditService, NotificationService],
})
export class GovernanceModule {}
