import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resupply, ResupplyStatus } from './entities/resupply.entity';
import { KitMaterial } from '../kit-materials/entities/kit-material.entity';
import { Kit } from '../kits/entities/kit.entity';
import { CreateResupplyDto } from './dto/create-resupply.dto';
import { DeliverResupplyDto } from './dto/deliver-resupply.dto';
import { UpdateResupplyStatusDto } from './dto/update-resupply-status.dto';
import { AssignResupplyOwnerDto } from './dto/assign-resupply-owner.dto';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';

@Injectable()
export class ResuppliesService {
  constructor(
    @InjectRepository(Resupply)
    private readonly repo: Repository<Resupply>,
    @InjectRepository(KitMaterial)
    private readonly materialRepo: Repository<KitMaterial>,
    private readonly eventLedger: EventLedgerService,
  ) {}

  findByKit(kitId: number): Promise<Resupply[]> {
    return this.repo.find({
      where: { kit: { id: kitId } },
      relations: ['kit', 'kit.plan'],
      order: { requestedAt: 'DESC' },
    });
  }

  findAll(): Promise<Resupply[]> {
    return this.repo.find({
      relations: ['kit', 'kit.plan'],
      order: { requestedAt: 'DESC' },
      take: 500,
    });
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
    
    if (dto.status === 'acknowledged') updateData.acknowledgedAt = new Date();
    if (dto.status === 'pick_started') updateData.pickStartedAt = new Date();
    if (dto.status === 'pick_completed') updateData.pickCompletedAt = new Date();
    if (dto.status === 'delivered') updateData.deliveredAt = new Date();
    if (dto.status === 'confirmed') updateData.confirmedAt = new Date();
    if (dto.status === 'escalated') updateData.escalatedAt = new Date();
    if (dto.status === 'cancelled') updateData.cancelledAt = new Date();

    if (dto.quantityDelivered !== undefined) {
      updateData.quantityDelivered = dto.quantityDelivered;
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
      metadata: { reason: dto.reason },
      transaction: dto.quantityDelivered !== undefined ? { quantity: dto.quantityDelivered } : undefined
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
