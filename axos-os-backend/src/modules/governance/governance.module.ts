import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GovernanceService } from './governance.service';
import { GovernanceController } from './governance.controller';
import { UsersModule } from '../users/users.module';
import { EnterpriseCampusModule } from '../enterprise-campus/enterprise-campus.module';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';

import { GovernanceSeedService } from './governance-seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
    UsersModule,
    EnterpriseCampusModule,
  ],
  providers: [GovernanceService, AuditService, GovernanceSeedService],
  controllers: [GovernanceController],
  exports: [GovernanceService, AuditService],
})
export class GovernanceModule {}
