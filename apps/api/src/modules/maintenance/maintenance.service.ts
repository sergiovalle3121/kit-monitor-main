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
import { MaintenancePmPlan } from './entities/pm-plan.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';
import {
  CreateAssetDto,
  CreateMaintenanceOrderDto,
  CreatePmPlanDto,
  TransitionMaintenanceOrderDto,
  UpdateAssetDto,
  UpdateMaintenanceOrderDto,
  UpdatePmPlanDto,
} from './dto/maintenance.dto';
import { assertTransition, MaintenanceOrderStatus } from './order-state';
import { computeNextDueDate, pmDueStatus } from './pm-frequency';
import { assetReliabilityFrom, mttrHoursFrom } from './reliability';
import type { AssetReliability } from './reliability';

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
  /** Planes de PM activos. */
  pmPlansActive: number;
  /** Planes de PM con next_due_date pasada (sin atender). */
  pmOverdue: number;
  /** Planes de PM que vencen dentro de la ventana (por defecto 7 días). */
  pmDueSoon: number;
}

export interface AssetDetail {
  asset: Asset;
  orders: MaintenanceOrder[];
  reliability: AssetReliability;
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
    // Additive deps — `@Optional` so existing unit tests (que construyen el
    // servicio con repos + ctx + numbering) siguen compilando y corriendo.
    @Optional()
    @InjectRepository(MaintenancePmPlan)
    private readonly pmRepo?: Repository<MaintenancePmPlan>,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly users?: UsersService,
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

    let asset: Asset | null = null;
    if (dto.assetId) {
      asset = await this.assetRepo.findOne({ where: { id: dto.assetId } });
    }

    const order = this.orderRepo.create({
      folio,
      title: dto.title,
      description: dto.description ?? null,
      type: dto.type ?? 'CORRECTIVE',
      priority: dto.priority ?? 'MEDIUM',
      status: 'OPEN',
      assetId: dto.assetId ?? null,
      assetName: asset?.name ?? null,
      assignedTo: dto.assignedTo ?? null,
      downtimeMinutes: 0,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      ...this.base(),
    });
    const saved = await this.orderRepo.save(order);
    await this.ledgerEvent('MAINTENANCE_ORDER_CREATED', 'MAINTENANCE_ORDER', saved.id, { after: saved });
    await this.maybeAlertCriticalCorrective(saved, asset);
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
    const [orders, assets, pmPlans] = await Promise.all([
      this.listOrders(),
      this.listAssets(),
      this.safeListPmPlans(),
    ]);
    const now = Date.now();

    let ordersOpen = 0;
    let ordersInProgress = 0;
    let ordersOverdue = 0;
    let ordersCompleted = 0;
    let totalDowntimeMinutes = 0;
    let pmTotal = 0;
    let pmCompleted = 0;

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
    }

    // PM plan health (semáforo de programación recurrente).
    const activePlans = pmPlans.filter((p) => p.active);
    let pmOverdue = 0;
    let pmDueSoon = 0;
    for (const p of activePlans) {
      const due = pmDueStatus(p.nextDueDate, now);
      if (due === 'OVERDUE') pmOverdue += 1;
      else if (due === 'DUE_SOON') pmDueSoon += 1;
    }

    return {
      ordersOpen,
      ordersInProgress,
      ordersOverdue,
      ordersCompleted,
      pmCompliance: pmTotal > 0 ? Math.round((pmCompleted / pmTotal) * 100) : null,
      // MTTR reusa el helper compartido (mismo cálculo que el detalle por activo).
      mttrHours: mttrHoursFrom(orders),
      totalDowntimeMinutes,
      assetsTotal: assets.length,
      assetsDown: assets.filter((a) => a.status === 'DOWN').length,
      pmPlansActive: activePlans.length,
      pmOverdue,
      pmDueSoon,
    };
  }

  // ── Asset detail + reliability (MTTR / MTBF por activo) ──────────────────────

  /**
   * Detalle de un activo con su historial de órdenes (más recientes primero) y su
   * confiabilidad derivada: MTTR (igual que el KPI global, pero del activo), MTBF
   * (tiempo entre fallas correctivas), paro acumulado y fallas. El backend es la
   * fuente de verdad de la confiabilidad por activo.
   */
  async getAssetDetail(id: string): Promise<AssetDetail> {
    const asset = await this.assetRepo.findOne({ where: { id } });
    if (!asset) throw new NotFoundException('Activo no encontrado.');
    const orders = await this.listOrders({ assetId: id });
    return { asset, orders, reliability: assetReliabilityFrom(orders) };
  }

  // ── Preventive-maintenance plans (PM) ───────────────────────────────────────

  private requirePmRepo(): Repository<MaintenancePmPlan> {
    if (!this.pmRepo) {
      throw new BadRequestException(
        'El módulo de mantenimiento preventivo no está disponible.',
      );
    }
    return this.pmRepo;
  }

  /** Lista PM plans sin reventar si el repo no está cableado (p.ej. en KPIs/tests). */
  private async safeListPmPlans(): Promise<MaintenancePmPlan[]> {
    if (!this.pmRepo) return [];
    return this.listPmPlans();
  }

  async listPmPlans(
    filters: { assetId?: string; active?: boolean } = {},
  ): Promise<MaintenancePmPlan[]> {
    const repo = this.requirePmRepo();
    const qb = repo.createQueryBuilder('p').orderBy('p.next_due_date', 'ASC');
    this.scope(qb, 'p');
    if (filters.assetId) qb.andWhere('p.asset_id = :a', { a: filters.assetId });
    if (filters.active !== undefined) {
      qb.andWhere('p.active = :ac', { ac: filters.active });
    }
    return qb.getMany();
  }

  async getPmPlan(id: string): Promise<MaintenancePmPlan> {
    const repo = this.requirePmRepo();
    const found = await repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Plan de preventivo no encontrado.');
    return found;
  }

  async createPmPlan(dto: CreatePmPlanDto): Promise<MaintenancePmPlan> {
    const repo = this.requirePmRepo();
    let assetName: string | null = null;
    if (dto.assetId) {
      const asset = await this.assetRepo.findOne({ where: { id: dto.assetId } });
      assetName = asset?.name ?? null;
    }
    const lastDone = dto.lastDoneDate ? new Date(dto.lastDoneDate) : null;
    const base = lastDone ?? this.startOfToday();
    const nextDue = dto.nextDueDate
      ? new Date(dto.nextDueDate)
      : computeNextDueDate(base, dto.frequencyType, dto.frequencyValue);
    const plan = repo.create({
      assetId: dto.assetId ?? null,
      assetName,
      title: dto.title,
      description: dto.description ?? null,
      frequencyType: dto.frequencyType,
      frequencyValue: dto.frequencyValue,
      lastDoneDate: lastDone,
      nextDueDate: nextDue,
      active: true,
      assignedTo: dto.assignedTo ?? null,
      ...this.base(),
    });
    const saved = await repo.save(plan);
    await this.ledgerEvent('PM_PLAN_CREATED', 'MAINTENANCE_PM_PLAN', saved.id, {
      after: saved,
    });
    return saved;
  }

  async updatePmPlan(
    id: string,
    dto: UpdatePmPlanDto,
  ): Promise<MaintenancePmPlan> {
    const repo = this.requirePmRepo();
    const plan = await this.getPmPlan(id);
    if (dto.title !== undefined) plan.title = dto.title;
    if (dto.description !== undefined) plan.description = dto.description;
    if (dto.frequencyType !== undefined) plan.frequencyType = dto.frequencyType;
    if (dto.frequencyValue !== undefined) plan.frequencyValue = dto.frequencyValue;
    if (dto.assignedTo !== undefined) plan.assignedTo = dto.assignedTo;
    if (dto.active !== undefined) plan.active = dto.active;
    if (dto.lastDoneDate !== undefined) {
      plan.lastDoneDate = dto.lastDoneDate ? new Date(dto.lastDoneDate) : null;
    }
    // Un next_due explícito manda; si cambió la cadencia o la última realización,
    // se recalcula desde la última realización (o hoy).
    if (dto.nextDueDate !== undefined) {
      plan.nextDueDate = dto.nextDueDate ? new Date(dto.nextDueDate) : null;
    } else if (
      dto.frequencyType !== undefined ||
      dto.frequencyValue !== undefined ||
      dto.lastDoneDate !== undefined
    ) {
      const base = plan.lastDoneDate ?? this.startOfToday();
      plan.nextDueDate = computeNextDueDate(
        base,
        plan.frequencyType,
        plan.frequencyValue,
      );
    }
    return repo.save(plan);
  }

  /**
   * GENERA una orden PREVENTIVE ligada al activo del plan y avanza el plan:
   * last_done_date = hoy, next_due_date = hoy + frecuencia. Es el corazón del PM
   * programado. Reusa `createOrder` (folio, denormalización del activo, ledger).
   */
  async generatePmOrder(
    id: string,
  ): Promise<{ plan: MaintenancePmPlan; order: MaintenanceOrder }> {
    const repo = this.requirePmRepo();
    const plan = await this.getPmPlan(id);
    const order = await this.createOrder({
      title: plan.title,
      description: plan.description ?? undefined,
      type: 'PREVENTIVE',
      priority: 'MEDIUM',
      assetId: plan.assetId ?? undefined,
      assignedTo: plan.assignedTo ?? undefined,
      dueDate: plan.nextDueDate ? this.ymd(plan.nextDueDate) : undefined,
    });
    const today = this.startOfToday();
    plan.lastDoneDate = today;
    plan.nextDueDate = computeNextDueDate(
      today,
      plan.frequencyType,
      plan.frequencyValue,
    );
    const savedPlan = await repo.save(plan);
    await this.ledgerEvent(
      'PM_ORDER_GENERATED',
      'MAINTENANCE_PM_PLAN',
      savedPlan.id,
      { after: { orderId: order.id, nextDueDate: savedPlan.nextDueDate } },
    );
    return { plan: savedPlan, order };
  }

  // ── Alerts → buzón de notificaciones (best-effort; patrón de AlertsService) ──

  /**
   * Resuelve destinatarios por rol (p.ej. admins + planeadores) dentro del tenant
   * actual y crea una notificación deduplicada para cada uno. Best-effort: si el
   * buzón/usuarios no están disponibles (tests, contexto sin DI) no-opera. Mismo
   * patrón que el push de KPIs a admins (semantic) y el motor de alertas (alerts).
   */
  private async notifyRoles(
    roles: UserRole[],
    input: {
      title: string;
      body?: string;
      severity?: string;
      href?: string;
      dedupeKey: string;
    },
  ): Promise<number> {
    if (!this.notifications || !this.users) return 0;
    try {
      const wanted = new Set<string>(roles);
      const tenant = this.tenantCtx.getTenantId();
      const recipients = (await this.users.findAll()).filter(
        (u) =>
          wanted.has(u.role) &&
          (!tenant || !u.tenantId || u.tenantId === tenant),
      );
      let sent = 0;
      for (const u of recipients) {
        await this.notifications.create({
          userId: u.id,
          kind: 'maintenance',
          severity: input.severity ?? 'high',
          domain: 'maintenance',
          source: 'maintenance:alerts',
          title: input.title,
          body: input.body ?? null,
          href: input.href ?? '/dashboard/maintenance',
          dedupeKey: input.dedupeKey,
        });
        sent += 1;
      }
      return sent;
    } catch (err) {
      this.logger.warn(
        `Maintenance alert skipped: ${(err as Error)?.message}`,
      );
      return 0;
    }
  }

  /** Orden correctiva sobre activo de alta criticidad EN AVERÍA → supervisor. */
  private async maybeAlertCriticalCorrective(
    order: MaintenanceOrder,
    asset: Asset | null,
  ): Promise<void> {
    if (order.type !== 'CORRECTIVE' || !asset) return;
    const highCriticality =
      asset.criticality === 'HIGH' || asset.criticality === 'CRITICAL';
    if (!highCriticality || asset.status !== 'DOWN') return;
    await this.notifyRoles([UserRole.ADMIN, UserRole.PRODUCTION_SUPERVISOR], {
      title: `Avería crítica: ${asset.name}`,
      body: `${order.folio ?? 'Orden'} — ${order.title}. Activo de criticidad ${asset.criticality} en avería.`,
      severity: 'critical',
      dedupeKey: `mo-critical:${order.id}`,
    });
  }

  /**
   * Escanea los PM activos del scope actual y avisa al planeador (admins +
   * planners) de los VENCIDOS. Deduplicado por plan/fecha (`pm-due:<id>:<fecha>`).
   * Corre dentro de un request (tenant correcto) o desde el cron opt-in.
   */
  async scanPmDueAndNotify(): Promise<{ scanned: number; notified: number }> {
    if (!this.pmRepo) return { scanned: 0, notified: 0 };
    const plans = await this.listPmPlans({ active: true });
    const now = Date.now();
    let notified = 0;
    for (const p of plans) {
      if (pmDueStatus(p.nextDueDate, now) !== 'OVERDUE') continue;
      const nextKey = p.nextDueDate ? this.ymd(p.nextDueDate) : 'na';
      const sent = await this.notifyRoles([UserRole.ADMIN, UserRole.PLANNER], {
        title: `PM vencido: ${p.title}`,
        body: `${p.assetName ? `${p.assetName} — ` : ''}Preventivo vencido (cada ${p.frequencyValue} ${p.frequencyType.toLowerCase()}). Genera la orden o reprograma.`,
        severity: 'high',
        dedupeKey: `pm-due:${p.id}:${nextKey}`,
      });
      if (sent > 0) notified += 1;
    }
    return { scanned: plans.length, notified };
  }

  // ── Date helpers ─────────────────────────────────────────────────────────────

  /** Medianoche local de hoy (frontera estable para cadencias de PM). */
  private startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** YYYY-MM-DD local (para due dates de órdenes y dedupe de alertas). */
  private ymd(d: Date): string {
    const x = new Date(d);
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const day = String(x.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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
