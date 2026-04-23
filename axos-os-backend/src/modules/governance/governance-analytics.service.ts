import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { OperationalException, ExceptionStatus } from './entities/operational-exception.entity';
import { NotificationLog } from './entities/notification-log.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class GovernanceAnalyticsService {
  constructor(
    @InjectRepository(OperationalException)
    private readonly exceptionRepo: Repository<OperationalException>,
    @InjectRepository(NotificationLog)
    private readonly logRepo: Repository<NotificationLog>,
  ) {}

  async getTrends(user: User, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch exceptions within range with scope
    const qb = this.exceptionRepo.createQueryBuilder('ex')
      .where('ex.createdAt >= :startDate', { startDate });

    this.applyScope(qb, user);
    const exceptions = await qb.getMany();

    // Fetch notification logs (Escalations/Overdue alerts)
    const logQb = this.logRepo.createQueryBuilder('log')
      .where('log.timestamp >= :startDate', { startDate });
    const logs = await logQb.getMany();

    // Group by day
    const trends: Record<string, any> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      trends[key] = { created: 0, overdue: 0, escalated: 0, resolved: 0 };
    }

    exceptions.forEach(ex => {
      const day = ex.createdAt.toISOString().split('T')[0];
      if (trends[day]) {
        trends[day].created++;
        if (ex.status === ExceptionStatus.RESOLVED) trends[day].resolved++;
      }
    });

    logs.forEach(log => {
      const day = log.timestamp.toISOString().split('T')[0];
      if (trends[day]) {
        if (log.type === 'OVERDUE') trends[day].overdue++;
        if (log.type === 'ESCALATED') trends[day].escalated++;
      }
    });

    return Object.entries(trends)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, metrics]) => ({ date, ...metrics }));
  }

  async getDomainAnalytics(user: User) {
    const qb = this.exceptionRepo.createQueryBuilder('ex');
    this.applyScope(qb, user);
    const exceptions = await qb.getMany();

    const domains: Record<string, any> = {};

    exceptions.forEach(ex => {
      const d = ex.domain;
      if (!domains[d]) {
        domains[d] = { count: 0, overdue: 0, escalated: 0, recurrence: 0, totalLeadTime: 0, resolvedCount: 0 };
      }
      domains[d].count++;
      if (ex.dueAt && new Date(ex.dueAt) < new Date() && ex.status !== ExceptionStatus.RESOLVED) {
        domains[d].overdue++;
      }
      if (ex.recurrenceCount > 0) domains[d].recurrence++;
      
      if (ex.resolvedAt && ex.createdAt) {
        const lead = (ex.resolvedAt.getTime() - ex.createdAt.getTime()) / (1000 * 60 * 60);
        domains[d].totalLeadTime += lead;
        domains[d].resolvedCount++;
      }
    });

    return Object.entries(domains).map(([domain, m]: [string, any]) => ({
      domain,
      count: m.count,
      overdueRate: (m.overdue / m.count) * 100,
      recurrenceRate: (m.recurrence / m.count) * 100,
      avgResolutionHours: m.resolvedCount > 0 ? m.totalLeadTime / m.resolvedCount : 0
    }));
  }

  async getOrganizationalFriction(user: User) {
    const qb = this.exceptionRepo.createQueryBuilder('ex');
    this.applyScope(qb, user);
    const exceptions = await qb.getMany();

    const friction = {
      buildings: {} as Record<string, number>,
      programs: {} as Record<string, number>,
      lines: {} as Record<string, number>
    };

    exceptions.forEach(ex => {
      if (ex.status !== ExceptionStatus.RESOLVED) {
        if (ex.buildingId) friction.buildings[ex.buildingId] = (friction.buildings[ex.buildingId] || 0) + 1;
        if (ex.programId) friction.programs[ex.programId] = (friction.programs[ex.programId] || 0) + 1;
        if (ex.lineId) friction.lines[ex.lineId] = (friction.lines[ex.lineId] || 0) + 1;
      }
    });

    return friction;
  }

  private applyScope(qb: any, user: User) {
    if (user.scopes) {
      if (user.scopes.buildings?.length > 0) {
        qb.andWhere('(ex.buildingId IN (:...bids) OR ex.buildingId IS NULL)', { bids: user.scopes.buildings });
      }
      if (user.scopes.programs?.length > 0) {
        qb.andWhere('(ex.programId IN (:...pids) OR ex.programId IS NULL)', { pids: user.scopes.programs });
      }
    }
  }
}
