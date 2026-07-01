import { Injectable, NotFoundException, BadRequestException, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { InventoryPosition } from './entities/inventory-position.entity';
import { InventoryMovement, InventoryTransactionType } from './entities/inventory-movement.entity';
import {
  LINE_STOCK_LOCATION,
  lineStockWarehouse,
  isLineStockWarehouse,
} from './line-stock';
import { MaterialMaster } from './entities/material-master.entity';
import { EnterpriseWarehouse } from '../enterprise-campus/entities/enterprise-warehouse.entity';
import { AuditService } from '../governance/audit.service';
import { User } from '../users/entities/user.entity';
import { In, IsNull } from 'typeorm';
import { ExceptionSeverity, ExceptionDomain } from '../governance/entities/operational-exception.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @Inject(getTenantRepositoryToken(InventoryPosition))
    private readonly positionRepo: TenantScopedRepository<InventoryPosition>,
    @Inject(getTenantRepositoryToken(InventoryMovement))
    private readonly movementRepo: TenantScopedRepository<InventoryMovement>,
    @Inject(getTenantRepositoryToken(MaterialMaster))
    private readonly materialRepo: TenantScopedRepository<MaterialMaster>,
    @InjectRepository(EnterpriseWarehouse)
    private readonly warehouseRepo: Repository<EnterpriseWarehouse>,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
    private readonly tenantCtx: TenantContextService,
  ) {}

  /**
   * Deposita material en el "tanque" de una línea: `LINE-<línea>` /
   * `LINE_STOCK_LOCATION`, vía `recordTransaction` (tipo ISSUE: WH→Producción).
   * Es el punto único que usa el surtido para abastecer el tanque del que luego
   * el operador consume en /operador (cerrar el lazo de inventario).
   *
   * - `recordTransaction` crea la posición destino si no existe (sin migración).
   * - Sin línea o sin cantidad → NO mueve a un almacén inexistente: lo registra
   *   de forma visible y devuelve `deposited: false`.
   * - Un fallo de inventario se PROPAGA (no se traga en silencio).
   */
  async issueToLine(opts: {
    partNumber: string | null | undefined;
    quantity: number | null | undefined;
    line: number | string | null | undefined;
    actorName: string;
    referenceType?: string;
    referenceId?: string;
    reason?: string;
  }): Promise<{ deposited: boolean; warehouseId: string | null }> {
    const qty = opts.quantity ?? 0;
    if (!opts.partNumber || qty <= 0) {
      return { deposited: false, warehouseId: null };
    }

    const warehouseId = lineStockWarehouse(opts.line);
    if (!warehouseId) {
      this.logger.warn(
        `Surtido sin línea: se omite el depósito de inventario a un almacén de ` +
          `línea inexistente (parte ${opts.partNumber}, ${qty}).`,
      );
      return { deposited: false, warehouseId: null };
    }

    await this.recordTransaction({
      type: 'ISSUE',
      partNumber: opts.partNumber,
      quantity: qty,
      toWarehouseId: warehouseId,
      toLocation: LINE_STOCK_LOCATION,
      actorName: opts.actorName,
      referenceType: opts.referenceType,
      referenceId: opts.referenceId,
      reason: opts.reason,
    });
    return { deposited: true, warehouseId };
  }

  /**
   * Surtido CONSERVATIVO al tanque de línea `LINE-<línea>`.
   *
   * A diferencia de `issueToLine` (un ISSUE que sólo ACREDITA el tanque y por
   * tanto "crea" existencias de la nada, inflando el on-hand global), aquí se
   * DEBITA stock real de los almacenes que ya lo tienen y se ACREDITA en el
   * tanque, vía `TRANSFER`: el on-hand global se conserva (lo que entra a la
   * línea sale de un almacén de origen).
   *
   * Selección del origen — "greedy" sobre existencias reales:
   *  - posiciones `available` de la parte, EXCLUYENDO los tanques `LINE-*` (no se
   *    surte una línea desde otra) y sólo "planas" (sin programId/lote/serie),
   *    para que origen y destino compartan la misma llave de posición y el
   *    `TRANSFER` sea atómico;
   *  - se consume en orden FIFO (createdAt, luego id) repartiendo entre varias
   *    posiciones hasta cubrir la cantidad;
   *  - si las existencias reales no alcanzan, se PROPAGA un error (no se inventa
   *    inventario): el surtido falla de forma visible.
   *
   * Sin línea o sin cantidad → registra y omite (igual que `issueToLine`). La
   * lectura de orígenes usa el repo tenant-scoped (respeta el tenant actual).
   */
  async transferToLine(opts: {
    partNumber: string | null | undefined;
    quantity: number | null | undefined;
    line: number | string | null | undefined;
    actorName: string;
    referenceType?: string;
    referenceId?: string;
    reason?: string;
  }): Promise<{
    deposited: boolean;
    warehouseId: string | null;
    sources: { warehouseId: string; location: string; quantity: number }[];
  }> {
    const qty = this.round6(opts.quantity ?? 0);
    if (!opts.partNumber || qty <= 0) {
      return { deposited: false, warehouseId: null, sources: [] };
    }

    const warehouseId = lineStockWarehouse(opts.line);
    if (!warehouseId) {
      this.logger.warn(
        `Surtido sin línea: se omite el depósito de inventario a un almacén de ` +
          `línea inexistente (parte ${opts.partNumber}, ${qty}).`,
      );
      return { deposited: false, warehouseId: null, sources: [] };
    }

    // Orígenes candidatos: existencias REALES disponibles de la parte —
    // `available`, planas (sin programId/lote/serie) y NO en un tanque de línea —
    // ordenadas FIFO. El reparto agota cada posición antes de pasar a la
    // siguiente.
    const candidates = (
      await this.positionRepo.find({
        where: {
          partNumber: opts.partNumber,
          holdStatus: 'available',
          programId: IsNull(),
          lotNumber: IsNull(),
          serialNumber: IsNull(),
        },
        order: { createdAt: 'ASC', id: 'ASC' },
      })
    ).filter(
      (p) => !isLineStockWarehouse(p.warehouseId) && this.spareOnHand(p) > 0,
    );

    const totalAvailable = this.round6(
      candidates.reduce((sum, p) => sum + this.spareOnHand(p), 0),
    );
    if (totalAvailable + 1e-9 < qty) {
      throw new BadRequestException(
        `Existencias reales insuficientes para surtir ${opts.partNumber} a ` +
          `${warehouseId}: se requieren ${qty}, disponibles ${totalAvailable} ` +
          `(excluyendo tanques de línea).`,
      );
    }

    let remaining = qty;
    const sources: {
      warehouseId: string;
      location: string;
      quantity: number;
    }[] = [];
    for (const pos of candidates) {
      if (remaining <= 0) break;
      const take = this.round6(Math.min(remaining, this.spareOnHand(pos)));
      if (take <= 0) continue;
      await this.recordTransaction({
        type: 'TRANSFER',
        partNumber: opts.partNumber,
        quantity: take,
        fromWarehouseId: pos.warehouseId,
        fromLocation: pos.location,
        toWarehouseId: warehouseId,
        toLocation: LINE_STOCK_LOCATION,
        actorName: opts.actorName,
        referenceType: opts.referenceType,
        referenceId: opts.referenceId,
        reason: opts.reason,
      });
      sources.push({
        warehouseId: pos.warehouseId,
        location: pos.location,
        quantity: take,
      });
      remaining = this.round6(remaining - take);
    }

    return { deposited: true, warehouseId, sources };
  }

  /** Existencias libres (on-hand menos lo asignado) de una posición, sin negativos. */
  private spareOnHand(pos: { onHand?: number; allocated?: number }): number {
    return Math.max(
      0,
      this.round6((Number(pos.onHand) || 0) - (Number(pos.allocated) || 0)),
    );
  }

  private round6(value: number): number {
    return Math.round((Number(value) || 0) * 1e6) / 1e6;
  }

  private applyScope<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
  ): SelectQueryBuilder<T> {
    const tenant = this.tenantCtx.getTenantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    return qb;
  }

  async findAllPositions(user: User, filters: { warehouseId?: string; partNumber?: string; programId?: string; location?: string }): Promise<InventoryPosition[]> {
    const qb = this.positionRepo.createQueryBuilder('pos')
      .leftJoinAndSelect('pos.material', 'material')
      .leftJoinAndSelect('pos.warehouse', 'warehouse');
    this.applyScope(qb, 'pos');

    // 1. Mandatory Organizational Scope
    const scopeBuildingIds = user.scopes?.buildings ?? [];
    if (scopeBuildingIds.length > 0) {
      const whs = await this.warehouseRepo.find({ where: { building: { id: In(scopeBuildingIds) } } as any });
      const whIds = whs.map(w => w.id);
      if (whIds.length > 0) {
        qb.andWhere('pos.warehouseId IN (:...scopeWhIds)', { scopeWhIds: whIds });
      } else {
        qb.andWhere('1 = 0');
      }
    }

    if (filters.warehouseId) qb.andWhere('pos.warehouseId = :wh', { wh: filters.warehouseId });
    if (filters.partNumber) qb.andWhere('pos.partNumber LIKE :pn', { pn: `%${filters.partNumber}%` });
    if (filters.programId) qb.andWhere('pos.programId = :prog', { prog: filters.programId });
    const location = filters.location?.trim().toLowerCase();
    if (location) qb.andWhere('LOWER(pos.location) LIKE :location', { location: `%${location}%` });

    return qb.getMany();
  }

  async getMovements(user: User, filters: { partNumber?: string; warehouseId?: string }): Promise<InventoryMovement[]> {
    const qb = this.movementRepo.createQueryBuilder('mov');
    this.applyScope(qb, 'mov');

    // 1. Mandatory Organizational Scope
    const scopeBuildingIds = user.scopes?.buildings ?? [];
    if (scopeBuildingIds.length > 0) {
      const whs = await this.warehouseRepo.find({ where: { building: { id: In(scopeBuildingIds) } } as any });
      const whIds = whs.map(w => w.id);
      if (whIds.length > 0) {
        qb.andWhere('(mov.fromWarehouseId IN (:...scopeWhIds) OR mov.toWarehouseId IN (:...scopeWhIds))', { scopeWhIds: whIds });
      } else {
        qb.andWhere('1 = 0');
      }
    }

    if (filters.partNumber) qb.andWhere('mov.partNumber = :pn', { pn: filters.partNumber });
    if (filters.warehouseId) {
      qb.andWhere('(mov.fromWarehouseId = :wh OR mov.toWarehouseId = :wh)', { wh: filters.warehouseId });
    }
    qb.orderBy('mov.createdAt', 'DESC').limit(100);
    return qb.getMany();
  }

  /**
   * Primary transactional method for moving material.
   */
  async recordTransaction(dto: {
    type: InventoryTransactionType;
    partNumber: string;
    quantity: number;
    fromWarehouseId?: string;
    toWarehouseId?: string;
    fromLocation?: string;
    toLocation?: string;
    programId?: string;
    actorName: string;
    referenceType?: string;
    referenceId?: string;
    reason?: string;
    holdStatus?: 'available' | 'hold' | 'quarantine' | 'expired' | 'pending_iqc' | 'pending_oqc' | 'staged_for_shipping' | 'shipped';
    lotNumber?: string;
    serialNumber?: string;
    expiresAt?: Date | string | null;
  }): Promise<InventoryMovement> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const expiresAt = this.normalizeExpiry(dto.expiresAt);

      // 1. Validate Material
      const material = await this.materialRepo.findOne({ where: { partNumber: dto.partNumber } });
      if (!material) throw new NotFoundException(`Material ${dto.partNumber} not found in Master Data`);

      // 2. Handle Source (subtract)
      if (dto.fromWarehouseId) {
        let sourcePos = await queryRunner.manager.findOne(InventoryPosition, {
          where: { 
            partNumber: dto.partNumber, 
            warehouseId: dto.fromWarehouseId, 
            location: dto.fromLocation || 'BULK',
            programId: dto.programId,
            lotNumber: dto.lotNumber,
            serialNumber: dto.serialNumber
          }
        });

        if (!sourcePos || sourcePos.onHand < dto.quantity) {
          await this.audit.recordException({
            severity: ExceptionSeverity.HIGH,
            domain: ExceptionDomain.INVENTORY,
            title: `Insufficient Stock: ${dto.partNumber}`,
            description: `Attempted to move ${dto.quantity} from ${dto.fromWarehouseId} but only ${sourcePos?.onHand ?? 0} available.`,
            actor: dto.actorName,
            resourceType: 'InventoryPosition',
            resourceId: dto.partNumber,
            metadata: { warehouseId: dto.fromWarehouseId, requested: dto.quantity, available: sourcePos?.onHand ?? 0 }
          });
          throw new BadRequestException(`Insufficient stock in ${dto.fromWarehouseId} for ${dto.partNumber}`);
        }

        // OPERATIONAL HARD LOCK: solo stock 'available' — o 'staged_for_shipping',
        // que existe justo para el despacho de embarques — puede moverse de la
        // fuente. Holds, cuarentena y pendientes de inspección siguen bloqueados.
        if (sourcePos.holdStatus !== 'available' && sourcePos.holdStatus !== 'staged_for_shipping') {
          await this.audit.recordException({
            severity: ExceptionSeverity.CRITICAL,
            domain: ExceptionDomain.INVENTORY,
            title: `Movement Blocked: ${dto.partNumber}`,
            description: `Attempted to move material with status '${sourcePos.holdStatus}'. Movements are only allowed for 'available' stock.`,
            actor: dto.actorName,
            resourceType: 'InventoryPosition',
            resourceId: dto.partNumber,
            metadata: { warehouseId: dto.fromWarehouseId, status: sourcePos.holdStatus }
          });
          throw new BadRequestException(`Material ${dto.partNumber} is in status '${sourcePos.holdStatus}'. Movement BLOCKED.`);
        }

        sourcePos.onHand -= dto.quantity;
        await queryRunner.manager.save(sourcePos);
      }

      // 3. Handle Destination (add)
      if (dto.toWarehouseId) {
        let destPos = await queryRunner.manager.findOne(InventoryPosition, {
          where: { 
            partNumber: dto.partNumber, 
            warehouseId: dto.toWarehouseId, 
            location: dto.toLocation || 'BULK',
            programId: dto.programId,
            lotNumber: dto.lotNumber,
            serialNumber: dto.serialNumber
          }
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
            holdStatus: dto.holdStatus || 'available',
            expiresAt,
          });
        } else {
          // If position exists, update its status if explicitly provided
          if (dto.holdStatus) destPos.holdStatus = dto.holdStatus;
          if (dto.expiresAt !== undefined) destPos.expiresAt = expiresAt;
        }

        destPos.onHand += dto.quantity;
        await queryRunner.manager.save(destPos);
      }

      // 4. Log Movement
      const movement = queryRunner.manager.create(InventoryMovement, {
        ...dto,
        createdAt: new Date()
      });
      const savedMovement = await queryRunner.manager.save(movement);

      await this.audit.recordAction({
        actor: dto.actorName,
        action: `INVENTORY_${dto.type}`,
        resourceType: 'InventoryPosition',
        resourceId: dto.partNumber,
        metadata: { 
          quantity: dto.quantity, 
          from: dto.fromWarehouseId, 
          to: dto.toWarehouseId,
          reference: `${dto.referenceType}:${dto.referenceId}`
        },
        outcome: 'ALLOWED'
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

  private normalizeExpiry(value: Date | string | null | undefined): Date | null {
    if (value === undefined || value === null || value === '') return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('expiresAt must be a valid date.');
    }
    return date;
  }

  // Helper to ensure material exists in master data (used for auto-receiving/demos)
  async ensureMaterial(dto: Partial<MaterialMaster>, user?: User): Promise<MaterialMaster> {
    if (!dto.partNumber) throw new BadRequestException('partNumber required');
    let m = await this.materialRepo.findOne({ where: { partNumber: dto.partNumber } });
    if (!m) {
      m = this.materialRepo.create({
        partNumber: dto.partNumber,
        description: dto.description || `Part ${dto.partNumber}`,
        uom: dto.uom || 'EA',
        // Persisted only when creating a new part — existing parts are never
        // overwritten — so in-line BOM capture can seed a real standard cost
        // (feeds BOM rollup + downstream valuation) and ABC/category.
        standardCost: dto.standardCost ?? 0,
        ...(dto.category ? { category: dto.category } : {}),
      });
      const saved = await this.materialRepo.save(m);
      if (user) {
        await this.audit.recordAction({
          actor: user.email,
          action: 'MATERIAL_MASTER_CREATED',
          resourceType: 'MaterialMaster',
          resourceId: saved.partNumber,
          outcome: 'ALLOWED'
        });
      }
      return saved;
    }
    return m;
  }
}
