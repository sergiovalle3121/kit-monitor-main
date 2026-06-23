import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository, SelectQueryBuilder } from 'typeorm';
import { Tool } from './entities/tool.entity';
import { ToolCheckout } from './entities/tool-checkout.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { ProductionPlanService } from '../production-plan/production-plan.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import {
  CheckinToolDto,
  CheckoutToolDto,
  CreateToolDto,
  RecordCalibrationDto,
  RecordPmDto,
  RecordUsageDto,
  SetToolStatusDto,
} from './dto/tooling.dto';
import {
  CALIBRATION_DUE_SOON_DAYS,
  CalibrationStatus,
  calibrationStatus,
  daysUntil,
  isNearEol,
  lifePercent,
  remainingShots,
} from './tool-life';

/** Vista ligera del préstamo activo embebida en el tool serializado. */
export interface ActiveCheckoutView {
  id: string;
  workOrderId: string | null;
  workOrderFolio: string | null;
  workOrderModel: string | null;
  checkedOutAt: Date;
  checkedOutBy: string | null;
  shotsAtCheckout: number;
}

export type SerializedTool = Tool & {
  lifePercent: number;
  remainingShots: number;
  nearEol: boolean;
  calibrationStatus: CalibrationStatus;
  daysToCalibration: number | null;
  activeCheckout: ActiveCheckoutView | null;
};

export interface ToolingKpis {
  total: number;
  active: number;
  inMaintenance: number;
  retired: number;
  nearEol: number;
  onLoan: number;
  calibrationOverdue: number;
  calibrationDueSoon: number;
  avgLifeConsumedPct: number | null;
}

/** Un evento del historial de uso/auditoría derivado del ledger (read-only). */
export interface ToolUsageEvent {
  at: Date;
  action: string;
  actor: string | null;
  shotsUsed: number | null;
  shotsAdded: number | null;
}

@Injectable()
export class ToolingService {
  private readonly logger = new Logger(ToolingService.name);

  constructor(
    @InjectRepository(Tool)
    private readonly repo: Repository<Tool>,
    @InjectRepository(ToolCheckout)
    private readonly checkoutRepo: Repository<ToolCheckout>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    @Optional() private readonly ledger?: EventLedgerService,
    @Optional() private readonly plan?: ProductionPlanService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly users?: UsersService,
  ) {}

  private applyScope(
    qb: SelectQueryBuilder<Tool>,
    alias: string,
  ): SelectQueryBuilder<Tool> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  private serialize(t: Tool, activeCheckout: ToolCheckout | null = null): SerializedTool {
    return {
      ...t,
      lifePercent: lifePercent(t.shotsUsed, t.lifeShots),
      remainingShots: remainingShots(t.shotsUsed, t.lifeShots),
      nearEol: isNearEol(t.shotsUsed, t.lifeShots),
      calibrationStatus: calibrationStatus(t.nextCalibrationDate),
      daysToCalibration: daysUntil(t.nextCalibrationDate),
      activeCheckout: activeCheckout
        ? {
            id: activeCheckout.id,
            workOrderId: activeCheckout.workOrderId,
            workOrderFolio: activeCheckout.workOrderFolio,
            workOrderModel: activeCheckout.workOrderModel,
            checkedOutAt: activeCheckout.checkedOutAt,
            checkedOutBy: activeCheckout.checkedOutBy,
            shotsAtCheckout: activeCheckout.shotsAtCheckout,
          }
        : null,
    };
  }

  /** Préstamo abierto (checked_in_at NULL) de un tool, o null. */
  private async openCheckout(toolId: string): Promise<ToolCheckout | null> {
    return this.checkoutRepo.findOne({
      where: { toolId, checkedInAt: IsNull() },
      order: { checkedOutAt: 'DESC' },
    });
  }

  async create(dto: CreateToolDto): Promise<SerializedTool> {
    let folio: string | null = null;
    try {
      folio = await this.numbering.allocate('TOOL');
    } catch (err) {
      this.logger.warn(`Folio allocation failed: ${(err as Error)?.message}`);
    }

    const entity = this.repo.create({
      folio,
      name: dto.name,
      type: dto.type ?? 'MOLD',
      cavities: dto.cavities ?? 1,
      lifeShots: dto.lifeShots,
      shotsUsed: dto.shotsUsed ?? 0,
      status: 'AVAILABLE',
      location: dto.location ?? null,
      programId: dto.programId ?? null,
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    const saved = await this.repo.save(entity);
    await this.recordLedger('TOOL_CREATED', saved);
    return this.serialize(saved);
  }

  async list(filters: { status?: string; type?: string } = {}): Promise<
    SerializedTool[]
  > {
    const qb = this.repo.createQueryBuilder('t').orderBy('t.created_at', 'DESC');
    this.applyScope(qb, 't');
    if (filters.status) qb.andWhere('t.status = :s', { s: filters.status });
    if (filters.type) qb.andWhere('t.type = :ty', { ty: filters.type });
    const rows = await qb.getMany();

    // Carga en lote de los préstamos abiertos para evitar N+1 al pintar la tabla.
    const ids = rows.map((r) => r.id);
    const open = ids.length
      ? await this.checkoutRepo.find({
          where: { toolId: In(ids), checkedInAt: IsNull() },
        })
      : [];
    const byTool = new Map(open.map((c) => [c.toolId, c]));
    return rows.map((t) => this.serialize(t, byTool.get(t.id) ?? null));
  }

  async getOne(id: string): Promise<SerializedTool> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Herramental no encontrado.');
    return this.serialize(found, await this.openCheckout(id));
  }

  async recordUsage(id: string, dto: RecordUsageDto): Promise<SerializedTool> {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Herramental no encontrado.');
    const wasNearEol = isNearEol(t.shotsUsed, t.lifeShots);
    t.shotsUsed = Math.max(0, Number(t.shotsUsed ?? 0)) + dto.shots;
    const saved = await this.repo.save(t);
    await this.recordLedger('TOOL_USAGE_RECORDED', saved, { shotsAdded: dto.shots });
    // Alerta EOL que DISPARA al cruzar el umbral (no antes, no en cada disparo).
    if (!wasNearEol && isNearEol(saved.shotsUsed, saved.lifeShots)) {
      this.maybeNotifyEol(saved).catch((err) =>
        this.logger.warn(`EOL notify skipped: ${(err as Error)?.message}`),
      );
    }
    return this.serialize(saved, await this.openCheckout(id));
  }

  async setStatus(id: string, dto: SetToolStatusDto): Promise<SerializedTool> {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Herramental no encontrado.');
    t.status = dto.status;
    const saved = await this.repo.save(t);
    await this.recordLedger('TOOL_STATUS_CHANGED', saved);
    return this.serialize(saved, await this.openCheckout(id));
  }

  // ── Check-out / check-in a una WO (trazabilidad de préstamo) ────────────────

  /**
   * Presta un herramental a una WO. Regla de estado: solo un tool AVAILABLE puede
   * prestarse (IN_USE ya está prestado; MAINTENANCE/RETIRED no aplican). Marca el
   * tool como IN_USE y abre un registro de checkout. La WO se REFERENCIA por
   * id/folio (lectura best-effort de ProductionPlanService); no se toca SfWorkOrder.
   */
  async checkout(id: string, dto: CheckoutToolDto): Promise<SerializedTool> {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Herramental no encontrado.');
    if (t.status === 'IN_USE') {
      throw new ConflictException(
        'El herramental ya está prestado a una WO; recíbelo antes de volver a prestarlo.',
      );
    }
    if (t.status === 'MAINTENANCE') {
      throw new ConflictException('El herramental está en mantenimiento; no puede prestarse.');
    }
    if (t.status === 'RETIRED') {
      throw new ConflictException('El herramental está retirado; no puede prestarse.');
    }
    const alreadyOpen = await this.openCheckout(id);
    if (alreadyOpen) {
      throw new ConflictException('Ya existe un préstamo abierto para este herramental.');
    }

    // Enriquecimiento read-only desde la WO (no acopla SfWorkOrder).
    let workOrderId = dto.workOrderId?.trim() || null;
    let workOrderFolio = dto.workOrderFolio?.trim() || null;
    let workOrderModel: string | null = null;
    if (workOrderId && this.plan) {
      try {
        const wo = await this.plan.getOne(workOrderId);
        workOrderFolio = wo.folio ?? workOrderFolio;
        workOrderModel = wo.model ?? null;
      } catch {
        /* el vínculo con la WO es opcional/best-effort */
      }
    }

    const by = dto.by?.trim() || this.tenantCtx.getUserEmail() || null;
    const checkout = this.checkoutRepo.create({
      toolId: id,
      workOrderId,
      workOrderFolio,
      workOrderModel,
      checkedOutAt: new Date(),
      checkedOutBy: by,
      checkedInAt: null,
      checkedInBy: null,
      shotsAtCheckout: Math.max(0, Number(t.shotsUsed ?? 0)),
      shotsAtCheckin: null,
      shotsDuring: null,
      notes: dto.notes?.trim() || null,
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: by,
    });
    const savedCheckout = await this.checkoutRepo.save(checkout);

    t.status = 'IN_USE';
    const saved = await this.repo.save(t);
    await this.recordLedger('TOOL_CHECKED_OUT', saved, {
      checkoutId: savedCheckout.id,
      workOrderId,
      workOrderFolio,
    });
    return this.serialize(saved, savedCheckout);
  }

  /**
   * Recibe un herramental prestado. Cierra el checkout abierto y devuelve el tool
   * a AVAILABLE. Si se reportan disparos, se suman vía la MISMA lógica de usage
   * (recordUsage → tool-life) — no se duplica el cálculo de vida.
   */
  async checkin(id: string, dto: CheckinToolDto): Promise<SerializedTool> {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Herramental no encontrado.');
    const open = await this.openCheckout(id);
    if (!open) {
      throw new ConflictException('El herramental no tiene un préstamo abierto que recibir.');
    }

    // Disparos del préstamo → reutiliza recordUsage (vida + ledger + alerta EOL).
    if (dto.shots && dto.shots > 0) {
      await this.recordUsage(id, { shots: dto.shots });
    }
    const fresh = await this.repo.findOne({ where: { id } });
    const shotsAtCheckin = Math.max(0, Number(fresh?.shotsUsed ?? t.shotsUsed ?? 0));

    const by = dto.by?.trim() || this.tenantCtx.getUserEmail() || null;
    open.checkedInAt = new Date();
    open.checkedInBy = by;
    open.shotsAtCheckin = shotsAtCheckin;
    open.shotsDuring =
      dto.shots && dto.shots > 0
        ? dto.shots
        : Math.max(0, shotsAtCheckin - (open.shotsAtCheckout ?? 0));
    if (dto.notes?.trim()) {
      open.notes = [open.notes, dto.notes.trim()].filter(Boolean).join(' · ');
    }
    await this.checkoutRepo.save(open);

    const target = fresh ?? t;
    target.status = 'AVAILABLE';
    const saved = await this.repo.save(target);
    await this.recordLedger('TOOL_CHECKED_IN', saved, {
      checkoutId: open.id,
      workOrderFolio: open.workOrderFolio,
      shotsDuring: open.shotsDuring,
    });
    return this.serialize(saved, null);
  }

  /** Historial de préstamos de un tool (más reciente primero). */
  async listCheckouts(id: string): Promise<ToolCheckout[]> {
    return this.checkoutRepo.find({
      where: { toolId: id },
      order: { checkedOutAt: 'DESC' },
    });
  }

  // ── Calibración / PM (IATF) ─────────────────────────────────────────────────

  async recordCalibration(
    id: string,
    dto: RecordCalibrationDto,
  ): Promise<SerializedTool> {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Herramental no encontrado.');

    const calibratedAt = dto.calibratedAt ? new Date(dto.calibratedAt) : new Date();
    const interval = dto.intervalDays ?? t.calibrationIntervalDays ?? null;
    let next: Date | null = dto.nextDate ? new Date(dto.nextDate) : null;
    if (!next && interval && interval > 0) {
      next = new Date(calibratedAt.getTime());
      next.setDate(next.getDate() + interval);
    }

    t.lastCalibrationDate = calibratedAt;
    t.nextCalibrationDate = next;
    if (dto.intervalDays) t.calibrationIntervalDays = dto.intervalDays;
    const saved = await this.repo.save(t);
    await this.recordLedger('TOOL_CALIBRATED', saved, {
      calibratedAt: calibratedAt.toISOString(),
      nextCalibrationDate: next ? next.toISOString() : null,
    });
    // Si la próxima ya nace por vencer/vencida, avisa de una vez.
    this.maybeNotifyCalibration(saved).catch((err) =>
      this.logger.warn(`Calibration notify skipped: ${(err as Error)?.message}`),
    );
    return this.serialize(saved, await this.openCheckout(id));
  }

  async recordPm(id: string, dto: RecordPmDto): Promise<SerializedTool> {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Herramental no encontrado.');

    const performedAt = dto.performedAt ? new Date(dto.performedAt) : new Date();
    let next: Date | null = dto.nextDate ? new Date(dto.nextDate) : null;
    if (!next && dto.intervalDays && dto.intervalDays > 0) {
      next = new Date(performedAt.getTime());
      next.setDate(next.getDate() + dto.intervalDays);
    }
    t.lastPmDate = performedAt;
    t.nextPmDate = next;
    const saved = await this.repo.save(t);
    await this.recordLedger('TOOL_PM_RECORDED', saved, {
      performedAt: performedAt.toISOString(),
      nextPmDate: next ? next.toISOString() : null,
    });
    return this.serialize(saved, await this.openCheckout(id));
  }

  // ── Historial denso (préstamos + uso desde el ledger, read-only) ────────────

  async history(id: string): Promise<{
    tool: SerializedTool;
    checkouts: ToolCheckout[];
    usage: ToolUsageEvent[];
  }> {
    const tool = await this.getOne(id);
    const checkouts = await this.listCheckouts(id);
    let usage: ToolUsageEvent[] = [];
    if (this.ledger) {
      try {
        const events = await this.ledger.getEventsByReference('TOOL', id);
        usage = events
          .map((e) => ({
            at: e.timestamp,
            action: e.action,
            actor: e.actorName ?? null,
            shotsUsed:
              typeof e.metadata?.shotsUsed === 'number' ? e.metadata.shotsUsed : null,
            shotsAdded:
              typeof e.metadata?.shotsAdded === 'number' ? e.metadata.shotsAdded : null,
          }))
          // Ascendente para que la mini-tendencia de disparos lea de izq. a der.
          .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
      } catch (err) {
        this.logger.warn(`Usage history skipped: ${(err as Error)?.message}`);
      }
    }
    return { tool, checkouts, usage };
  }

  async kpis(): Promise<ToolingKpis> {
    const all = await this.list();
    let active = 0;
    let inMaintenance = 0;
    let retired = 0;
    let nearEol = 0;
    let onLoan = 0;
    let calibrationOverdue = 0;
    let calibrationDueSoon = 0;
    let lifeSum = 0;
    let lifeCount = 0;

    for (const t of all) {
      if (t.status === 'AVAILABLE' || t.status === 'IN_USE') active += 1;
      if (t.status === 'IN_USE') onLoan += 1;
      if (t.status === 'MAINTENANCE') inMaintenance += 1;
      if (t.status === 'RETIRED') retired += 1;
      if (t.status !== 'RETIRED') {
        if (t.nearEol) nearEol += 1;
        if (t.calibrationStatus === 'OVERDUE') calibrationOverdue += 1;
        if (t.calibrationStatus === 'DUE_SOON') calibrationDueSoon += 1;
        lifeSum += t.lifePercent;
        lifeCount += 1;
      }
    }

    return {
      total: all.length,
      active,
      inMaintenance,
      retired,
      nearEol,
      onLoan,
      calibrationOverdue,
      calibrationDueSoon,
      avgLifeConsumedPct:
        lifeCount > 0 ? Math.round((lifeSum / lifeCount) * 10) / 10 : null,
    };
  }

  // ── Motor de alertas (EOL + calibración) → buzón. Reusa la infraestructura
  // existente de NotificationsService/UsersService; best-effort, deduplicado. ──

  /**
   * Barrido on-demand / programado: avisa por cada tool cerca de EOL y por cada
   * calibración por vencer o vencida. Deduplicado por `tool-eol:<id>` y
   * `tool-cal:<id>:<fecha>` en NotificationsService. Devuelve el conteo de avisos.
   */
  async scanAlerts(): Promise<{
    scanned: number;
    eolNotified: number;
    calNotified: number;
  }> {
    const all = await this.list();
    let eolNotified = 0;
    let calNotified = 0;
    for (const t of all) {
      if (t.status === 'RETIRED') continue;
      try {
        if (t.nearEol && (await this.maybeNotifyEol(t))) eolNotified += 1;
        if (
          (t.calibrationStatus === 'OVERDUE' || t.calibrationStatus === 'DUE_SOON') &&
          (await this.maybeNotifyCalibration(t))
        ) {
          calNotified += 1;
        }
      } catch (err) {
        this.logger.warn(
          `Tooling alert scan falló para ${t.id}: ${(err as Error)?.message}`,
        );
      }
    }
    return { scanned: all.length, eolNotified, calNotified };
  }

  /** Resuelve el destinatario (ingeniero) desde `created_by` (email) → user.id. */
  private async resolveRecipientUserId(t: Tool): Promise<string | null> {
    if (!this.users) return null;
    const owner = (t.created_by ?? '').trim();
    if (!owner || !owner.includes('@')) return null;
    const user = await this.users.findOneByEmail(owner);
    return user?.id ?? null;
  }

  private async maybeNotifyEol(t: Tool): Promise<boolean> {
    if (!this.notifications) return false;
    const userId = await this.resolveRecipientUserId(t);
    if (!userId) return false;
    const pct = lifePercent(t.shotsUsed, t.lifeShots);
    await this.notifications.create({
      userId,
      kind: 'system',
      severity: 'high',
      domain: 'engineering',
      source: 'tooling:eol',
      title: `${t.name} cerca de fin de vida (${pct}%)`,
      body: `Quedan ${remainingShots(t.shotsUsed, t.lifeShots).toLocaleString()} disparos de los ${Number(t.lifeShots ?? 0).toLocaleString()} de vida — planifica refacción o reemplazo.`,
      href: `/dashboard/tooling/${t.id}`,
      // UNA alerta de EOL por tool: el dedupe reusa la fila si ya se emitió.
      dedupeKey: `tool-eol:${t.id}`,
    });
    return true;
  }

  private async maybeNotifyCalibration(t: Tool): Promise<boolean> {
    if (!this.notifications) return false;
    const status = calibrationStatus(t.nextCalibrationDate);
    if (status !== 'OVERDUE' && status !== 'DUE_SOON') return false;
    const userId = await this.resolveRecipientUserId(t);
    if (!userId) return false;
    const next = t.nextCalibrationDate ? new Date(t.nextCalibrationDate) : null;
    const ymd = next ? ToolingService.ymd(next) : 'na';
    const overdue = status === 'OVERDUE';
    await this.notifications.create({
      userId,
      kind: 'system',
      severity: overdue ? 'critical' : 'high',
      domain: 'engineering',
      source: 'tooling:calibration',
      title: overdue
        ? `Calibración VENCIDA · ${t.name}`
        : `Calibración por vencer · ${t.name}`,
      body: overdue
        ? `La calibración venció el ${ymd}. No es apto para producción bajo IATF hasta recalibrar.`
        : `La calibración vence el ${ymd} (dentro de ${CALIBRATION_DUE_SOON_DAYS} días). Programa la recalibración.`,
      href: `/dashboard/tooling/${t.id}`,
      dedupeKey: `tool-cal:${t.id}:${ymd}`,
    });
    return true;
  }

  private static ymd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private async recordLedger(
    action: string,
    t: Tool,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.ENGINEERING,
        action,
        referenceType: 'TOOL',
        referenceId: t.id,
        program: t.programId ?? undefined,
        plant: t.plant_id ?? undefined,
        metadata: { folio: t.folio, name: t.name, shotsUsed: t.shotsUsed, ...extra },
      });
    } catch (err) {
      this.logger.warn(
        `Ledger write skipped for ${action}: ${(err as Error)?.message}`,
      );
    }
  }
}
