import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationStatus } from './entities/notification.entity';
import { NotificationLog } from './entities/notification-log.entity';
import { OperationalException, ExceptionSeverity } from './entities/operational-exception.entity';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationLog)
    private readonly logRepo: Repository<NotificationLog>,
    private readonly usersService: UsersService,
  ) {}

  async notifyException(exception: OperationalException, event: 'CREATED' | 'OVERDUE' | 'ESCALATED') {
    const roles = this.getTargetRoles(exception.domain);
    const allUsers = await this.usersService.findAll();
    
    // Hardened Scope Routing: Building, Program, Line
    const recipients = allUsers.filter(user => {
      const hasRole = roles.includes(user.role);
      
      const inBuilding = !exception.buildingId || 
                        !user.scopes?.buildings?.length || 
                        user.scopes.buildings.includes(exception.buildingId);
      
      const inProgram = !exception.programId || 
                       !user.scopes?.programs?.length || 
                       user.scopes.programs.includes(exception.programId);

      const inLine = !exception.lineId || 
                    !user.scopes?.lines?.length || 
                    user.scopes.lines.includes(Number(exception.lineId));

      return hasRole && inBuilding && inProgram && inLine;
    });

    for (const user of recipients) {
      await this.sendAlert(user.email, exception, event);
    }

    if (recipients.length === 0) {
      const admins = allUsers.filter(u => u.role === UserRole.ADMIN);
      for (const admin of admins) {
        await this.sendAlert(admin.email, exception, event);
      }
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
      
      Link: /exception-center (ID: ${exception.id})
    `;

    try {
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

      // 2. Trazabilidad: Notification Log
      await this.logRepo.save(this.logRepo.create({
        exceptionId: exception.id,
        type: event,
        recipient: email,
        channel: 'IN_APP',
        status: 'SENT',
        metadata: { title }
      }));

      // 3. Simulated Email Log
      await this.logRepo.save(this.logRepo.create({
        exceptionId: exception.id,
        type: event,
        recipient: email,
        channel: 'EMAIL',
        status: 'SIMULATED'
      }));

      this.logger.log(`Trace: Notification ${event} for exception ${exception.id} sent to ${email}`);
    } catch (err) {
      this.logger.error(`Failed to log notification for ${email}`, err.stack);
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
