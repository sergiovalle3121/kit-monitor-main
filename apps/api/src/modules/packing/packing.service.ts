import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { HandlingUnit } from './entities/handling-unit.entity';
import { CreateHandlingUnitDto, UpdateHandlingUnitDto } from './dto/packing.dto';
import { buildSscc } from './packing.sscc';
import { ssccLabelZpl } from './packing.zpl';
import { sanitizeContents, summarizeContents } from './packing.rules';
import {
  classifyScan,
  computeLoadingState,
  normalizeSscc,
  type LoadingState,
  type ScanOutcome,
} from './packing.loading';

/**
 * Packing service — handling units (pallets/cartons) with GS1 SSCC + ZPL labels.
 * Tenant-scoped like the outbound spine. SSCC serials come from the central
 * numbering service (docType SSCC); the company prefix from env GS1_COMPANY_PREFIX
 * (placeholder flagged honestly until configured). References shipments by id.
 */
@Injectable()
export class PackingService {
  private readonly logger = new Logger(PackingService.name);

  constructor(
    @InjectRepository(HandlingUnit) private readonly repo: Repository<HandlingUnit>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
  ) {}

  private applyScope<T extends ObjectLiteral>(
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

  /** Allocate the next SSCC (serial from numbering, prefix from env). */
  private async nextSscc(): Promise<{ sscc: string; placeholder: boolean }> {
    let serial = Date.now() % 1_000_000; // safe fallback if numbering is unavailable
    try {
      const folio = await this.numbering.allocate('SSCC');
      const digits = folio.replace(/\D/g, '');
      if (digits) serial = parseInt(digits, 10);
    } catch (err) {
      this.logger.warn(`SSCC serial allocation failed: ${(err as Error)?.message}`);
    }
    return buildSscc(process.env.GS1_COMPANY_PREFIX, serial);
  }

  async list(filters: { shipmentId?: string; status?: string } = {}): Promise<HandlingUnit[]> {
    const qb = this.repo.createQueryBuilder('h').orderBy('h.created_at', 'ASC');
    this.applyScope(qb, 'h');
    if (filters.shipmentId) qb.andWhere('h.shipment_id = :sid', { sid: filters.shipmentId });
    if (filters.status) qb.andWhere('h.status = :st', { st: filters.status });
    return qb.getMany();
  }

  async getOne(id: string): Promise<HandlingUnit> {
    const qb = this.repo.createQueryBuilder('h').where('h.id = :id', { id });
    this.applyScope(qb, 'h');
    const found = await qb.getOne();
    if (!found) throw new NotFoundException('Unidad de manejo no encontrada.');
    return found;
  }

  async create(dto: CreateHandlingUnitDto): Promise<HandlingUnit> {
    const { sscc, placeholder } = await this.nextSscc();
    const entity = this.repo.create({
      shipmentId: dto.shipmentId ?? null,
      shipmentFolio: dto.shipmentFolio ?? null,
      sscc,
      ssccPlaceholder: placeholder,
      type: dto.type ?? 'CARTON',
      parentId: dto.parentId ?? null,
      status: 'OPEN',
      weightKg: dto.weightKg ?? null,
      lengthCm: dto.lengthCm ?? null,
      widthCm: dto.widthCm ?? null,
      heightCm: dto.heightCm ?? null,
      contents: sanitizeContents(dto.contents),
      shipToName: dto.shipToName ?? null,
      shipToAddress: dto.shipToAddress ?? null,
      fromName: dto.fromName ?? null,
      poNumber: dto.poNumber ?? null,
      notes: dto.notes ?? null,
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateHandlingUnitDto): Promise<HandlingUnit> {
    const h = await this.getOne(id);
    Object.assign(h, {
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.parentId !== undefined && { parentId: dto.parentId || null }),
      ...(dto.weightKg !== undefined && { weightKg: dto.weightKg }),
      ...(dto.lengthCm !== undefined && { lengthCm: dto.lengthCm }),
      ...(dto.widthCm !== undefined && { widthCm: dto.widthCm }),
      ...(dto.heightCm !== undefined && { heightCm: dto.heightCm }),
      ...(dto.contents !== undefined && { contents: sanitizeContents(dto.contents) }),
      ...(dto.shipToName !== undefined && { shipToName: dto.shipToName || null }),
      ...(dto.shipToAddress !== undefined && { shipToAddress: dto.shipToAddress || null }),
      ...(dto.fromName !== undefined && { fromName: dto.fromName || null }),
      ...(dto.poNumber !== undefined && { poNumber: dto.poNumber || null }),
      ...(dto.notes !== undefined && { notes: dto.notes || null }),
    });
    return this.repo.save(h);
  }

  async remove(id: string): Promise<{ ok: true }> {
    const h = await this.getOne(id);
    await this.repo.softRemove(h);
    return { ok: true };
  }

  async regenerateSscc(id: string): Promise<HandlingUnit> {
    const h = await this.getOne(id);
    const { sscc, placeholder } = await this.nextSscc();
    h.sscc = sscc;
    h.ssccPlaceholder = placeholder;
    return this.repo.save(h);
  }

  // ── Scan-verified dock loading (Carga verificada) ──────────────────────────

  /** Find a handling unit by its SSCC within the current tenant scope. */
  private async findBySscc(sscc: string): Promise<HandlingUnit | null> {
    const qb = this.repo.createQueryBuilder('h').where('h.sscc = :sscc', { sscc });
    this.applyScope(qb, 'h');
    return (await qb.getOne()) ?? null;
  }

  /** The loading checklist for a shipment: expected units + loaded/pending tally. */
  async loadingState(shipmentId: string): Promise<LoadingState> {
    const units = await this.list({ shipmentId });
    return computeLoadingState(shipmentId, units);
  }

  /**
   * Verify a scanned SSCC against a shipment at the dock. Marks the matched unit
   * LOADED; rejects (poka-yoke) a unit that is unknown or belongs to another
   * shipment so the wrong material never gets loaded onto the truck. Re-scanning a
   * unit already loaded is idempotent.
   */
  async verifyScan(
    shipmentId: string,
    rawSscc: string,
  ): Promise<{ outcome: ScanOutcome; state: LoadingState }> {
    const sscc = normalizeSscc(rawSscc);
    if (!sscc) throw new BadRequestException('Escanea un SSCC válido.');

    const unit = await this.findBySscc(sscc);
    const outcome = classifyScan(unit, shipmentId, sscc);

    if (outcome.result === 'unknown') {
      throw new BadRequestException(
        `SSCC ${sscc} no corresponde a ninguna unidad de manejo.`,
      );
    }
    if (outcome.result === 'wrong-shipment') {
      const where = outcome.belongsToFolio ?? 'otro embarque';
      throw new BadRequestException(
        `Esta unidad pertenece a ${where}. No la cargues en este embarque.`,
      );
    }
    if (outcome.result === 'matched' && unit) {
      unit.status = 'LOADED';
      await this.repo.save(unit);
    }

    const state = await this.loadingState(shipmentId);
    return { outcome, state };
  }

  /** Undo a scan: revert a LOADED unit back to PACKED (operator correction). */
  async resetScan(shipmentId: string, handlingUnitId: string): Promise<LoadingState> {
    const h = await this.getOne(handlingUnitId);
    if (h.shipmentId !== shipmentId) {
      throw new BadRequestException('La unidad no pertenece a este embarque.');
    }
    if (h.status === 'LOADED') {
      h.status = 'PACKED';
      await this.repo.save(h);
    }
    return this.loadingState(shipmentId);
  }

  /**
   * Gate for advancing a shipment to READY: every assigned handling unit must be
   * scan-verified (LOADED). No-op when the shipment uses no packing units, so
   * shipments without handling units keep their existing flow. Throws otherwise.
   */
  async assertLoadingComplete(shipmentId: string): Promise<void> {
    const state = await this.loadingState(shipmentId);
    if (state.hasUnits && !state.complete) {
      throw new BadRequestException(
        `No se puede marcar LISTO: faltan ${state.pending} de ${state.total} unidades por escanear en el andén.`,
      );
    }
  }

  /** Render the GS1-128 SSCC label for a handling unit as ZPL (Zebra). */
  async label(id: string): Promise<{ sscc: string | null; placeholder: boolean; zpl: string }> {
    const h = await this.getOne(id);
    const zpl = ssccLabelZpl({
      sscc: h.sscc ?? '',
      shipToName: h.shipToName,
      shipToAddress: h.shipToAddress,
      fromName: h.fromName,
      poNumber: h.poNumber,
      contents: summarizeContents(h.contents),
      weightKg: h.weightKg,
    });
    return { sscc: h.sscc, placeholder: h.ssccPlaceholder, zpl };
  }
}
