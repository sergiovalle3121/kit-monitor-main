import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { EnterpriseCampusService } from '../enterprise-campus/enterprise-campus.service';
import { AuditService } from './audit.service';
import {
  ExceptionDomain,
  ExceptionSeverity,
  ExceptionStatus,
} from './entities/operational-exception.entity';
import { User } from '../users/entities/user.entity';
import { NotificationService } from './notification.service';

@Injectable()
export class GovernanceService {
  constructor(
    private readonly usersService: UsersService,
    private readonly campusService: EnterpriseCampusService,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
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
        'Admin',
        'Planner',
        'Materials Lead',
        'Warehouse Operator',
        'Production Supervisor',
        'Quality Engineer',
        'Quality Manager',
        'Shipping Lead',
      ],
      permissions: [
        'RELEASE_WO',
        'APPROVE_QUALITY',
        'DISPATCH',
        'ADJUST_INVENTORY',
        'MANAGE_MASTER_DATA',
        'ADMIN_ACCESS',
      ],
    };
  }

  async getLogs(limit: number) {
    return this.auditService.getLogs(limit);
  }

  async getAuditLogs() {
    return this.auditService.getLogs(100);
  }

  async getMyNotifications(email: string) {
    return this.notificationService.getMyNotifications(email);
  }

  async markNotificationAsRead(id: number, email: string) {
    return this.notificationService.markAsRead(id, email);
  }

  async checkEscalations() {
    return this.auditService.checkEscalations();
  }

  async getExceptions(
    user: User,
    filters: {
      domain?: ExceptionDomain;
      severity?: ExceptionSeverity;
      status?: ExceptionStatus;
    } = {},
  ) {
    return this.auditService.findAllExceptions(user, filters);
  }

  async getExceptionSummary(user: User) {
    return this.auditService.getExceptionRiskSummary(user);
  }

  async updateExceptionStatus(
    id: number,
    status: ExceptionStatus,
    actor: string,
  ) {
    return this.auditService.updateExceptionStatus(id, status, actor);
  }

  async assignException(id: number, actor: string, assignee: string) {
    return this.auditService.assignException(id, actor, assignee);
  }

  async resolveException(
    id: number,
    actor: string,
    params: { reason: string; comments?: string },
  ) {
    return this.auditService.resolveException(id, actor, params);
  }
}
