import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Tool } from './entities/tool.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import {
  CreateToolDto,
  RecordUsageDto,
  SetToolStatusDto,
} from './dto/tooling.dto';
import { isNearEol, lifePercent, remainingShots } from './tool-life';

export type SerializedTool = Tool & {
  lifePercent: number;
  remainingShots: number;
  nearEol: boolean;
};

export interface ToolingKpis {
  total: number;
  active: number;
  inMaintenance: number;
  retired: number;
  nearEol: number;
  avgLifeConsumedPct: number | null;
}

@Injectable()
export class ToolingService {
  private readonly logger = new Logger(ToolingService.name);

  constructor(
    @InjectRepository(Tool)
    private readonly repo: Repository<Tool>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    @Optional() private readonly ledger?: EventLedgerService,
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

  private serialize(t: Tool): SerializedTool {
    return {
      ...t,
      lifePercent: lifePercent(t.shotsUsed, t.lifeShots),
      remainingShots: remainingShots(t.shotsUsed, t.lifeShots),
      nearEol: isNearEol(t.shotsUsed, t.lifeShots),
    };
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
    return rows.map((t) => this.serialize(t));
  }

  async getOne(id: string): Promise<SerializedTool> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Herramental no encontrado.');
    return this.serialize(found);
  }

  async recordUsage(id: string, dto: RecordUsageDto): Promise<SerializedTool> {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Herramental no encontrado.');
    t.shotsUsed = Math.max(0, Number(t.shotsUsed ?? 0)) + dto.shots;
    const saved = await this.repo.save(t);
    await this.recordLedger('TOOL_USAGE_RECORDED', saved);
    return this.serialize(saved);
  }

  async setStatus(id: string, dto: SetToolStatusDto): Promise<SerializedTool> {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Herramental no encontrado.');
    t.status = dto.status;
    const saved = await this.repo.save(t);
    await this.recordLedger('TOOL_STATUS_CHANGED', saved);
    return this.serialize(saved);
  }

  async kpis(): Promise<ToolingKpis> {
    const all = await this.list();
    let active = 0;
    let inMaintenance = 0;
    let retired = 0;
    let nearEol = 0;
    let lifeSum = 0;
    let lifeCount = 0;

    for (const t of all) {
      if (t.status === 'AVAILABLE' || t.status === 'IN_USE') active += 1;
      if (t.status === 'MAINTENANCE') inMaintenance += 1;
      if (t.status === 'RETIRED') retired += 1;
      if (t.status !== 'RETIRED') {
        if (t.nearEol) nearEol += 1;
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
      avgLifeConsumedPct:
        lifeCount > 0 ? Math.round((lifeSum / lifeCount) * 10) / 10 : null,
    };
  }

  private async recordLedger(action: string, t: Tool): Promise<void> {
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
        metadata: { folio: t.folio, name: t.name, shotsUsed: t.shotsUsed },
      });
    } catch (err) {
      this.logger.warn(
        `Ledger write skipped for ${action}: ${(err as Error)?.message}`,
      );
    }
  }
}
