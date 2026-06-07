import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { Asset } from './entities/asset.entity';
import { MaintenanceOrder } from './entities/maintenance-order.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import {
  CreateAssetDto,
  CreateMaintenanceOrderDto,
  TransitionMaintenanceOrderDto,
  UpdateAssetDto,
  UpdateMaintenanceOrderDto,
} from './dto/maintenance.dto';
import { assertTransition, MaintenanceOrderStatus } from './order-state';

export interface MaintenanceKpis {
  ordersOpen: number;
  ordersInProgress: number;
  ordersOverdue: number;
  ordersCompleted: number;
  pmCompliance: number | null;
  mttrHours: number | null;
  totalDowntimeMinutes: number;
  assetsTotal: number;
  assetsDown: number;
}

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
    @InjectRepository(MaintenanceOrder)
    private readonly orderRepo: Repository<MaintenanceOrder>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  private scope<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
  ): SelectQueryBuilder<T> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  private base() {
    return {
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    };
  }

  // ── Assets ────────────────────────────────────────────────────────────────

  async createAsset(dto: CreateAssetDto): Promise<Asset> {
    const asset = this.assetRepo.create({
      name: dto.name,
      code: dto.code ?? null,
      category: dto.category ?? null,
      location: dto.location ?? null,
      criticality: dto.criticality ?? 'MEDIUM',
      status: 'RUNNING',
      manufacturer: dto.manufacturer ?? null,
      model: dto.model ?? null,
      serialNumber: dto.serialNumber ?? null,
      ...this.base(),
    });
    const saved = await this.assetRepo.save(asset);
    await this.ledgerEvent('ASSET_CREATED', 'ASSET', saved.id, { after: saved });
    return saved;
  }

  async listAssets(): Promise<Asset[]> {
    const qb = this.assetRepo.createQueryBuilder('a').orderBy('a.name', 'ASC');
    this.scope(qb, 'a');
    return qb.getMany();
  }

  async updateAsset(id: string, dto: UpdateAssetDto): Promise<Asset> {
    const asset = await this.assetRepo.findOne({ where: { id } });
    if (!asset) throw new NotFoundException('Activo no encontrado.');
    Object.assign(asset, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.location !== undefined && { location: dto.location }),
      ...(dto.criticality !== undefined && { criticality: dto.criticality }),
      ...(dto.status !== undefined && { status: dto.status }),
    });
    return this.assetRepo.save(asset);
  }

  // ── Maintenance orders ──────────────────────────────────────────────────────

  async createOrder(
    dto: CreateMaintenanceOrderDto,
  ): Promise<MaintenanceOrder> {
    let folio: string | null = null;
    try {
      folio = await this.numbering.allocate('MAINTENANCE_ORDER');
    } catch (err) {
      this.logger.warn(`Folio allocation failed: ${(err as Error)?.message}`);
    }

    let assetName: string | null = null;
    if (dto.assetId) {
      const asset = await this.assetRepo.findOne({ where: { id: dto.assetId } });
      assetName = asset?.name ?? null;
    }

    const order = this.orderRepo.create({
      folio,
      title: dto.title,
      description: dto.description ?? null,
      type: dto.type ?? 'CORRECTIVE',
      priority: dto.priority ?? 'MEDIUM',
      status: 'OPEN',
      assetId: dto.assetId ?? null,
      assetName,
      assignedTo: dto.assignedTo ?? null,
      downtimeMinutes: 0,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      ...this.base(),
    });
    const saved = await this.orderRepo.save(order);
    await this.ledgerEvent('MAINTENANCE_ORDER_CREATED', 'MAINTENANCE_ORDER', saved.id, { after: saved });
    return saved;
  }

  async listOrders(filters: {
    status?: string;
    type?: string;
    assetId?: string;
  } = {}): Promise<MaintenanceOrder[]> {
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .orderBy('o.created_at', 'DESC');
    this.scope(qb, 'o');
    if (filters.status) qb.andWhere('o.status = :s', { s: filters.status });
    if (filters.type) qb.andWhere('o.type = :t', { t: filters.type });
    if (filters.assetId) qb.andWhere('o.asset_id = :a', { a: filters.assetId });
    return qb.getMany();
  }

  async getOrder(id: string): Promise<MaintenanceOrder> {
    const found = await this.orderRepo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Orden no encontrada.');
    return found;
  }

  async updateOrder(
    id: string,
    dto: UpdateMaintenanceOrderDto,
  ): Promise<MaintenanceOrder> {
    const order = await this.getOrder(id);
    Object.assign(order, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
      ...(dto.assignedTo !== undefined && { assignedTo: dto.assignedTo }),
      ...(dto.dueDate !== undefined && {
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      }),
    });
    return this.orderRepo.save(order);
  }

  async transitionOrder(
    id: string,
    dto: TransitionMaintenanceOrderDto,
  ): Promise<MaintenanceOrder> {
    const order = await this.getOrder(id);
    const from = order.status;
    try {
      assertTransition(from, dto.status);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    const now = new Date();
    order.status = dto.status;
    if (dto.status === 'IN_PROGRESS' && !order.startedAt) order.startedAt = now;
    if (dto.status === 'COMPLETED') {
      order.completedAt = now;
      if (dto.downtimeMinutes !== undefined)
        order.downtimeMinutes = dto.downtimeMinutes;
    }

    const saved = await this.orderRepo.save(order);
    await this.ledgerEvent(
      'MAINTENANCE_ORDER_TRANSITIONED',
      'MAINTENANCE_ORDER',
      saved.id,
      { before: { status: from }, after: { status: dto.status } },
    );
    return saved;
  }

  // ── KPIs ─────────────────────────────────────────────────────────────────

  async kpis(): Promise<MaintenanceKpis> {
    const [orders, assets] = await Promise.all([
      this.listOrders(),
      this.listAssets(),
    ]);
    const now = Date.now();

    let ordersOpen = 0;
    let ordersInProgress = 0;
    let ordersOverdue = 0;
    let ordersCompleted = 0;
    let totalDowntimeMinutes = 0;
    let pmTotal = 0;
    let pmCompleted = 0;
    let mttrSum = 0;
    let mttrCount = 0;

    for (const o of orders) {
      if (o.status === 'OPEN') ordersOpen += 1;
      if (o.status === 'IN_PROGRESS') ordersInProgress += 1;
      if (o.status === 'COMPLETED') ordersCompleted += 1;
      const active = o.status !== 'COMPLETED' && o.status !== 'CANCELLED';
      if (active && o.dueDate && new Date(o.dueDate).getTime() < now) {
        ordersOverdue += 1;
      }
      totalDowntimeMinutes += Number(o.downtimeMinutes ?? 0);
      if (o.type === 'PREVENTIVE') {
        pmTotal += 1;
        if (o.status === 'COMPLETED') pmCompleted += 1;
      }
      if (o.status === 'COMPLETED' && o.completedAt) {
        const start = o.startedAt ?? o.created_at;
        if (start) {
          const hrs =
            (new Date(o.completedAt).getTime() - new Date(start).getTime()) /
            3_600_000;
          if (hrs >= 0) {
            mttrSum += hrs;
            mttrCount += 1;
          }
        }
      }
    }

    return {
      ordersOpen,
      ordersInProgress,
      ordersOverdue,
      ordersCompleted,
      pmCompliance: pmTotal > 0 ? Math.round((pmCompleted / pmTotal) * 100) : null,
      mttrHours: mttrCount > 0 ? Math.round((mttrSum / mttrCount) * 10) / 10 : null,
      totalDowntimeMinutes,
      assetsTotal: assets.length,
      assetsDown: assets.filter((a) => a.status === 'DOWN').length,
    };
  }

  private async ledgerEvent(
    action: string,
    refType: string,
    refId: string,
    states: { before?: unknown; after?: unknown },
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.SYSTEM,
        action,
        referenceType: refType,
        referenceId: refId,
        plant: this.tenantCtx.getPlantId() ?? undefined,
        metadata: { beforeState: states.before, afterState: states.after },
      });
    } catch (err) {
      this.logger.warn(
        `Ledger write skipped for ${action}: ${(err as Error)?.message}`,
      );
    }
  }
}
