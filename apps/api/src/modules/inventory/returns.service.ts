import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { MaterialReturn, MaterialReturnStatus } from './entities/material-return.entity';
import { InventoryService } from './inventory.service';
import { AuditService } from '../governance/audit.service';
import { User } from '../users/entities/user.entity';
import { EnterpriseWarehouse } from '../enterprise-campus/entities/enterprise-warehouse.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';

/**
 * Devoluciones de material (return to stock). Entidad y servicio NUEVOS y
 * aditivos. Al confirmar una devolución, el material puede reingresar al
 * inventario vía InventoryService.recordTransaction(type 'RETURN') — método ya
 * expuesto — sin tocar la lógica de inventory.
 */
@Injectable()
export class ReturnsService {
  constructor(
    @Inject(getTenantRepositoryToken(MaterialReturn))
    private readonly returnRepo: TenantScopedRepository<MaterialReturn>,
    @InjectRepository(EnterpriseWarehouse)
    private readonly warehouseRepo: Repository<EnterpriseWarehouse>,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
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

  /** Scope organizacional: limita devoluciones a los almacenes del scope (seesAllAreas = sin buildings → todo). */
  private async applyBuildingScope(qb: SelectQueryBuilder<MaterialReturn>, user: User): Promise<void> {
    const scopeBids = user?.scopes?.buildings ?? [];
    if (scopeBids.length === 0) return;
    const whs = await this.warehouseRepo.find({ where: { building: { id: In(scopeBids) } } as any });
    const whIds = whs.map((w) => w.id);
    if (whIds.length > 0) qb.andWhere('ret.toWarehouseId IN (:...whIds)', { whIds });
    else qb.andWhere('1 = 0');
  }

  async findAll(filters: any, user: User): Promise<MaterialReturn[]> {
    const qb = this.returnRepo.createQueryBuilder('ret');
    this.applyScope(qb, 'ret');
    await this.applyBuildingScope(qb, user);
    if (filters.status) qb.andWhere('ret.status = :status', { status: filters.status });
    if (filters.warehouseId) qb.andWhere('ret.toWarehouseId = :wh', { wh: filters.warehouseId });
    if (filters.partNumber) qb.andWhere('ret.partNumber LIKE :pn', { pn: `%${filters.partNumber}%` });
    qb.orderBy('ret.createdAt', 'DESC');
    return qb.getMany();
  }

  async findOne(id: number, user: User): Promise<MaterialReturn> {
    const ret = await this.returnRepo.findOne({ where: { id } });
    if (!ret) throw new NotFoundException('Devolución no encontrada');
    return ret;
  }

  async create(dto: any, user: User): Promise<MaterialReturn> {
    if (!dto.partNumber) throw new BadRequestException('partNumber requerido');
    if (!dto.toWarehouseId) throw new BadRequestException('Almacén destino (toWarehouseId) requerido');
    const count = await this.returnRepo.count();
    const returnNumber = `RET-2024-${(count + 1).toString().padStart(4, '0')}`;
    const ret = this.returnRepo.create({
      returnNumber,
      status: MaterialReturnStatus.PENDING,
      partNumber: dto.partNumber,
      description: dto.description,
      quantity: Number(dto.quantity) || 0,
      uom: dto.uom,
      batch: dto.batch,
      vendor: dto.vendor,
      project: dto.project,
      fromLocation: dto.fromLocation,
      toWarehouseId: dto.toWarehouseId,
      toLocation: dto.toLocation,
      reason: dto.reason,
      notes: dto.notes,
      restocked: false,
      createdBy: dto.createdBy || user.email,
    });
    const saved = await this.returnRepo.save(ret);

    await this.audit.recordAction({
      actor: user.email,
      action: 'MATERIAL_RETURN_CREATED',
      resourceType: 'MaterialReturn',
      resourceId: saved.returnNumber,
      metadata: { partNumber: saved.partNumber, quantity: saved.quantity, to: saved.toWarehouseId },
      outcome: 'ALLOWED',
    });

    return saved;
  }

  /**
   * Confirma la devolución: intenta reingresar el stock al inventario (aditivo,
   * vía recordTransaction type 'RETURN'). Si el reingreso falla, la devolución
   * queda igualmente registrada como COMPLETED con restocked=false y una nota
   * (no se bloquea el cierre operativo).
   */
  async complete(id: number, actor: string, user: User): Promise<MaterialReturn> {
    const ret = await this.returnRepo.findOne({ where: { id } });
    if (!ret) throw new NotFoundException('Devolución no encontrada');
    if (ret.status === MaterialReturnStatus.COMPLETED) {
      throw new BadRequestException('La devolución ya está confirmada');
    }
    if (ret.status === MaterialReturnStatus.CANCELLED) {
      throw new BadRequestException('No se puede confirmar una devolución cancelada');
    }

    let restocked = false;
    let note: string | undefined;
    try {
      // Asegura la parte en maestro para que el reingreso no falle por falta de ella.
      await this.inventory.ensureMaterial({ partNumber: ret.partNumber, description: ret.description, uom: ret.uom }, user);
      await this.inventory.recordTransaction({
        type: 'RETURN',
        partNumber: ret.partNumber,
        quantity: ret.quantity,
        toWarehouseId: ret.toWarehouseId,
        toLocation: ret.toLocation || 'RETURNS',
        actorName: actor,
        referenceType: 'MATERIAL_RETURN',
        referenceId: ret.returnNumber,
        lotNumber: ret.batch,
        reason: `Return to stock: ${ret.returnNumber}${ret.reason ? ` (${ret.reason})` : ''}`,
      });
      restocked = true;
    } catch (err) {
      note = `Devolución registrada sin reingreso automático: ${(err as Error).message}`;
    }

    ret.status = MaterialReturnStatus.COMPLETED;
    ret.completedBy = actor;
    ret.completedAt = new Date();
    ret.restocked = restocked;
    if (note) ret.notes = [ret.notes, note].filter(Boolean).join(' · ');
    const saved = await this.returnRepo.save(ret);

    await this.audit.recordAction({
      actor: user.email,
      action: 'MATERIAL_RETURN_COMPLETED',
      resourceType: 'MaterialReturn',
      resourceId: saved.returnNumber,
      metadata: { restocked, note },
      outcome: 'ALLOWED',
    });

    return saved;
  }

  async cancel(id: number, actor: string, reason: string | undefined, user: User): Promise<MaterialReturn> {
    const ret = await this.returnRepo.findOne({ where: { id } });
    if (!ret) throw new NotFoundException('Devolución no encontrada');
    if (ret.status === MaterialReturnStatus.COMPLETED) {
      throw new BadRequestException('No se puede cancelar una devolución ya confirmada');
    }
    ret.status = MaterialReturnStatus.CANCELLED;
    ret.completedBy = actor;
    ret.completedAt = new Date();
    if (reason) ret.notes = [ret.notes, `Cancelada: ${reason}`].filter(Boolean).join(' · ');
    const saved = await this.returnRepo.save(ret);

    await this.audit.recordAction({
      actor: user.email,
      action: 'MATERIAL_RETURN_CANCELLED',
      resourceType: 'MaterialReturn',
      resourceId: saved.returnNumber,
      metadata: { reason: reason ?? null },
      outcome: 'ALLOWED',
    });

    return saved;
  }
}
