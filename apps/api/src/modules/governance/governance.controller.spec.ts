import { Test, TestingModule } from '@nestjs/testing';
import { GovernanceController } from './governance.controller';
import { GovernanceService } from './governance.service';
import { GovernanceAnalyticsService } from './governance-analytics.service';
import { MaintenanceService } from './maintenance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

describe('GovernanceController', () => {
  let controller: GovernanceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GovernanceController],
      providers: [
        { provide: GovernanceService, useValue: {} },
        { provide: GovernanceAnalyticsService, useValue: {} },
        { provide: MaintenanceService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<GovernanceController>(GovernanceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
