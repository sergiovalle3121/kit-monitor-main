import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { FixedAsset } from './entities/fixed-asset.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import {
  CreateFixedAssetDto,
  DisposeFixedAssetDto,
} from './dto/fixed-assets.dto';
import {
  accumulatedDepreciation,
  bookValue,
  monthlyDepreciation,
} from './depreciation';

export type SerializedFixedAsset = FixedAsset & {
  monthlyDepreciation: number;
  accumulatedDepreciation: number;
  bookValue: number;
};

export interface FixedAssetsKpis {
  total: number;
  inService: number;
  disposed: number;
  totalCost: number;
  totalBookValue: number;
  totalAccumulatedDepreciation: number;
  currency: string;
}

@Injectable()
export class FixedAssetsService {
  private readonly logger = new Logger(FixedAssetsService.name);

  constructor(
    @InjectRepository(FixedAsset)
    private readonly repo: Repository<FixedAsset>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  private applyScope(
    qb: SelectQueryBuilder<FixedAsset>,
    alias: string,
  ): SelectQueryBuilder<FixedAsset> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  private serialize(a: FixedAsset): SerializedFixedAsset {
    // A disposed asset stops depreciating at its disposal date.
    const asOf = a.status === 'DISPOSED' && a.disposedAt ? new Date(a.disposedAt) : new Date();
    return {
      ...a,
      monthlyDepreciation: Math.round(monthlyDepreciation(a) * 100) / 100,
      accumulatedDepreciation: accumulatedDepreciation(a, asOf),
      bookValue: a.status === 'DISPOSED' ? 0 : bookValue(a, asOf),
    };
  }

  async create(dto: CreateFixedAssetDto): Promise<SerializedFixedAsset> {
    let folio: string | null = null;
    try {
      folio = await this.numbering.allocate('FIXED_ASSET');
    } catch (err) {
      this.logger.warn(`Folio allocation failed: ${(err as Error)?.message}`);
    }

    const entity = this.repo.create({
      folio,
      name: dto.name,
      category: dto.category ?? null,
      acquisitionCost: dto.acquisitionCost,
      salvageValue: dto.salvageValue ?? 0,
      usefulLifeMonths: dto.usefulLifeMonths,
      currency: (dto.currency ?? 'USD').toUpperCase(),
      method: 'STRAIGHT_LINE',
      status: 'IN_SERVICE',
      location: dto.location ?? null,
      programId: dto.programId ?? null,
      acquisitionDate: dto.acquisitionDate ? new Date(dto.acquisitionDate) : new Date(),
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    const saved = await this.repo.save(entity);
    await this.recordLedger('FIXED_ASSET_CREATED', saved);
    return this.serialize(saved);
  }

  async list(filters: { status?: string; category?: string } = {}): Promise<
    SerializedFixedAsset[]
  > {
    const qb = this.repo.createQueryBuilder('fa').orderBy('fa.created_at', 'DESC');
    this.applyScope(qb, 'fa');
    if (filters.status) qb.andWhere('fa.status = :s', { s: filters.status });
    if (filters.category) qb.andWhere('fa.category = :c', { c: filters.category });
    const rows = await qb.getMany();
    return rows.map((a) => this.serialize(a));
  }

  async getOne(id: string): Promise<SerializedFixedAsset> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Activo no encontrado.');
    return this.serialize(found);
  }

  async dispose(
    id: string,
    dto: DisposeFixedAssetDto,
  ): Promise<SerializedFixedAsset> {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Activo no encontrado.');
    if (a.status === 'DISPOSED') {
      throw new BadRequestException('El activo ya está dado de baja.');
    }
    a.status = 'DISPOSED';
    a.disposedAt = dto.disposedAt ? new Date(dto.disposedAt) : new Date();
    const saved = await this.repo.save(a);
    await this.recordLedger('FIXED_ASSET_DISPOSED', saved);
    return this.serialize(saved);
  }

  async kpis(): Promise<FixedAssetsKpis> {
    const all = await this.list();
    let totalCost = 0;
    let totalBookValue = 0;
    let totalAcc = 0;
    let inService = 0;
    let disposed = 0;
    let currency = 'USD';

    for (const a of all) {
      if (a.currency) currency = a.currency;
      if (a.status === 'IN_SERVICE') {
        inService += 1;
        totalCost += Number(a.acquisitionCost ?? 0);
        totalBookValue += a.bookValue;
        totalAcc += a.accumulatedDepreciation;
      } else {
        disposed += 1;
      }
    }

    return {
      total: all.length,
      inService,
      disposed,
      totalCost: Math.round(totalCost),
      totalBookValue: Math.round(totalBookValue),
      totalAccumulatedDepreciation: Math.round(totalAcc),
      currency,
    };
  }

  private async recordLedger(action: string, a: FixedAsset): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.SYSTEM,
        action,
        referenceType: 'FIXED_ASSET',
        referenceId: a.id,
        program: a.programId ?? undefined,
        plant: a.plant_id ?? undefined,
        metadata: { folio: a.folio, name: a.name, cost: a.acquisitionCost },
      });
    } catch (err) {
      this.logger.warn(
        `Ledger write skipped for ${action}: ${(err as Error)?.message}`,
      );
    }
  }
}
