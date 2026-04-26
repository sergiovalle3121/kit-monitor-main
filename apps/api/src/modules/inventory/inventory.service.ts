import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { InventoryPosition } from './entities/inventory-position.entity';
import { InventoryMovement, InventoryTransactionType } from './entities/inventory-movement.entity';
import { MaterialMaster } from './entities/material-master.entity';
import { EnterpriseWarehouse } from '../enterprise-campus/entities/enterprise-warehouse.entity';
import { AuditService } from '../governance/audit.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { ExceptionSeverity, ExceptionDomain } from '../governance/entities/operational-exception.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryPosition)
    private readonly positionRepo: Repository<InventoryPosition>,
    @InjectRepository(InventoryMovement)
    private readonly movementRepo: Repository<InventoryMovement>,
    @InjectRepository(MaterialMaster)
    private readonly materialRepo: Repository<MaterialMaster>,
    @InjectRepository(EnterpriseWarehouse)
    private readonly warehouseRepo: Repository<EnterpriseWarehouse>,
    private readonly audit: AuditService,
    private readonly tenantContext: TenantContextService,
    private readonly dataSource: DataSource,
  ) {}

  // ── Positions ────────────────────────────────────────────────────────────

  async findAllPositions(filters: {
    warehouseId?: string;
    partNumber?: string;
    programId?: string;
    holdStatus?: string;
  }): Promise<InventoryPosition[]> {
    const qb = this.positionRepo
      .createQueryBuilder('pos')
      .leftJoinAndSelect('pos.material', 'material')
      .leftJoinAndSelect('pos.warehouse', 'warehouse');

    // 1. Tenant isolation
    const tenantId = this.tenantContext.getTenantId();
    if (tenantId) qb.andWhere('pos.tenant_id = :tenantId', { tenantId });

    // 2. Building-level organizational scope
    const allowedBuildings = this.tenantContext.getAllowedBuildingIds();
    if (allowedBuildings.length > 0) {
      const whIds = await this.resolveWarehouseIdsByBuildings(allowedBuildings);
      whIds.length > 0
        ? qb.andWhere('pos.warehouseId IN (:...scopeWhIds)', { scopeWhIds: whIds })
        : qb.andWhere('1 = 0');
    }

    if (filters.warehouseId) qb.andWhere('pos.warehouseId = :wh', { wh: filters.warehouseId });
    if (filters.partNumber) qb.andWhere('pos.partNumber LIKE :pn', { pn: `%${filters.partNumber}%` });
    if (filters.programId) qb.andWhere('pos.programId = :prog', { prog: filters.programId });
    if (filters.holdStatus) qb.andWhere('pos.holdStatus = :hs', { hs: filters.holdStatus });

    return qb.orderBy('pos.updatedAt', 'DESC').getMany();
  }

  async getMovements(filters: {
    partNumber?: string;
    warehouseId?: string;
    type?: string;
    limit?: number;
  }): Promise<InventoryMovement[]> {
    const qb = this.movementRepo.createQueryBuilder('mov');

    // 1. Tenant isolation
    const tenantId = this.tenantContext.getTenantId();
    if (tenantId) qb.andWhere('mov.tenant_id = :tenantId', { tenantId });

    // 2. Building-level organizational scope
    const allowedBuildings = this.tenantContext.getAllowedBuildingIds();
    if (allowedBuildings.length > 0) {
      const whIds = await this.resolveWarehouseIdsByBuildings(allowedBuildings);
      whIds.length > 0
        ? qb.andWhere(
            '(mov.fromWarehouseId IN (:...scopeWhIds) OR mov.toWarehouseId IN (:...scopeWhIds))',
            { scopeWhIds: whIds },
          )
        : qb.andWhere('1 = 0');
    }

    if (filters.partNumber) qb.andWhere('mov.partNumber = :pn', { pn: filters.partNumber });
    if (filters.warehouseId)
      qb.andWhere('(mov.fromWarehouseId = :wh OR mov.toWarehouseId = :wh)', { wh: filters.warehouseId });
    if (filters.type) qb.andWhere('mov.type = :type', { type: filters.type });

    return qb
      .orderBy('mov.createdAt', 'DESC')
      .limit(filters.limit ?? 100)
      .getMany();
  }

  // ── Material master ───────────────────────────────────────────────────────

  async findAllMaterials(filters: { category?: string; search?: string }): Promise<MaterialMaster[]> {
    const qb = this.materialRepo.createQueryBuilder('m');

    const tenantId = this.tenantContext.getTenantId();
    if (tenantId) qb.andWhere('m.tenant_id = :tenantId', { tenantId });

    if (filters.category) qb.andWhere('m.category = :cat', { cat: filters.category });
    if (filters.search)
      qb.andWhere('(m.partNumber LIKE :s OR m.description LIKE :s)', { s: `%${filters.search}%` });

    return qb.orderBy('m.partNumber', 'ASC').getMany();
  }

  async ensureMaterial(dto: Partial<MaterialMaster>): Promise<MaterialMaster> {
    if (!dto.partNumber) throw new BadRequestException('partNumber required');

    const tenantId = this.tenantContext.getTenantId();
    let m = await this.materialRepo.findOne({ where: { partNumber: dto.partNumber } });

    if (!m) {
      m = this.materialRepo.create({
        partNumber: dto.partNumber,
        description: dto.description || `Part ${dto.partNumber}`,
        uom: dto.uom || 'EA',
        tenant_id: tenantId,
        organization_id: this.tenantContext.getOrganizationId(),
      });
      const saved = await this.materialRepo.save(m);
      await this.audit.recordAction({
        actor: this.tenantContext.getUserEmail(),
        action: 'MATERIAL_MASTER_CREATED',
        resourceType: 'MaterialMaster',
        resourceId: saved.partNumber,
        outcome: 'ALLOWED',
      });
      return saved;
    }
    return m;
  }

  // ── Transactions ─────────────────────────────────────────────────────────

  async recordTransaction(dto: {
    type: InventoryTransactionType;
    partNumber: string;
    quantity: number;
    fromWarehouseId?: string;
    toWarehouseId?: string;
    fromLocation?: string;
    toLocation?: string;
    programId?: string;
    actorName?: string;
    referenceType?: string;
    referenceId?: string;
    reason?: string;
    holdStatus?: InventoryPosition['holdStatus'];
    lotNumber?: string;
    serialNumber?: string;
  }): Promise<InventoryMovement> {
    const tenantId = this.tenantContext.getTenantId();
    const actor = dto.actorName ?? this.tenantContext.getUserEmail();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const material = await this.materialRepo.findOne({ where: { partNumber: dto.partNumber } });
      if (!material) throw new NotFoundException(`Material ${dto.partNumber} not found in Master Data`);

      // Debit source
      if (dto.fromWarehouseId) {
        const sourcePos = await queryRunner.manager.findOne(InventoryPosition, {
          where: {
            partNumber: dto.partNumber,
            warehouseId: dto.fromWarehouseId,
            location: dto.fromLocation || 'BULK',
            programId: dto.programId,
            lotNumber: dto.lotNumber,
            serialNumber: dto.serialNumber,
          },
        });

        if (!sourcePos || sourcePos.onHand < dto.quantity) {
          await this.audit.recordException({
            severity: ExceptionSeverity.HIGH,
            domain: ExceptionDomain.INVENTORY,
            title: `Insufficient Stock: ${dto.partNumber}`,
            description: `Attempted to move ${dto.quantity} from ${dto.fromWarehouseId} but only ${sourcePos?.onHand ?? 0} available.`,
            actor,
            resourceType: 'InventoryPosition',
            resourceId: dto.partNumber,
            metadata: { warehouseId: dto.fromWarehouseId, requested: dto.quantity, available: sourcePos?.onHand ?? 0 },
          });
          throw new BadRequestException(`Insufficient stock in ${dto.fromWarehouseId} for ${dto.partNumber}`);
        }

        if (sourcePos.holdStatus !== 'available') {
          await this.audit.recordException({
            severity: ExceptionSeverity.CRITICAL,
            domain: ExceptionDomain.INVENTORY,
            title: `Movement Blocked: ${dto.partNumber}`,
            description: `Attempted to move material with status '${sourcePos.holdStatus}'.`,
            actor,
            resourceType: 'InventoryPosition',
            resourceId: dto.partNumber,
            metadata: { warehouseId: dto.fromWarehouseId, status: sourcePos.holdStatus },
          });
          throw new BadRequestException(
            `Material ${dto.partNumber} is in status '${sourcePos.holdStatus}'. Movement BLOCKED.`,
          );
        }

        sourcePos.onHand -= dto.quantity;
        await queryRunner.manager.save(sourcePos);
      }

      // Credit destination
      if (dto.toWarehouseId) {
        let destPos = await queryRunner.manager.findOne(InventoryPosition, {
          where: {
            partNumber: dto.partNumber,
            warehouseId: dto.toWarehouseId,
            location: dto.toLocation || 'BULK',
            programId: dto.programId,
            lotNumber: dto.lotNumber,
            serialNumber: dto.serialNumber,
          },
        });

        if (!destPos) {
          destPos = queryRunner.manager.create(InventoryPosition, {
            partNumber: dto.partNumber,
            warehouseId: dto.toWarehouseId,
            location: dto.toLocation || 'BULK',
            programId: dto.programId,
            lotNumber: dto.lotNumber,
            serialNumber: dto.serialNumber,
            onHand: 0,
            holdStatus: dto.holdStatus ?? 'available',
            tenant_id: tenantId,
            organization_id: this.tenantContext.getOrganizationId(),
            plant_id: this.tenantContext.getPlantId(),
          });
        } else {
          if (dto.holdStatus) destPos.holdStatus = dto.holdStatus;
        }

        destPos.onHand += dto.quantity;
        await queryRunner.manager.save(destPos);
      }

      const movement = queryRunner.manager.create(InventoryMovement, {
        ...dto,
        actorName: actor,
        tenant_id: tenantId,
        organization_id: this.tenantContext.getOrganizationId(),
        plant_id: this.tenantContext.getPlantId(),
      });
      const savedMovement = await queryRunner.manager.save(movement);

      await this.audit.recordAction({
        actor,
        action: `INVENTORY_${dto.type}`,
        resourceType: 'InventoryPosition',
        resourceId: dto.partNumber,
        metadata: {
          quantity: dto.quantity,
          from: dto.fromWarehouseId,
          to: dto.toWarehouseId,
          reference: `${dto.referenceType}:${dto.referenceId}`,
          tenant_id: tenantId,
        },
        outcome: 'ALLOWED',
      });

      await queryRunner.commitTransaction();
      return savedMovement;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ── Shared helpers ────────────────────────────────────────────────────────

  async resolveWarehouseIdsByBuildings(buildingIds: string[]): Promise<string[]> {
    if (buildingIds.length === 0) return [];
    const whs = await this.warehouseRepo.find({
      where: { building: { id: In(buildingIds) } } as any,
    });
    return whs.map((w) => w.id);
  }
}
