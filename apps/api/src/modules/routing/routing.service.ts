import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { RtRouting } from './entities/rt-routing.entity';
import { RtOperation } from './entities/rt-operation.entity';
import { RtOperationMaterial } from './entities/rt-operation-material.entity';
import { MmMaterial } from '../material-master/entities/mm-material.entity';
import { MaterialMasterService } from '../material-master/material-master.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import {
  CreateOperationDto,
  CreateOperationMaterialDto,
  CreateRoutingDto,
  UpdateOperationDto,
  UpdateRoutingDto,
} from './dto/routing.dto';
import {
  assertTransition,
  rollupRoutingTime,
  RoutingStatus,
  RoutingTotals,
} from './routing-logic';

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(
    @Inject(getTenantRepositoryToken(RtRouting))
    private readonly routings: TenantScopedRepository<RtRouting>,
    @Inject(getTenantRepositoryToken(RtOperation))
    private readonly ops: TenantScopedRepository<RtOperation>,
    @Inject(getTenantRepositoryToken(RtOperationMaterial))
    private readonly opMats: TenantScopedRepository<RtOperationMaterial>,
    private readonly materials: MaterialMasterService,
    private readonly tenantCtx: TenantContextService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  private applyScope<T extends { tenant_id?: string | null }>(
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

  private scopeFields() {
    return {
      tenant_id: this.tenantCtx.getTenantId(),
      organization_id: this.tenantCtx.getOrganizationId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    };
  }

  private async materialMap(): Promise<Map<string, MmMaterial>> {
    const all = await this.materials.list();
    return new Map(all.map((m) => [m.id, m]));
  }

  // ── Routing header ──────────────────────────────────────────────────────────

  async listRoutings(
    filters: { search?: string; status?: string } = {},
  ): Promise<Array<RtRouting & { material?: MmMaterial | null; operationCount: number }>> {
    const qb = this.routings.createQueryBuilder('r').orderBy('r.created_at', 'DESC');
    this.applyScope(qb, 'r');
    if (filters.status) qb.andWhere('r.status = :s', { s: filters.status });
    const rows = await qb.getMany();
    const mats = await this.materialMap();

    let filtered = rows;
    if (filters.search?.trim()) {
      const q = filters.search.trim().toLowerCase();
      filtered = rows.filter((r) => {
        const m = mats.get(r.materialId);
        return `${m?.partNumber ?? ''} ${m?.description ?? ''} ${r.name ?? ''}`
          .toLowerCase()
          .includes(q);
      });
    }

    const counts = await this.opCountsByRouting(filtered.map((r) => r.id));
    return filtered.map((r) => ({
      ...r,
      material: mats.get(r.materialId) ?? null,
      operationCount: counts.get(r.id) ?? 0,
    }));
  }

  private async opCountsByRouting(ids: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (!ids.length) return out;
    const qb = this.ops
      .createQueryBuilder('o')
      .select('o.routingId', 'routingId')
      .addSelect('COUNT(*)', 'cnt')
      .where('o.routingId IN (:...ids)', { ids })
      .groupBy('o.routingId');
    this.applyScope(qb, 'o');
    const raw = await qb.getRawMany<{ routingId: string; cnt: string }>();
    for (const r of raw) out.set(r.routingId, Number(r.cnt));
    return out;
  }

  async getRouting(id: string): Promise<
    RtRouting & {
      material?: MmMaterial | null;
      totals: RoutingTotals;
      operations: Array<
        RtOperation & {
          materials: Array<RtOperationMaterial & { material?: MmMaterial | null }>;
        }
      >;
    }
  > {
    const routing = await this.requireRouting(id);
    const mats = await this.materialMap();

    const opQb = this.ops
      .createQueryBuilder('o')
      .where('o.routingId = :id', { id })
      .orderBy('o.sequence', 'ASC');
    this.applyScope(opQb, 'o');
    const operations = await opQb.getMany();

    const opMatsByOp = await this.materialsByOperations(operations.map((o) => o.id));

    return {
      ...routing,
      material: mats.get(routing.materialId) ?? null,
      totals: rollupRoutingTime(operations, 1),
      operations: operations.map((o) => ({
        ...o,
        materials: (opMatsByOp.get(o.id) ?? []).map((om) => ({
          ...om,
          material: mats.get(om.materialId) ?? null,
        })),
      })),
    };
  }

  private async materialsByOperations(
    opIds: string[],
  ): Promise<Map<string, RtOperationMaterial[]>> {
    const out = new Map<string, RtOperationMaterial[]>();
    if (!opIds.length) return out;
    const qb = this.opMats
      .createQueryBuilder('m')
      .where('m.operationId IN (:...ids)', { ids: opIds })
      .orderBy('m.created_at', 'ASC');
    this.applyScope(qb, 'm');
    const rows = await qb.getMany();
    for (const m of rows) {
      const arr = out.get(m.operationId) ?? [];
      arr.push(m);
      out.set(m.operationId, arr);
    }
    return out;
  }

  /** Standard-time roll-up for a lot of `qty`. */
  async totals(id: string, qty: number): Promise<RoutingTotals> {
    await this.requireRouting(id);
    const qb = this.ops
      .createQueryBuilder('o')
      .where('o.routingId = :id', { id });
    this.applyScope(qb, 'o');
    const operations = await qb.getMany();
    return rollupRoutingTime(operations, qty);
  }

  async createRouting(dto: CreateRoutingDto): Promise<RtRouting> {
    const material = await this.materials.getOne(dto.materialId);
    const revision = dto.revision?.trim() || '1.0';
    if (await this.routingExists(dto.materialId, revision)) {
      throw new BadRequestException(
        `Ya existe un ruteo para ${material.partNumber} rev ${revision}.`,
      );
    }
    const entity = this.routings.create({
      materialId: dto.materialId,
      revision,
      status: 'DRAFT' as RoutingStatus,
      name: dto.name?.trim() || null,
      notes: dto.notes?.trim() || null,
      metadata: dto.metadata ?? null,
      ...this.scopeFields(),
    });
    const saved = await this.routings.save(entity);
    await this.recordLedger('ROUTING_CREATED', saved.id, material.partNumber, {
      after: { materialId: dto.materialId, revision },
    });
    return saved;
  }

  private async routingExists(materialId: string, revision: string): Promise<boolean> {
    const qb = this.routings
      .createQueryBuilder('r')
      .where('r.materialId = :m', { m: materialId })
      .andWhere('r.revision = :rev', { rev: revision });
    this.applyScope(qb, 'r');
    return (await qb.getCount()) > 0;
  }

  async updateRouting(id: string, dto: UpdateRoutingDto): Promise<RtRouting> {
    const routing = await this.requireRouting(id);
    Object.assign(routing, {
      ...(dto.revision !== undefined && { revision: dto.revision.trim() || '1.0' }),
      ...(dto.name !== undefined && { name: dto.name.trim() || null }),
      ...(dto.notes !== undefined && { notes: dto.notes.trim() || null }),
      ...(dto.metadata !== undefined && { metadata: dto.metadata }),
    });
    return this.routings.save(routing);
  }

  async transitionRouting(id: string, to: RoutingStatus): Promise<RtRouting> {
    const routing = await this.requireRouting(id);
    const from = routing.status;
    try {
      assertTransition(from, to);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    routing.status = to;
    const saved = await this.routings.save(routing);
    await this.recordLedger('ROUTING_TRANSITIONED', id, undefined, {
      before: { status: from },
      after: { status: to },
    });
    return saved;
  }

  async deleteRouting(id: string): Promise<{ ok: true }> {
    const routing = await this.requireRouting(id);
    const operations = await this.ops.find({ where: { routingId: id } });
    if (operations.length) {
      const opMats = await this.opMats.find({
        where: operations.map((o) => ({ operationId: o.id })),
      });
      if (opMats.length) await this.opMats.remove(opMats);
      await this.ops.remove(operations);
    }
    await this.routings.remove(routing);
    return { ok: true };
  }

  private async requireRouting(id: string): Promise<RtRouting> {
    const routing = await this.routings.findOne({ where: { id } });
    if (!routing) throw new NotFoundException('Ruteo no encontrado.');
    return routing;
  }

  // ── Operations ──────────────────────────────────────────────────────────────

  async addOperation(routingId: string, dto: CreateOperationDto): Promise<RtOperation> {
    await this.requireRouting(routingId);
    const sequence = dto.sequence ?? (await this.nextSequence(routingId));
    if (await this.sequenceTaken(routingId, sequence)) {
      throw new BadRequestException(
        `Ya existe una operación con secuencia ${sequence} en este ruteo.`,
      );
    }
    const entity = this.ops.create({
      routingId,
      sequence,
      name: dto.name.trim(),
      workCenter: dto.workCenter?.trim() || null,
      setupTimeMin: dto.setupTimeMin ?? 0,
      runTimePerUnitMin: dto.runTimePerUnitMin ?? 0,
      description: dto.description?.trim() || null,
      visualAidRef: dto.visualAidRef?.trim() || null,
      ...this.scopeFields(),
    });
    return this.ops.save(entity);
  }

  private async nextSequence(routingId: string): Promise<number> {
    const qb = this.ops
      .createQueryBuilder('o')
      .select('MAX(o.sequence)', 'max')
      .where('o.routingId = :id', { id: routingId });
    this.applyScope(qb, 'o');
    const raw = await qb.getRawOne<{ max: number | null }>();
    const max = Number(raw?.max ?? 0);
    return (Math.floor(max / 10) + 1) * 10;
  }

  private async sequenceTaken(routingId: string, sequence: number): Promise<boolean> {
    const qb = this.ops
      .createQueryBuilder('o')
      .where('o.routingId = :id', { id: routingId })
      .andWhere('o.sequence = :s', { s: sequence });
    this.applyScope(qb, 'o');
    return (await qb.getCount()) > 0;
  }

  async updateOperation(
    routingId: string,
    opId: string,
    dto: UpdateOperationDto,
  ): Promise<RtOperation> {
    const op = await this.requireOperation(routingId, opId);
    if (
      dto.sequence !== undefined &&
      dto.sequence !== op.sequence &&
      (await this.sequenceTaken(routingId, dto.sequence))
    ) {
      throw new BadRequestException(
        `Ya existe una operación con secuencia ${dto.sequence}.`,
      );
    }
    Object.assign(op, {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.sequence !== undefined && { sequence: dto.sequence }),
      ...(dto.workCenter !== undefined && { workCenter: dto.workCenter.trim() || null }),
      ...(dto.setupTimeMin !== undefined && { setupTimeMin: dto.setupTimeMin }),
      ...(dto.runTimePerUnitMin !== undefined && {
        runTimePerUnitMin: dto.runTimePerUnitMin,
      }),
      ...(dto.description !== undefined && { description: dto.description.trim() || null }),
      ...(dto.visualAidRef !== undefined && {
        visualAidRef: dto.visualAidRef.trim() || null,
      }),
    });
    return this.ops.save(op);
  }

  async removeOperation(routingId: string, opId: string): Promise<{ ok: true }> {
    const op = await this.requireOperation(routingId, opId);
    const opMats = await this.opMats.find({ where: { operationId: opId } });
    if (opMats.length) await this.opMats.remove(opMats);
    await this.ops.remove(op);
    return { ok: true };
  }

  private async requireOperation(routingId: string, opId: string): Promise<RtOperation> {
    const op = await this.ops.findOne({ where: { id: opId, routingId } });
    if (!op) throw new NotFoundException('Operación no encontrada.');
    return op;
  }

  // ── Operation ↔ material (BOM bridge) ────────────────────────────────────────

  async addOperationMaterial(
    routingId: string,
    opId: string,
    dto: CreateOperationMaterialDto,
  ): Promise<RtOperationMaterial> {
    await this.requireOperation(routingId, opId);
    const material = await this.materials.getOne(dto.materialId);
    const entity = this.opMats.create({
      operationId: opId,
      materialId: dto.materialId,
      bomLineId: dto.bomLineId?.trim() || null,
      qtyPerUnit: dto.qtyPerUnit ?? 1,
      uom: dto.uom?.trim() || material.baseUom || 'EA',
      notes: dto.notes?.trim() || null,
      ...this.scopeFields(),
    });
    return this.opMats.save(entity);
  }

  async removeOperationMaterial(
    routingId: string,
    opId: string,
    matId: string,
  ): Promise<{ ok: true }> {
    await this.requireOperation(routingId, opId);
    const found = await this.opMats.findOne({
      where: { id: matId, operationId: opId },
    });
    if (!found) throw new NotFoundException('Material de operación no encontrado.');
    await this.opMats.remove(found);
    return { ok: true };
  }

  // ── Ledger ──────────────────────────────────────────────────────────────────

  private async recordLedger(
    action: string,
    referenceId: string,
    partNumber: string | undefined,
    states: { before?: unknown; after?: unknown },
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.ENGINEERING,
        action,
        referenceType: 'ROUTING',
        referenceId,
        plant: this.tenantCtx.getPlantId() ?? undefined,
        metadata: {
          partNumber,
          beforeState: states.before,
          afterState: states.after,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Ledger write skipped for ${action}: ${(err as Error)?.message}`,
      );
    }
  }
}
