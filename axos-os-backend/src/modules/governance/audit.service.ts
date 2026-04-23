import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { OperationalException, ExceptionSeverity, ExceptionDomain, ExceptionStatus } from './entities/operational-exception.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(OperationalException)
    private readonly exceptionRepo: Repository<OperationalException>,
  ) {}

  async log(params: {
    actor: string;
    action: string;
    entity: string;
    entityId?: string;
    before?: any;
    after?: any;
    result?: 'ALLOWED' | 'DENIED';
    reason?: string;
    scope?: any;
  }) {
    const entry = this.auditRepo.create({
      ...params,
      result: params.result || 'ALLOWED',
    });
    return this.auditRepo.save(entry);
  }

  async recordAction(params: {
    actor: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    metadata?: any;
    outcome?: 'ALLOWED' | 'DENIED';
    reason?: string;
  }) {
    const log = await this.log({
      actor: params.actor,
      action: params.action,
      entity: params.resourceType,
      entityId: params.resourceId,
      after: params.metadata,
      result: params.outcome,
      reason: params.reason
    });

    // AUTOMATION: Create Exception for Denied Actions
    if (params.outcome === 'DENIED') {
      await this.recordException({
        severity: ExceptionSeverity.CRITICAL,
        domain: ExceptionDomain.GOVERNANCE,
        title: `Access Denied: ${params.action}`,
        description: params.reason || `User ${params.actor} attempted unauthorized ${params.action} on ${params.resourceType} ${params.resourceId}`,
        actor: params.actor,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        auditLogId: log.id,
        metadata: params.metadata
      });
    }

    return log;
  }

  async recordException(params: Partial<OperationalException>) {
    const severity = params.severity || ExceptionSeverity.MEDIUM;
    const dueAt = this.calculateSlaDueAt(severity);
    
    const exception = this.exceptionRepo.create({
      ...params,
      status: params.status || ExceptionStatus.OPEN,
      severity,
      dueAt,
      managementTimeline: [{
        action: 'CREATED',
        actor: params.actor || 'SYSTEM',
        timestamp: new Date(),
        note: `Initial detection: ${params.title}`
      }]
    });
    return this.exceptionRepo.save(exception);
  }

  private calculateSlaDueAt(severity: ExceptionSeverity): Date {
    const now = new Date();
    const hoursMap: Record<ExceptionSeverity, number> = {
      [ExceptionSeverity.CRITICAL]: 1,
      [ExceptionSeverity.HIGH]: 4,
      [ExceptionSeverity.MEDIUM]: 24,
      [ExceptionSeverity.LOW]: 48
    };
    const hours = hoursMap[severity] || 24;
    return new Date(now.getTime() + hours * 60 * 60 * 1000);
  }

  async findAllExceptions(user: User, filters: { domain?: ExceptionDomain, severity?: ExceptionSeverity, status?: ExceptionStatus } = {}) {
    const qb = this.exceptionRepo.createQueryBuilder('ex');

    // 1. Mandatory Organizational Scope
    if (user.scopes) {
      if (user.scopes.buildings?.length > 0) {
        qb.andWhere('(ex.buildingId IN (:...bids) OR ex.buildingId IS NULL)', { bids: user.scopes.buildings });
      }
      if (user.scopes.programs?.length > 0) {
        qb.andWhere('(ex.programId IN (:...pids) OR ex.programId IS NULL)', { pids: user.scopes.programs });
      }
    }

    if (filters.domain) qb.andWhere('ex.domain = :domain', { domain: filters.domain });
    if (filters.severity) qb.andWhere('ex.severity = :severity', { severity: filters.severity });
    if (filters.status) qb.andWhere('ex.status = :status', { status: filters.status });

    const list = await qb.getMany();
    const now = new Date();

    // 2. INDUSTRIAL PRIORITIZATION LOGIC
    // Sort logic: 
    // - CRITICAL + OVERDUE -> 0
    // - CRITICAL           -> 1
    // - HIGH + OVERDUE     -> 2
    // - HIGH               -> 3
    // - MEDIUM/LOW         -> 4
    // - RESOLVED           -> 5
    const getPriority = (ex: OperationalException) => {
      if (ex.status === ExceptionStatus.RESOLVED) return 100;
      const isOverdue = ex.dueAt && new Date(ex.dueAt) < now;
      
      if (ex.severity === ExceptionSeverity.CRITICAL) return isOverdue ? 0 : 1;
      if (ex.severity === ExceptionSeverity.HIGH) return isOverdue ? 2 : 3;
      if (ex.severity === ExceptionSeverity.MEDIUM) return 4;
      return 5;
    };

    return list.sort((a, b) => {
      const pA = getPriority(a);
      const pB = getPriority(b);
      if (pA !== pB) return pA - pB;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  async getExceptionRiskSummary(user: User) {
    const exceptions = await this.findAllExceptions(user);
    const now = new Date();

    const summary = {
      bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
      byDomain: {} as Record<string, number>,
      overdueCount: 0,
      recurrenceCount: 0,
      totalOpen: 0,
      highFrictionLocations: [] as any[]
    };

    exceptions.forEach(ex => {
      if (ex.status !== ExceptionStatus.RESOLVED) {
        summary.totalOpen++;
        summary.bySeverity[ex.severity]++;
        summary.byDomain[ex.domain] = (summary.byDomain[ex.domain] || 0) + 1;
        
        if (ex.dueAt && new Date(ex.dueAt) < now) {
          summary.overdueCount++;
        }
        
        if (ex.recurrenceCount > 0) {
          summary.recurrenceCount++;
        }
      }
    });

    const locations = new Map<string, number>();
    exceptions.forEach(ex => {
      if (ex.status !== ExceptionStatus.RESOLVED) {
        const locKey = ex.buildingId || 'Global';
        locations.set(locKey, (locations.get(locKey) || 0) + 1);
      }
    });

    summary.highFrictionLocations = Array.from(locations.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ id, count }));

    return summary;
  }

  async acknowledgeException(id: number, actor: string) {
    const ex = await this.exceptionRepo.findOne({ where: { id } });
    if (!ex) return null;

    ex.status = ExceptionStatus.ACKNOWLEDGED;
    ex.acknowledgedBy = actor;
    ex.acknowledgedAt = new Date();
    ex.assignee = actor; // Auto-assign to acknowledger if no assignee

    if (!ex.managementTimeline) ex.managementTimeline = [];
    ex.managementTimeline.push({
      action: 'ACKNOWLEDGED',
      actor,
      timestamp: new Date(),
      note: 'Exception acknowledged by operator'
    });

    return this.exceptionRepo.save(ex);
  }

  async resolveException(id: number, actor: string, params: { reason: string, comments?: string }) {
    const ex = await this.exceptionRepo.findOne({ where: { id } });
    if (!ex) return null;

    ex.status = ExceptionStatus.RESOLVED;
    ex.resolvedBy = actor;
    ex.resolvedAt = new Date();
    ex.resolutionReason = params.reason;
    ex.resolutionComments = params.comments;

    if (!ex.managementTimeline) ex.managementTimeline = [];
    ex.managementTimeline.push({
      action: 'RESOLVED',
      actor,
      timestamp: new Date(),
      note: `Resolved: ${params.reason}. ${params.comments || ''}`
    });

    return this.exceptionRepo.save(ex);
  }

  async assignException(id: number, actor: string, assignee: string) {
    const ex = await this.exceptionRepo.findOne({ where: { id } });
    if (!ex) return null;

    ex.assignee = assignee;
    if (!ex.managementTimeline) ex.managementTimeline = [];
    ex.managementTimeline.push({
      action: 'ASSIGNED',
      actor,
      timestamp: new Date(),
      note: `Assigned to ${assignee}`
    });

    return this.exceptionRepo.save(ex);
  }

  async reopenException(id: number, actor: string, note?: string) {
    const ex = await this.exceptionRepo.findOne({ where: { id } });
    if (!ex) return null;

    ex.status = ExceptionStatus.OPEN;
    ex.recurrenceCount = (ex.recurrenceCount || 0) + 1;
    
    if (!ex.managementTimeline) ex.managementTimeline = [];
    ex.managementTimeline.push({
      action: 'REOPENED',
      actor,
      timestamp: new Date(),
      note: note || 'Exception reopened for further review'
    });

    return this.exceptionRepo.save(ex);
  }

  async updateExceptionStatus(id: number, status: ExceptionStatus, actor: string) {
    if (status === ExceptionStatus.ACKNOWLEDGED) return this.acknowledgeException(id, actor);
    if (status === ExceptionStatus.RESOLVED) return this.resolveException(id, actor, { reason: 'Status updated via bulk action' });
    if (status === ExceptionStatus.OPEN) return this.reopenException(id, actor);
    return null;
  }

  async getLogs(limit = 100) {
    return this.auditRepo.find({
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }
}
