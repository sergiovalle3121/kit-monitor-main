import { Injectable, OnModuleInit } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class GovernanceSeedService implements OnModuleInit {
  constructor(private readonly usersService: UsersService) {}

  async onModuleInit() {
    await this.seedUsers();
  }

  async seedUsers() {
    const existing = await this.usersService.findAll();
    if (existing.length > 1) return; // Skip if already seeded

    const password = '$2b$10$TiyD4WmvV3cDHl2/ysBK4eF8P5ZtfuQzQrMZsxokgfA/Fl.cNB0dy'; // Demo password

    const users = [
      {
        email: 'admin@axos.os',
        username: 'System Admin',
        password,
        role: UserRole.ADMIN,
        permissions: ['ADMIN_ACCESS', 'RELEASE_WO', 'QUALITY_APPROVE', 'DISPATCH', 'MANAGE_MASTER_DATA', 'INVENTORY_ADJUST'],
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
        username: 'QA Manager GDL',
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

    for (const u of users) {
      const exists = await this.usersService.findOneByEmail(u.email);
      if (!exists) {
        await this.usersService.create(u);
      }
    }
  }
}
