import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { EnterpriseCampusService } from '../enterprise-campus/enterprise-campus.service';

@Injectable()
export class GovernanceService {
  constructor(
    private readonly usersService: UsersService,
    private readonly campusService: EnterpriseCampusService,
  ) {}

  // User Management
  async getUsers() {
    return this.usersService.findAll();
  }

  async updateUser(id: number, dto: any) {
    return this.usersService.update(id, dto);
  }

  // Master Data Aggregation
  async getMasterData() {
    const [buildings, warehouses, programs, lines] = await Promise.all([
      this.campusService.listBuildings(),
      this.campusService.listWarehouses(),
      this.campusService.listPrograms(),
      this.campusService.listLines(),
    ]);

    return {
      buildings,
      warehouses,
      programs,
      lines,
      roles: [
        'Admin', 'Planner', 'Materials Lead', 'Warehouse Operator', 
        'Production Supervisor', 'Quality Engineer', 'Quality Manager', 'Shipping Lead'
      ],
      permissions: [
        'RELEASE_WO', 'APPROVE_QUALITY', 'DISPATCH', 'ADJUST_INVENTORY', 
        'MANAGE_MASTER_DATA', 'ADMIN_ACCESS'
      ]
    };
  }

  async getAuditLogs() {
    // Mock audit logs for now
    return [
      { id: 1, action: 'USER_ROLE_CHANGE', actor: 'Admin', target: 'sergio@jabil.com', timestamp: new Date(), details: 'Role changed to Quality Manager' },
      { id: 2, action: 'MASTER_DATA_UPDATE', actor: 'Admin', target: 'BLDG-01', timestamp: new Date(), details: 'Capacity updated to 1200 units' },
    ];
  }
}
