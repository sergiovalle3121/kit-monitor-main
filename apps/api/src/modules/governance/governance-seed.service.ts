import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';
import { GovernancePolicy } from './entities/governance-policy.entity';
import { servicePasswordFromEnv } from '../../common/config/service-password';

@Injectable()
export class GovernanceSeedService implements OnModuleInit {
  private readonly logger = new Logger(GovernanceSeedService.name);

  constructor(
    private readonly usersService: UsersService,
    @InjectRepository(GovernancePolicy)
    private readonly policyRepo: Repository<GovernancePolicy>,
  ) {}

  async onModuleInit() {
    try {
      await this.seedUsers();
      await this.seedPolicies();
    } catch (error: any) {
      const msg = String(error?.message ?? '');
      const code = error?.code;
      if (code === '42P01' || (msg.toLowerCase().includes('relation') && msg.toLowerCase().includes('does not exist'))) {
        this.logger.warn('Skipping governance seed: tables are not available yet.');
        return;
      }
      throw error;
    }
  }

  async seedPolicies() {
    const policies = [
      { domain: 'QUALITY', escalationThresholdHours: 1 },
      { domain: 'SHIPPING', escalationThresholdHours: 1 },
      { domain: 'INVENTORY', escalationThresholdHours: 4 },
      { domain: 'PRODUCTION', escalationThresholdHours: 2 },
      { domain: 'PLANNING', escalationThresholdHours: 8 },
    ];

    for (const p of policies) {
      const exists = await this.policyRepo.findOne({ where: { domain: p.domain } });
      if (!exists) {
        await this.policyRepo.save(this.policyRepo.create(p));
      }
    }
    this.logger.log('Governance policies seeded.');
  }

  async seedUsers() {
    const password = '$2b$10$TiyD4WmvV3cDHl2/ysBK4eF8P5ZtfuQzQrMZsxokgfA/Fl.cNB0dy'; // Demo password

    const users = [
      {
        email: 'admin@axos.os',
        username: 'System Admin',
        password,
        role: UserRole.ADMIN,
        permissions: ['ADMIN_ACCESS', 'RELEASE_WO', 'QUALITY_APPROVE', 'DISPATCH', 'MANAGE_MASTER_DATA', 'INVENTORY_ADJUST', 'materials:read', 'materials:write', 'production:read', 'production:write', 'admin:read', 'admin:write'],
        scopes: {}
      },
      {
        email: 'planner.b1@axos.os',
        username: 'Planner BLDG-01',
        password,
        role: UserRole.PLANNER,
        permissions: ['PLANNING_VIEW', 'MANAGE_PLANS', 'RELEASE_WO'],
        scopes: { buildings: ['bldg-01'] }
      },
      {
        email: 'quality.mgr@axos.os',
        username: 'QA Manager',
        password,
        role: UserRole.QUALITY_MANAGER,
        permissions: ['QUALITY_WRITE', 'QUALITY_APPROVE'],
        scopes: {} // Full campus QA
      },
      {
        email: 'warehouse.op1@axos.os',
        username: 'WH Operator Line 1',
        password,
        role: UserRole.WAREHOUSE_OPERATOR,
        permissions: ['INVENTORY_ADJUST'],
        scopes: { lines: [1] }
      },
      {
        email: 'shipping.lead@axos.os',
        username: 'Shipping Lead',
        password,
        role: UserRole.SHIPPING_LEAD,
        permissions: ['SHIPPING_WRITE', 'DISPATCH'],
        scopes: { buildings: ['bldg-03'] } // Shipping is usually in assembly bldg
      }
    ];

    // Super Admin password comes ONLY from the environment. We pass the plaintext
    // value (UsersService.create hashes it once at runtime) instead of embedding a
    // pre-computed hash of a public password. When BACKEND_SERVICE_PASSWORD is not
    // set we OMIT this privileged account entirely rather than seed a known credential.
    const servicePassword = servicePasswordFromEnv();
    if (servicePassword) {
      users.unshift({
        email: '3312793',
        username: 'Super Admin',
        password: servicePassword,
        role: UserRole.ADMIN,
        permissions: ['ADMIN_ACCESS', 'RELEASE_WO', 'QUALITY_APPROVE', 'DISPATCH', 'MANAGE_MASTER_DATA', 'INVENTORY_ADJUST', 'materials:read', 'materials:write', 'production:read', 'production:write', 'admin:read', 'admin:write'],
        scopes: {},
      });
    } else {
      this.logger.warn(
        'Skipping Super Admin seed: BACKEND_SERVICE_PASSWORD is not set.',
      );
    }

    for (const u of users) {
      const exists = await this.usersService.findOneByEmail(u.email);
      if (!exists) {
        await this.usersService.create(u);
      }
    }
  }
}
