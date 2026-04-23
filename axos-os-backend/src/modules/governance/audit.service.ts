import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
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
    return this.log({
      actor: params.actor,
      action: params.action,
      entity: params.resourceType,
      entityId: params.resourceId,
      after: params.metadata,
      result: params.outcome,
      reason: params.reason
    });
  }

  async getLogs(limit = 100) {
    return this.auditRepo.find({
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }
}
