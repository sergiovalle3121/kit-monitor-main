import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { MmMaterial } from './entities/mm-material.entity';
import { MmAvl } from './entities/mm-avl.entity';
import { MmMaterialAlt } from './entities/mm-material-alt.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import {
  CreateAvlDto,
  CreateMaterialAltDto,
  CreateMaterialDto,
  UpdateAvlDto,
  UpdateMaterialDto,
} from './dto/material.dto';
import {
  assertTransition,
  defaultMakeBuy,
  isItemType,
  MaterialItemType,
  MaterialLifecycle,
} from './material-state';

export interface MaterialKpis {
  total: number;
  byStatus: Record<MaterialLifecycle, number>;
  byType: Record<MaterialItemType, number>;
  make: number;
  buy: number;
}

@Injectable()
export class MaterialMasterService {
  private readonly logger = new Logger(MaterialMasterService.name);

  constructor(
    @Inject(getTenantRepositoryToken(MmMaterial))
    private readonly repo: TenantScopedRepository<MmMaterial>,
    @Inject(getTenantRepositoryToken(MmAvl))
    private readonly avlRepo: TenantScopedRepository<MmAvl>,
    @Inject(getTenantRepositoryToken(MmMaterialAlt))
    private readonly altRepo: TenantScopedRepository<MmMaterialAlt>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
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

  // ── Material CRUD ──────────────────────────────────────────────────────────

  async create(dto: CreateMaterialDto): Promise<MmMaterial> {
    const partNumber = await this.resolvePartNumber(dto.partNumber);
    const itemType: MaterialItemType = isItemType(dto.itemType)
      ? dto.itemType
      : 'PURCHASED';
    const makeBuy = dto.makeBuy ?? defaultMakeBuy(itemType);

    const entity = this.repo.create({
      partNumber,
      description: dto.description.trim(),
      itemType,
      category: dto.category?.trim() || null,
      baseUom: dto.baseUom?.trim() || 'EA',
      makeBuy,
      lifecycle: 'DRAFT' as MaterialLifecycle,
      standardCost: dto.standardCost ?? 0,
      currency: dto.currency?.trim().toUpperCase() || 'USD',
      weight: dto.weight ?? null,
      weightUom: dto.weightUom?.trim() || 'kg',
      notes: dto.notes?.trim() || null,
      metadata: dto.metadata ?? null,
      activatedAt: null,
      obsoletedAt: null,
      ...this.scopeFields(),
    });
    const saved = await this.repo.save(entity);
    await this.recordLedger('MATERIAL_CREATED', saved, { after: saved });
    return saved;
  }

  private async resolvePartNumber(explicit?: string): Promise<string> {
    if (explicit?.trim()) {
      const candidate = explicit.trim().toUpperCase();
      if (await this.existsInScope(candidate)) {
        throw new BadRequestException(
          `Ya existe un material con el número ${candidate} en este alcance.`,
        );
      }
      return candidate;
    }
    try {
      return await this.numbering.allocate('MATERIAL');
    } catch (err) {
      this.logger.warn(`Folio allocation failed: ${(err as Error)?.message}`);
      return `MAT-${Date.now()}`;
    }
  }

  private async existsInScope(partNumber: string): Promise<boolean> {
    const qb = this.repo
      .createQueryBuilder('m')
      .where('UPPER(m.partNumber) = :pn', { pn: partNumber.toUpperCase() });
    this.applyScope(qb, 'm');
    return (await qb.getCount()) > 0;
  }

  async list(
    filters: { search?: string; status?: string; itemType?: string } = {},
  ): Promise<MmMaterial[]> {
    const qb = this.repo.createQueryBuilder('m').orderBy('m.created_at', 'DESC');
    this.applyScope(qb, 'm');
    if (filters.status) qb.andWhere('m.lifecycle = :s', { s: filters.status });
    if (filters.itemType)
      qb.andWhere('m.itemType = :t', { t: filters.itemType });
    if (filters.search?.trim()) {
      const q = `%${filters.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(m.partNumber) LIKE :q OR LOWER(m.description) LIKE :q OR LOWER(m.category) LIKE :q)',
        { q },
      );
    }
    return qb.getMany();
  }

  async getOne(id: string): Promise<MmMaterial> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Material no encontrado.');
    return found;
  }

  /** Lookup by internal part number (used by BOM / routing). */
  async findByPartNumber(partNumber: string): Promise<MmMaterial | null> {
    if (!partNumber?.trim()) return null;
    const qb = this.repo
      .createQueryBuilder('m')
      .where('UPPER(m.partNumber) = :pn', {
        pn: partNumber.trim().toUpperCase(),
      });
    this.applyScope(qb, 'm');
    return qb.getOne();
  }

  async update(id: string, dto: UpdateMaterialDto): Promise<MmMaterial> {
    const material = await this.getOne(id);
    const before = { ...material };
    Object.assign(material, {
      ...(dto.description !== undefined && {
        description: dto.description.trim(),
      }),
      ...(dto.itemType !== undefined && { itemType: dto.itemType }),
      ...(dto.category !== undefined && {
        category: dto.category.trim() || null,
      }),
      ...(dto.baseUom !== undefined && { baseUom: dto.baseUom.trim() || 'EA' }),
      ...(dto.makeBuy !== undefined && { makeBuy: dto.makeBuy }),
      ...(dto.standardCost !== undefined && { standardCost: dto.standardCost }),
      ...(dto.currency !== undefined && {
        currency: dto.currency.trim().toUpperCase() || 'USD',
      }),
      ...(dto.weight !== undefined && { weight: dto.weight }),
      ...(dto.weightUom !== undefined && {
        weightUom: dto.weightUom.trim() || 'kg',
      }),
      ...(dto.notes !== undefined && { notes: dto.notes.trim() || null }),
      ...(dto.metadata !== undefined && { metadata: dto.metadata }),
    });
    const saved = await this.repo.save(material);
    await this.recordLedger('MATERIAL_UPDATED', saved, { before, after: saved });
    return saved;
  }

  transition(id: string, to: MaterialLifecycle): Promise<MmMaterial> {
    return this.applyTransition(id, to);
  }

  private async applyTransition(
    id: string,
    to: MaterialLifecycle,
  ): Promise<MmMaterial> {
    const material = await this.getOne(id);
    const from = material.lifecycle;
    try {
      assertTransition(from, to);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    material.lifecycle = to;
    if (to === 'ACTIVE' && !material.activatedAt)
      material.activatedAt = new Date();
    if (to === 'OBSOLETE') material.obsoletedAt = new Date();
    const saved = await this.repo.save(material);
    await this.recordLedger('MATERIAL_TRANSITIONED', saved, {
      before: { status: from },
      after: { status: to },
    });
    return saved;
  }

  async kpis(): Promise<MaterialKpis> {
    const all = await this.list();
    const byStatus = { DRAFT: 0, ACTIVE: 0, HOLD: 0, OBSOLETE: 0 } as Record<
      MaterialLifecycle,
      number
    >;
    const byType = {
      PURCHASED: 0,
      MANUFACTURED: 0,
      PHANTOM: 0,
      NON_STOCK: 0,
      DOCUMENT: 0,
    } as Record<MaterialItemType, number>;
    let make = 0;
    let buy = 0;
    for (const m of all) {
      byStatus[m.lifecycle] = (byStatus[m.lifecycle] ?? 0) + 1;
      byType[m.itemType] = (byType[m.itemType] ?? 0) + 1;
      if (m.makeBuy === 'MAKE') make++;
      else buy++;
    }
    return { total: all.length, byStatus, byType, make, buy };
  }

  // ── AVL (approved manufacturers) ───────────────────────────────────────────

  async listAvl(materialId: string): Promise<MmAvl[]> {
    await this.getOne(materialId); // scope + existence guard
    const qb = this.avlRepo
      .createQueryBuilder('a')
      .where('a.materialId = :id', { id: materialId })
      .orderBy('a.preference', 'ASC')
      .addOrderBy('a.created_at', 'ASC');
    this.applyScope(qb, 'a');
    return qb.getMany();
  }

  async addAvl(materialId: string, dto: CreateAvlDto): Promise<MmAvl> {
    await this.getOne(materialId);
    const entity = this.avlRepo.create({
      materialId,
      manufacturer: dto.manufacturer.trim(),
      mpn: dto.mpn.trim(),
      status: dto.status ?? 'PENDING',
      preference: dto.preference ?? 1,
      leadTimeDays: dto.leadTimeDays ?? null,
      notes: dto.notes?.trim() || null,
      ...this.scopeFields(),
    });
    const saved = await this.avlRepo.save(entity);
    await this.recordLedger('MATERIAL_AVL_ADDED', { id: materialId }, {
      after: { manufacturer: saved.manufacturer, mpn: saved.mpn },
    });
    return saved;
  }

  async updateAvl(
    materialId: string,
    avlId: string,
    dto: UpdateAvlDto,
  ): Promise<MmAvl> {
    const avl = await this.getAvl(materialId, avlId);
    Object.assign(avl, {
      ...(dto.manufacturer !== undefined && {
        manufacturer: dto.manufacturer.trim(),
      }),
      ...(dto.mpn !== undefined && { mpn: dto.mpn.trim() }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.preference !== undefined && { preference: dto.preference }),
      ...(dto.leadTimeDays !== undefined && {
        leadTimeDays: dto.leadTimeDays,
      }),
      ...(dto.notes !== undefined && { notes: dto.notes.trim() || null }),
    });
    return this.avlRepo.save(avl);
  }

  async removeAvl(materialId: string, avlId: string): Promise<{ ok: true }> {
    const avl = await this.getAvl(materialId, avlId);
    await this.avlRepo.remove(avl);
    return { ok: true };
  }

  private async getAvl(materialId: string, avlId: string): Promise<MmAvl> {
    const found = await this.avlRepo.findOne({
      where: { id: avlId, materialId },
    });
    if (!found) throw new NotFoundException('Fabricante (AVL) no encontrado.');
    return found;
  }

  // ── Alternates / substitutes ───────────────────────────────────────────────

  async listAlternates(materialId: string): Promise<
    Array<MmMaterialAlt & { altMaterial?: MmMaterial | null }>
  > {
    await this.getOne(materialId);
    const qb = this.altRepo
      .createQueryBuilder('x')
      .where('x.materialId = :id', { id: materialId })
      .orderBy('x.created_at', 'ASC');
    this.applyScope(qb, 'x');
    const rows = await qb.getMany();
    // Enrich with the alternate material's part number/description.
    const out: Array<MmMaterialAlt & { altMaterial?: MmMaterial | null }> = [];
    for (const r of rows) {
      const alt = await this.repo.findOne({ where: { id: r.altMaterialId } });
      out.push({ ...r, altMaterial: alt });
    }
    return out;
  }

  async addAlternate(
    materialId: string,
    dto: CreateMaterialAltDto,
  ): Promise<MmMaterialAlt> {
    if (dto.altMaterialId === materialId) {
      throw new BadRequestException(
        'Un material no puede ser alternante de sí mismo.',
      );
    }
    await this.getOne(materialId);
    const alt = await this.repo.findOne({ where: { id: dto.altMaterialId } });
    if (!alt) {
      throw new BadRequestException(
        'El material alternante no existe en el maestro.',
      );
    }
    const entity = this.altRepo.create({
      materialId,
      altMaterialId: dto.altMaterialId,
      type: dto.type ?? 'ALTERNATE',
      bidirectional: dto.bidirectional ?? true,
      ratio: dto.ratio ?? 1,
      notes: dto.notes?.trim() || null,
      ...this.scopeFields(),
    });
    return this.altRepo.save(entity);
  }

  async removeAlternate(
    materialId: string,
    altId: string,
  ): Promise<{ ok: true }> {
    const found = await this.altRepo.findOne({
      where: { id: altId, materialId },
    });
    if (!found) throw new NotFoundException('Alternante no encontrado.');
    await this.altRepo.remove(found);
    return { ok: true };
  }

  // ── Ledger ─────────────────────────────────────────────────────────────────

  private async recordLedger(
    action: string,
    material: Pick<MmMaterial, 'id'> & Partial<MmMaterial>,
    states: { before?: unknown; after?: unknown },
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.MATERIALS,
        action,
        referenceType: 'MATERIAL',
        referenceId: material.id,
        plant: material.plant_id ?? undefined,
        metadata: {
          partNumber: material.partNumber,
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
