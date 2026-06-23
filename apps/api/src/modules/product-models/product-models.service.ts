import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { ProductModel } from './entities/product-model.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { NpiService, ReadinessSnapshot } from '../npi/npi.service';
import {
  CreateProductModelDto,
  UpdateProductModelDto,
} from './dto/product-model.dto';
import { assertTransition, ProductModelStatus } from './product-model-state';

export interface ProductModelKpis {
  total: number;
  byStatus: Record<ProductModelStatus, number>;
  active: number;
}

@Injectable()
export class ProductModelsService {
  private readonly logger = new Logger(ProductModelsService.name);

  constructor(
    @Inject(getTenantRepositoryToken(ProductModel))
    private readonly repo: TenantScopedRepository<ProductModel>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    @Optional() private readonly ledger?: EventLedgerService,
    @Optional() private readonly npi?: NpiService,
  ) {}

  private applyScope(
    qb: SelectQueryBuilder<ProductModel>,
    alias: string,
  ): SelectQueryBuilder<ProductModel> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  async create(dto: CreateProductModelDto): Promise<ProductModel> {
    const modelNumber = await this.resolveModelNumber(dto.modelNumber);

    const entity = this.repo.create({
      modelNumber,
      name: dto.name.trim(),
      customer: dto.customer?.trim() || null,
      revision: dto.revision?.trim() || '1.0',
      status: 'DRAFT' as ProductModelStatus,
      description: dto.description?.trim() || null,
      programId: dto.programId?.trim() || null,
      metadata: dto.metadata ?? null,
      activatedAt: null,
      obsoletedAt: null,
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    const saved = await this.repo.save(entity);
    await this.recordLedger('PRODUCT_MODEL_CREATED', saved, { after: saved });
    return saved;
  }

  /**
   * Resolve a unique, scoped model number: honor an explicit one (validating it
   * is free) or allocate a folio. Numbering must never block model capture, so
   * a derived fallback is used if allocation throws.
   */
  private async resolveModelNumber(explicit?: string): Promise<string> {
    if (explicit?.trim()) {
      const candidate = explicit.trim().toUpperCase();
      if (await this.existsInScope(candidate)) {
        throw new BadRequestException(
          `Ya existe un modelo con el número ${candidate} en este alcance.`,
        );
      }
      return candidate;
    }
    try {
      return await this.numbering.allocate('MODEL');
    } catch (err) {
      this.logger.warn(`Folio allocation failed: ${(err as Error)?.message}`);
      return `MDL-${Date.now()}`;
    }
  }

  private async existsInScope(modelNumber: string): Promise<boolean> {
    const qb = this.repo
      .createQueryBuilder('pm')
      .where('UPPER(pm.modelNumber) = :mn', { mn: modelNumber.toUpperCase() });
    this.applyScope(qb, 'pm');
    return (await qb.getCount()) > 0;
  }

  async list(
    filters: { search?: string; status?: string } = {},
  ): Promise<ProductModel[]> {
    const qb = this.repo
      .createQueryBuilder('pm')
      .orderBy('pm.created_at', 'DESC');
    this.applyScope(qb, 'pm');
    if (filters.status) qb.andWhere('pm.status = :s', { s: filters.status });
    if (filters.search?.trim()) {
      const q = `%${filters.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(pm.modelNumber) LIKE :q OR LOWER(pm.name) LIKE :q OR LOWER(pm.customer) LIKE :q)',
        { q },
      );
    }
    return qb.getMany();
  }

  async getOne(id: string): Promise<ProductModel> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Modelo no encontrado.');
    return found;
  }

  /** Lookup by canonical model number (used by planning / process routing). */
  async findByNumber(modelNumber: string): Promise<ProductModel | null> {
    if (!modelNumber?.trim()) return null;
    const qb = this.repo
      .createQueryBuilder('pm')
      .where('UPPER(pm.modelNumber) = :mn', {
        mn: modelNumber.trim().toUpperCase(),
      });
    this.applyScope(qb, 'pm');
    return qb.getOne();
  }

  async update(id: string, dto: UpdateProductModelDto): Promise<ProductModel> {
    const model = await this.getOne(id);
    const before = { ...model };
    Object.assign(model, {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.customer !== undefined && {
        customer: dto.customer.trim() || null,
      }),
      ...(dto.revision !== undefined && {
        revision: dto.revision.trim() || '1.0',
      }),
      ...(dto.description !== undefined && {
        description: dto.description.trim() || null,
      }),
      ...(dto.programId !== undefined && {
        programId: dto.programId.trim() || null,
      }),
      ...(dto.metadata !== undefined && { metadata: dto.metadata }),
    });
    const saved = await this.repo.save(model);
    await this.recordLedger('PRODUCT_MODEL_UPDATED', saved, {
      before,
      after: saved,
    });
    return saved;
  }

  /**
   * Whether the NPI readiness gate is ENFORCED on activation. Opt-in via env so
   * the default behavior is unchanged (advisory only) — flipping it on turns the
   * advisory aggregator into a hard gate that callers can still override (force).
   */
  private enforceReadiness(): boolean {
    return process.env.NPI_ENFORCE_READINESS === 'true';
  }

  /** Live NPI readiness for a model (read-only, best-effort, advisory). */
  async readiness(id: string): Promise<ReadinessSnapshot | null> {
    const model = await this.getOne(id);
    return this.deriveReadinessSafe(model);
  }

  private async deriveReadinessSafe(
    model: ProductModel,
  ): Promise<ReadinessSnapshot | null> {
    if (!this.npi) return null;
    try {
      return await this.npi.deriveReadiness(model.modelNumber, model.revision);
    } catch (err) {
      this.logger.warn(
        `Readiness NPI no disponible para ${model.modelNumber}: ${(err as Error)?.message}`,
      );
      return null;
    }
  }

  /**
   * Activate a model (DRAFT/OBSOLETE → ACTIVE). The NPI readiness aggregator is
   * consulted as an ADVISORY soft-gate: by default activation always proceeds
   * and the readiness verdict is attached/snapshotted/audited. Only when
   * `NPI_ENFORCE_READINESS=true` (and `force` is not set) does a not-ready model
   * block — keeping this fully backward compatible.
   */
  async activate(
    id: string,
    opts: { force?: boolean } = {},
  ): Promise<ProductModel & { readiness?: ReadinessSnapshot | null }> {
    const model = await this.getOne(id);
    const readiness = await this.deriveReadinessSafe(model);

    if (
      readiness &&
      !readiness.gateReady &&
      this.enforceReadiness() &&
      !opts.force
    ) {
      throw new BadRequestException(
        `El modelo ${model.modelNumber} no está listo (NPI): ` +
          `${readiness.blockers.join(', ') || 'criterios sin resolver'}. ` +
          `Usa force=true para activar de todos modos.`,
      );
    }

    const saved = await this.transition(id, 'ACTIVE');

    // Best-effort audit: snapshot the readiness at activation + ledger note.
    if (this.npi && readiness) {
      await this.npi
        .captureSnapshot(model.modelNumber, model.revision, {
          phase: 'MP',
          reason: 'MODEL_ACTIVATION',
          note: readiness.gateReady
            ? 'Activación con readiness en verde.'
            : `Activación con readiness incompleta: ${readiness.blockers.join(', ') || 'pendientes'}.`,
        })
        .catch((err) =>
          this.logger.warn(
            `Snapshot de activación omitido: ${(err as Error)?.message}`,
          ),
        );
      await this.recordLedger('PRODUCT_MODEL_ACTIVATION_READINESS', saved, {
        after: {
          gateReady: readiness.gateReady,
          blockers: readiness.blockers,
          unknowns: readiness.unknowns,
        },
      });
    }

    // Attach the advisory verdict to the response without changing the entity.
    return Object.assign(saved, { readiness });
  }

  obsolete(id: string): Promise<ProductModel> {
    return this.transition(id, 'OBSOLETE');
  }

  private async transition(
    id: string,
    to: ProductModelStatus,
  ): Promise<ProductModel> {
    const model = await this.getOne(id);
    const from = model.status;
    try {
      assertTransition(from, to);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    model.status = to;
    if (to === 'ACTIVE') model.activatedAt = new Date();
    if (to === 'OBSOLETE') model.obsoletedAt = new Date();
    const saved = await this.repo.save(model);
    await this.recordLedger('PRODUCT_MODEL_TRANSITIONED', saved, {
      before: { status: from },
      after: { status: to },
    });
    return saved;
  }

  async kpis(): Promise<ProductModelKpis> {
    const all = await this.list();
    const byStatus = { DRAFT: 0, ACTIVE: 0, OBSOLETE: 0 };
    for (const m of all) byStatus[m.status] = (byStatus[m.status] ?? 0) + 1;
    return { total: all.length, byStatus, active: byStatus.ACTIVE };
  }

  private async recordLedger(
    action: string,
    model: ProductModel,
    states: { before?: unknown; after?: unknown },
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.SYSTEM,
        action,
        referenceType: 'PRODUCT_MODEL',
        referenceId: model.id,
        program: model.programId ?? undefined,
        plant: model.plant_id ?? undefined,
        metadata: {
          modelNumber: model.modelNumber,
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
