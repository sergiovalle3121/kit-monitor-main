import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationStatus } from './entities/notification.entity';
import { OperationalException, ExceptionSeverity } from './entities/operational-exception.entity';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly usersService: UsersService,
  ) {}

  async notifyException(exception: OperationalException, event: 'CREATED' | 'OVERDUE' | 'ESCALATED') {
    const roles = this.getTargetRoles(exception.domain);
    const users = await this.usersService.findAll();
    
    // Filter users by role and scope
    const recipients = users.filter(user => {
      const hasRole = roles.includes(user.role);
      const inScope = !exception.buildingId || 
                     !user.scopes?.buildings || 
                     user.scopes.buildings.includes(exception.buildingId);
      return hasRole && inScope;
    });

    for (const user of recipients) {
      await this.sendAlert(user.email, exception, event);
    }

    if (recipients.length === 0) {
      // Fallback to Admins if no specific role found in scope
      const admins = users.filter(u => u.role === UserRole.ADMIN);
      for (const admin of admins) {
        await this.sendAlert(admin.email, exception, event);
      }
    }
  }

  private getTargetRoles(domain: string): UserRole[] {
    switch (domain) {
      case 'QUALITY': return [UserRole.QUALITY_MANAGER, UserRole.QUALITY_ENGINEER];
      case 'INVENTORY':
      case 'WAREHOUSE': return [UserRole.MATERIALS_LEAD, UserRole.WAREHOUSE_OPERATOR];
      case 'PRODUCTION': return [UserRole.PRODUCTION_SUPERVISOR];
      case 'PLANNING': return [UserRole.PLANNER];
      case 'SHIPPING': return [UserRole.SHIPPING_LEAD];
      default: return [UserRole.ADMIN];
    }
  }

  private async sendAlert(email: string, exception: OperationalException, event: string) {
    const title = `[AXOS ALERT] ${event}: ${exception.severity} Exception in ${exception.domain}`;
    const message = `
      Event: ${event}
      Title: ${exception.title}
      Severity: ${exception.severity}
      Status: ${exception.status}
      Domain: ${exception.domain}
      Location: Building ${exception.buildingId || 'N/A'}, Line ${exception.lineId || 'N/A'}
      SLA Due: ${exception.dueAt ? new Date(exception.dueAt).toLocaleString() : 'N/A'}
      
      Link: /exception-center (ID: ${exception.id})
    `;

    // 1. In-App Notification
    await this.notificationRepo.save(
      this.notificationRepo.create({
        recipient: email,
        title,
        message,
        exceptionId: exception.id,
        metadata: { event, severity: exception.severity }
      })
    );

    // 2. Simulated Email
    this.logger.log(`SIMULATED EMAIL SENT to ${email}: ${title}`);
  }

  async getMyNotifications(email: string) {
    return this.notificationRepo.find({
      where: { recipient: email },
      order: { createdAt: 'DESC' },
      take: 50
    });
  }

  async markAsRead(id: number, email: string) {
    await this.notificationRepo.update({ id, recipient: email }, { status: NotificationStatus.READ });
  }
}
