import { Test, TestingModule } from '@nestjs/testing';
import { GovernanceService } from './governance.service';
import { UsersService } from '../users/users.service';
import { EnterpriseCampusService } from '../enterprise-campus/enterprise-campus.service';
import { AuditService } from './audit.service';
import { NotificationService } from './notification.service';

describe('GovernanceService', () => {
  let service: GovernanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GovernanceService,
        { provide: UsersService, useValue: {} },
        { provide: EnterpriseCampusService, useValue: {} },
        { provide: AuditService, useValue: {} },
        { provide: NotificationService, useValue: {} },
      ],
    }).compile();

    service = module.get<GovernanceService>(GovernanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
