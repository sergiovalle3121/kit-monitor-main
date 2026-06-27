import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { Resupply, ResupplyStatus } from './entities/resupply.entity';
import { KitMaterial } from '../kit-materials/entities/kit-material.entity';
import { Kit } from '../kits/entities/kit.entity';
import { CreateResupplyDto } from './dto/create-resupply.dto';
import { DeliverResupplyDto } from './dto/deliver-resupply.dto';
import { UpdateResupplyStatusDto } from './dto/update-resupply-status.dto';
import { AssignResupplyOwnerDto } from './dto/assign-resupply-owner.dto';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { EnterpriseProgram } from '../enterprise-campus/entities/enterprise-program.entity';
import { EnterpriseLine } from '../enterprise-campus/entities/enterprise-line.entity';
import { InventoryService } from '../inventory/inventory.service';


type ScopeQuery = { line?: string; model?: string; workOrder?: string; buildingId?: string; programId?: string };

@Injectable()
export class ResuppliesService {
  constructor(
    @Inject(getTenantRepositoryToken(Resupply))
    private readonly repo: TenantScopedRepository<Resupply>,
    @InjectRepository(KitMaterial)
    private readonly materialRepo: Repository<KitMaterial>,
    @InjectRepository(EnterpriseProgram) private readonly programRepo: Repository<EnterpriseProgram>,
    @InjectRepository(EnterpriseLine) private readonly lineRepo: Repository<EnterpriseLine>,
    private readonly eventLedger: EventLedgerService,
    private readonly inventory: InventoryService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private applyScope<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
  ): SelectQueryBuilder<T> {
    const tenant = this.tenantCtx.getTenantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    return qb;
  }

  async findByKit(kitId: number, scope?: ScopeQuery): Promise<Resupply[]> {
    const qb = this.repo.createQueryBuilder('resupply')
      .leftJoinAndSelect('resupply.kit', 'kit')
      .leftJoinAndSelect('kit.plan', 'plan')
      .where('kit.id = :kitId', { kitId })
      .orderBy('resupply.requestedAt', 'DESC')
      .take(500);

    this.applyScope(qb, 'resupply');
    await this.applyScopeToQb(qb, scope);
    return qb.getMany();
  }

  async findAll(scope?: ScopeQuery): Promise<Resupply[]> {
    const qb = this.repo.createQueryBuilder('resupply')
      .leftJoinAndSelect('resupply.kit', 'kit')
      .leftJoinAndSelect('kit.plan', 'plan')
      .orderBy('resupply.requestedAt', 'DESC')
      .take(500);
    this.applyScope(qb, 'resupply');
    await this.applyScopeToQb(qb, scope);
    return qb.getMany();
  }

  private async applyScopeToQb(qb: SelectQueryBuilder<Resupply>, scope?: ScopeQuery): Promise<void> {
    if (!scope) return;

    if (scope.model) {
      qb.andWhere('UPPER(plan.model) LIKE :model', { model: `%${scope.model.toUpperCase()}%` });
    }
    if (scope.workOrder) {
      qb.andWhere('UPPER(plan.workOrder) LIKE :workOrder', { workOrder: `%${scope.workOrder.toUpperCase()}%` });
    }
    if (scope.line) {
      const lineRef = await this.lineRepo.findOne({ where: { id: scope.line } });
      const legacyNum = lineRef?.legacyLineNumber ?? parseInt(scope.line, 10);
      if (!isNaN(legacyNum)) {
        qb.andWhere('plan.line = :lineNum', { lineNum: legacyNum });
      }
    }
    if (scope.buildingId) {
      const lines = await this.lineRepo.find({ where: { building: { id: scope.buildingId } } as any });
      const legacyNums = lines.map((l) => l.legacyLineNumber).filter((n): n is number => n != null);
      if (legacyNums.length) {
        qb.andWhere('plan.line IN (:...lineNums)', { lineNums: legacyNums });
      } else {
        qb.andWhere('1 = 0');
      }
    }
    if (scope.programId) {
      const program = await this.programRepo.findOne({ where: { id: scope.programId } });
      const prefix = program?.primaryModelPrefix?.toUpperCase();
      if (prefix) {
        qb.andWhere('UPPER(plan.model) LIKE :prefix', { prefix: `${prefix}%` });
      }
    }
  }

  async findOne(id: number): Promise<Resupply> {
    const item = await this.repo.findOne({ where: { id }, relations: ['kit', 'kit.plan'] });
    if (!item) throw new NotFoundException(`Resupply ${id} not found`);
    return item;
  }

  async create(dto: CreateResupplyDto, actorName: string = 'System'): Promise<Resupply> {
    const resupply = this.repo.create({
      kit: { id: dto.kitId } as Kit,
      partNumber: dto.partNumber,
      description: dto.description,
      quantityRequested: dto.quantityRequested,
      reason: dto.reason,
      priority: (dto as any).priority || 'medium',
    });
    const saved = await this.repo.save(resupply);

    const fullResupply = await this.findOne(saved.id);
    
    await this.eventLedger.recordEvent({
      domain: EventDomain.MATERIALS,
      action: 'RESUPPLY_REQUESTED',
      actorName,
      referenceType: 'RESUPPLY',
      referenceId: saved.id.toString(),
      customer: (fullResupply.kit.plan as any)?.customer,
      program: (fullResupply.kit.plan as any)?.program,
      model: fullResupply.kit.plan?.model,
      workOrder: fullResupply.kit.plan?.workOrder,
      line: fullResupply.kit.plan?.line?.toString(),
      transaction: { quantity: dto.quantityRequested }
    });

    return fullResupply;
  }


  async assignOwner(id: number, dto: AssignResupplyOwnerDto): Promise<Resupply> {
    const current = await this.findOne(id);
    await this.repo.update(id, {
      ownerId: dto.ownerId ?? current.ownerId,
      ownerName: dto.ownerName,
    });

    const updated = await this.findOne(id);

    await this.eventLedger.recordEvent({
      domain: EventDomain.MATERIALS,
      action: 'RESUPPLY_OWNER_ASSIGNED',
      actorName: dto.actorName ?? 'AXOS Dispatcher',
      referenceType: 'RESUPPLY',
      referenceId: id.toString(),
      customer: (updated.kit.plan as any)?.customer,
      program: (updated.kit.plan as any)?.program,
      model: updated.kit.plan?.model,
      workOrder: updated.kit.plan?.workOrder,
      line: updated.kit.plan?.line?.toString(),
      metadata: {
        ownerId: updated.ownerId,
        ownerName: updated.ownerName,
      },
    });

    return updated;
  }

  async updateStatus(id: number, dto: UpdateResupplyStatusDto): Promise<Resupply> {
    const resupply = await this.findOne(id);
    
    const updateData: Partial<Resupply> = { status: dto.status };
    
    // Update warehouse/location if provided in DTO
    if (dto.sourceWarehouseId) updateData.sourceWarehouseId = dto.sourceWarehouseId;
    if (dto.sourceLocation) updateData.sourceLocation = dto.sourceLocation;
    if (dto.destinationWarehouseId) updateData.destinationWarehouseId = dto.destinationWarehouseId;
    if (dto.destinationLocation) updateData.destinationLocation = dto.destinationLocation;

    if (dto.status === 'acknowledged') updateData.acknowledgedAt = new Date();
    if (dto.status === 'pick_started') updateData.pickStartedAt = new Date();
    if (dto.status === 'pick_completed') updateData.pickCompletedAt = new Date();
    if (dto.status === 'delivered') updateData.deliveredAt = new Date();
    if (dto.status === 'confirmed') updateData.confirmedAt = new Date();
    if (dto.status === 'escalated') updateData.escalatedAt = new Date();
    if (dto.status === 'cancelled') updateData.cancelledAt = new Date();

    const qty = dto.quantityDelivered !== undefined ? dto.quantityDelivered : resupply.quantityRequested;
    if (dto.quantityDelivered !== undefined) {
      updateData.quantityDelivered = dto.quantityDelivered;
    }

    // --- INVENTORY INTEGRATION ---
    // Handle physical movements based on status
    try {
      if (dto.status === 'pick_started') {
        // Move from source to 'TRANSIT' (or just log the start of movement)
        await this.inventory.recordTransaction({
          type: 'TRANSFER',
          partNumber: resupply.partNumber,
          quantity: qty,
          fromWarehouseId: dto.sourceWarehouseId || resupply.sourceWarehouseId || 'WH-CENTRAL',
          fromLocation: dto.sourceLocation || resupply.sourceLocation || 'BULK',
          actorName: dto.actorName,
          referenceType: 'RESUPPLY',
          referenceId: id.toString(),
          reason: `Picking started: ${dto.reason || ''}`
        });
      }

      if (dto.status === 'delivered') {
        // Move to destination (Line or Sub-warehouse)
        await this.inventory.recordTransaction({
          type: (dto.destinationWarehouseId || resupply.destinationWarehouseId || '').includes('LINE') ? 'ISSUE' : 'TRANSFER',
          partNumber: resupply.partNumber,
          quantity: qty,
          toWarehouseId: dto.destinationWarehouseId || resupply.destinationWarehouseId || 'WH-LINE',
          toLocation: dto.destinationLocation || resupply.destinationLocation || 'LINE',
          actorName: dto.actorName,
          referenceType: 'RESUPPLY',
          referenceId: id.toString(),
          reason: `Delivered: ${dto.reason || ''}`
        });
      }
    } catch (invErr) {
      // If inventory fails (e.g. no stock), we should probably not update the resupply status
      console.error('Inventory transaction failed for resupply:', invErr);
      throw invErr; 
    }

    await this.repo.update(id, updateData);
    const updated = await this.findOne(id);

    // If delivered or confirmed, update material quantities
    if (dto.status === 'delivered' || dto.status === 'confirmed') {
      await this.updateMaterialQuantities(updated);
    }

    const actionMap: Record<ResupplyStatus, string> = {
      'requested': 'RESUPPLY_REQUESTED',
      'acknowledged': 'RESUPPLY_ACKNOWLEDGED',
      'pick_started': 'RESUPPLY_PICK_STARTED',
      'pick_completed': 'RESUPPLY_PICK_COMPLETED',
      'in_transit': 'RESUPPLY_IN_TRANSIT',
      'delivered': 'RESUPPLY_DELIVERED',
      'confirmed': 'RESUPPLY_CONFIRMED_BY_LINE',
      'escalated': 'RESUPPLY_ESCALATED',
      'cancelled': 'RESUPPLY_CANCELLED',
    };

    await this.eventLedger.recordEvent({
      domain: EventDomain.MATERIALS,
      action: actionMap[dto.status] || `RESUPPLY_STATUS_${dto.status.toUpperCase()}`,
      actorName: dto.actorName,
      referenceType: 'RESUPPLY',
      referenceId: id.toString(),
      customer: (updated.kit.plan as any)?.customer,
      program: (updated.kit.plan as any)?.program,
      model: updated.kit.plan?.model,
      workOrder: updated.kit.plan?.workOrder,
      line: updated.kit.plan?.line?.toString(),
      metadata: { 
        reason: dto.reason,
        source: updated.sourceWarehouseId,
        destination: updated.destinationWarehouseId
      },
      transaction: qty !== undefined ? { quantity: qty } : undefined
    });

    return updated;
  }

  // Legacy compatibility for deliver
  async deliver(id: number, dto: DeliverResupplyDto): Promise<Resupply> {
    return this.updateStatus(id, {
      status: 'delivered',
      quantityDelivered: dto.quantityDelivered,
      actorName: 'System'
    });
  }

  private async updateMaterialQuantities(resupply: Resupply) {
    const allDelivered = await this.repo.find({
      where: { kit: { id: resupply.kit.id }, partNumber: resupply.partNumber },
    });
    
    const totalResupplied = allDelivered.reduce((sum, r) => {
      return (r.status === 'delivered' || r.status === 'confirmed') ? sum + (r.quantityDelivered ?? 0) : sum;
    }, 0);

    const material = await this.materialRepo.findOne({
      where: { kit: { id: resupply.kit.id }, partNumber: resupply.partNumber },
    });
    
    if (material) {
      const quantityRemaining = Math.round(
        ((material.quantityRequired + totalResupplied) - (material.quantityConsumed ?? 0)) * 1e6,
      ) / 1e6;
      await this.materialRepo.update(material.id, {
        quantityResupplied: totalResupplied,
        quantityRemaining,
      });
    }
  }
}
