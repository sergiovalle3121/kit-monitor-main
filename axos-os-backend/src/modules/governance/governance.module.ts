import { Module } from '@nestjs/common';
import { GovernanceService } from './governance.service';
import { GovernanceController } from './governance.controller';
import { UsersModule } from '../users/users.module';
import { EnterpriseCampusModule } from '../enterprise-campus/enterprise-campus.module';

@Module({
  imports: [
    UsersModule,
    EnterpriseCampusModule,
  ],
  providers: [GovernanceService],
  controllers: [GovernanceController],
})
export class GovernanceModule {}
