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
    const exception = this.exceptionRepo.create({
      ...params,
      status: params.status || ExceptionStatus.OPEN,
      severity: params.severity || ExceptionSeverity.MEDIUM
    });
    return this.exceptionRepo.save(exception);
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

    qb.orderBy('ex.createdAt', 'DESC');
    return qb.getMany();
  }

  async updateExceptionStatus(id: number, status: ExceptionStatus, actor: string) {
    const ex = await this.exceptionRepo.findOne({ where: { id } });
    if (!ex) return null;
    
    ex.status = status;
    // Log the change in metadata or a separate trail if needed
    if (!ex.metadata) ex.metadata = {};
    ex.metadata.resolvedBy = actor;
    ex.metadata.resolvedAt = new Date();
    
    return this.exceptionRepo.save(ex);
  }

  async getLogs(limit = 100) {
    return this.auditRepo.find({
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }
}
