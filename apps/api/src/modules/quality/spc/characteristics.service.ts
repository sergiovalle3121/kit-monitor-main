import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { QualityCharacteristic } from '../entities/quality-characteristic.entity';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../../common/tenant/tenant-scoped.repository';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { DocumentNumberingService } from '../../numbering/document-numbering.service';
import { EventLedgerService } from '../../event-ledger/event-ledger.service';
import { EventDomain } from '../../event-ledger/entities/ledger-event.entity';
import { assertSpecLimits } from './spc-math';
import {
  CreateCharacteristicDto,
  ListCharacteristicsQuery,
  UpdateCharacteristicDto,
} from './dto';

/**
 * CTQ catalog service — the spec side of the SPC data foundation.
 *
 * Owns `qc_characteristics`: defining WHAT is measured on a model (nominal,
 * USL, LSL, unit) and guaranteeing the limit window is coherent. Tenant scope
 * is applied explicitly on QueryBuilder reads (mirrors ProductModelsService),
 * since the tenant-scoped repository only auto-filters find/count calls.
 */
@Injectable()
export class CharacteristicsService {
  private readonly logger = new Logger(CharacteristicsService.name);

  constructor(
    @Inject(getTenantRepositoryToken(QualityCharacteristic))
    private readonly repo: TenantScopedRepository<QualityCharacteristic>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  private applyScope(
    qb: SelectQueryBuilder<QualityCharacteristic>,
    alias: string,
  ): SelectQueryBuilder<QualityCharacteristic> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  async list(
    filters: ListCharacteristicsQuery = {},
  ): Promise<QualityCharacteristic[]> {
    const qb = this.repo
      .createQueryBuilder('c')
      .orderBy('c.created_at', 'DESC');
    this.applyScope(qb, 'c');

    if (filters.model?.trim()) {
      qb.andWhere('c.model_id = :model', { model: filters.model.trim() });
    }
    if (filters.type) {
      qb.andWhere('c.type = :type', { type: filters.type });
    }
    if (filters.active === 'true' || filters.active === 'false') {
      qb.andWhere('c.active = :active', { active: filters.active === 'true' });
    }
    if (filters.search?.trim()) {
      const q = `%${filters.search.trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(c.code) LIKE :q OR LOWER(c.name) LIKE :q)', { q });
    }
    return qb.getMany();
  }

  async getOne(id: string): Promise<QualityCharacteristic> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Característica no encontrada.');
    return found;
  }

  async create(
    dto: CreateCharacteristicDto,
  ): Promise<QualityCharacteristic> {
    if (!dto.name?.trim()) {
      throw new BadRequestException('El nombre de la característica es obligatorio.');
    }
    const type = (dto.type ?? 'VARIABLE') as QualityCharacteristic['type'];
    assertSpecLimits({ type, nominal: dto.nominal, usl: dto.usl, lsl: dto.lsl });

    const code = await this.resolveCode(dto.code);
    const entity = this.repo.create({
      code,
      name: dto.name.trim(),
      modelId: dto.modelId?.trim() || null,
      operationId: dto.operationId?.trim() || null,
      station: dto.station?.trim() || null,
      type,
      unit: type === 'ATTRIBUTE' ? null : dto.unit?.trim() || null,
      nominal: numeric(dto.nominal),
      usl: numeric(dto.usl),
      lsl: numeric(dto.lsl),
      isCritical: dto.isCritical ?? true,
      active: dto.active ?? true,
      notes: dto.notes?.trim() || null,
      tenant_id: this.tenantCtx.getTenantId(),
      organization_id: this.tenantCtx.getOrganizationId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    const saved = await this.repo.save(entity);
    await this.recordLedger('QC_CHARACTERISTIC_CREATED', saved);
    return saved;
  }

  async update(
    id: string,
    dto: UpdateCharacteristicDto,
  ): Promise<QualityCharacteristic> {
    const c = await this.getOne(id);
    const merged = {
      type: dto.type ?? c.type,
      nominal: dto.nominal !== undefined ? numeric(dto.nominal) : c.nominal,
      usl: dto.usl !== undefined ? numeric(dto.usl) : c.usl,
      lsl: dto.lsl !== undefined ? numeric(dto.lsl) : c.lsl,
    };
    assertSpecLimits(merged);

    if (dto.name !== undefined) {
      if (!dto.name.trim())
        throw new BadRequestException('El nombre no puede quedar vacío.');
      c.name = dto.name.trim();
    }
    if (dto.modelId !== undefined) c.modelId = dto.modelId?.trim() || null;
    if (dto.operationId !== undefined)
      c.operationId = dto.operationId?.trim() || null;
    if (dto.station !== undefined) c.station = dto.station?.trim() || null;
    if (dto.type !== undefined) c.type = merged.type;
    if (dto.unit !== undefined)
      c.unit = merged.type === 'ATTRIBUTE' ? null : dto.unit?.trim() || null;
    if (dto.nominal !== undefined) c.nominal = merged.nominal;
    if (dto.usl !== undefined) c.usl = merged.usl;
    if (dto.lsl !== undefined) c.lsl = merged.lsl;
    if (dto.isCritical !== undefined) c.isCritical = dto.isCritical;
    if (dto.active !== undefined) c.active = dto.active;
    if (dto.notes !== undefined) c.notes = dto.notes?.trim() || null;

    const saved = await this.repo.save(c);
    await this.recordLedger('QC_CHARACTERISTIC_UPDATED', saved);
    return saved;
  }

  /** Soft delete: preserves any measurements that already reference this CTQ. */
  async remove(id: string): Promise<{ id: string; deleted: true }> {
    const c = await this.getOne(id);
    await this.repo.softRemove(c);
    await this.recordLedger('QC_CHARACTERISTIC_DELETED', c);
    return { id, deleted: true };
  }

  private async resolveCode(explicit?: string): Promise<string> {
    if (explicit?.trim()) {
      const candidate = explicit.trim().toUpperCase();
      const qb = this.repo
        .createQueryBuilder('c')
        .where('UPPER(c.code) = :code', { code: candidate });
      this.applyScope(qb, 'c');
      if ((await qb.getCount()) > 0) {
        throw new BadRequestException(
          `Ya existe una característica con el código ${candidate} en este alcance.`,
        );
      }
      return candidate;
    }
    try {
      return await this.numbering.allocate('CTQ');
    } catch (err) {
      this.logger.warn(`Folio CTQ allocation failed: ${(err as Error)?.message}`);
      return `CTQ-${Date.now()}`;
    }
  }

  private async recordLedger(
    action: string,
    c: QualityCharacteristic,
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.QUALITY,
        action,
        referenceType: 'QC_CHARACTERISTIC',
        referenceId: c.id,
        metadata: {
          code: c.code,
          name: c.name,
          modelId: c.modelId,
          type: c.type,
          nominal: c.nominal,
          usl: c.usl,
          lsl: c.lsl,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Ledger write skipped for ${action}: ${(err as Error)?.message}`,
      );
    }
  }
}

function numeric(v: number | null | undefined): number | null {
  if (v === null || v === undefined || v === ('' as unknown)) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
