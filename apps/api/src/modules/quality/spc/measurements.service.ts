import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { QualityMeasurement } from '../entities/quality-measurement.entity';
import { QualityCharacteristic } from '../entities/quality-characteristic.entity';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../../common/tenant/tenant-scoped.repository';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { EventLedgerService } from '../../event-ledger/event-ledger.service';
import { EventDomain } from '../../event-ledger/entities/ledger-event.entity';
import { CharacteristicsService } from './characteristics.service';
import { describeMeasurements, DescriptiveSummary } from './spc-math';
import {
  CreateMeasurementsDto,
  ListMeasurementsQuery,
  MeasurementReadingDto,
} from './dto';

export interface MeasurementSummary extends DescriptiveSummary {
  characteristicId: string;
  characteristic: {
    code: string;
    name: string;
    type: QualityCharacteristic['type'];
    unit: string | null;
    nominal: number | null;
    usl: number | null;
    lsl: number | null;
  };
  /** ISO window actually covered by the readings (null when empty). */
  firstAt: string | null;
  lastAt: string | null;
}

/**
 * Measurements service — the reading side of the SPC data foundation.
 *
 * Persists readings against a CTQ, serves them as a time-ordered series (ready
 * for the SPC PR to chart), and computes ONLY descriptive statistics
 * (n, mean, sample σ, min/max, % out of spec). No control limits, no Cpk/Ppk.
 */
@Injectable()
export class MeasurementsService {
  private readonly logger = new Logger(MeasurementsService.name);

  constructor(
    @Inject(getTenantRepositoryToken(QualityMeasurement))
    private readonly repo: TenantScopedRepository<QualityMeasurement>,
    private readonly tenantCtx: TenantContextService,
    private readonly characteristics: CharacteristicsService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  private applyScope(
    qb: SelectQueryBuilder<QualityMeasurement>,
    alias: string,
  ): SelectQueryBuilder<QualityMeasurement> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  /** Capture one or many readings in a single call. */
  async createBatch(dto: CreateMeasurementsDto): Promise<QualityMeasurement[]> {
    if (!dto.characteristicId?.trim()) {
      throw new BadRequestException('characteristicId es obligatorio.');
    }
    // Validate the characteristic exists in scope (also gives us its type).
    const characteristic = await this.characteristics.getOne(
      dto.characteristicId.trim(),
    );

    const readings: MeasurementReadingDto[] =
      dto.readings && dto.readings.length
        ? dto.readings
        : [{ value: dto.value ?? null, passed: dto.passed ?? null }];

    if (!readings.length) {
      throw new BadRequestException('Se requiere al menos una lectura.');
    }

    const defaultBy = this.tenantCtx.getUserEmail();
    const entities = readings.map((r) => {
      const value = numeric(r.value);
      const passed = typeof r.passed === 'boolean' ? r.passed : null;
      if (characteristic.type === 'VARIABLE' && value === null) {
        throw new BadRequestException(
          `La característica ${characteristic.code} es VARIABLE: cada lectura requiere un valor numérico.`,
        );
      }
      if (characteristic.type === 'ATTRIBUTE' && passed === null) {
        throw new BadRequestException(
          `La característica ${characteristic.code} es ATRIBUTO: cada lectura requiere pass/fail.`,
        );
      }
      return this.repo.create({
        characteristicId: characteristic.id,
        value,
        passed,
        subgroupId: r.subgroupId ?? dto.subgroupId ?? null,
        subgroupLabel: r.subgroupLabel ?? dto.subgroupLabel ?? null,
        measuredAt: parseDate(r.measuredAt ?? dto.measuredAt) ?? new Date(),
        measuredBy: r.measuredBy ?? dto.measuredBy ?? defaultBy,
        source: dto.source ?? 'MANUAL',
        reference: r.reference ?? dto.reference ?? null,
        gage: r.gage ?? dto.gage ?? null,
        notes: r.notes ?? dto.notes ?? null,
        tenant_id: this.tenantCtx.getTenantId(),
        organization_id: this.tenantCtx.getOrganizationId(),
        plant_id: this.tenantCtx.getPlantId(),
        created_by: defaultBy,
      });
    });

    const saved = await this.repo.save(entities);
    await this.recordLedger(characteristic, saved);
    return saved;
  }

  /** Time-ordered (ASC) series for a characteristic, optionally windowed. */
  async list(query: ListMeasurementsQuery): Promise<QualityMeasurement[]> {
    if (!query.characteristic?.trim()) {
      throw new BadRequestException(
        'El parámetro characteristic es obligatorio.',
      );
    }
    const qb = this.repo
      .createQueryBuilder('m')
      .where('m.characteristic_id = :cid', { cid: query.characteristic.trim() })
      .orderBy('m.measured_at', 'ASC')
      .addOrderBy('m.id', 'ASC');
    this.applyScope(qb, 'm');

    const from = parseDate(query.from);
    const to = parseDate(query.to);
    if (from) qb.andWhere('m.measured_at >= :from', { from });
    if (to) qb.andWhere('m.measured_at <= :to', { to });

    return qb.getMany();
  }

  /** Descriptive summary for a characteristic (NO control limits / Cpk). */
  async summary(query: ListMeasurementsQuery): Promise<MeasurementSummary> {
    if (!query.characteristic?.trim()) {
      throw new BadRequestException(
        'El parámetro characteristic es obligatorio.',
      );
    }
    const characteristic = await this.characteristics.getOne(
      query.characteristic.trim(),
    );
    const rows = await this.list(query);
    const values = rows.map((r) => r.value);
    const summary = describeMeasurements(values, {
      nominal: characteristic.nominal,
      usl: characteristic.usl,
      lsl: characteristic.lsl,
    });

    return {
      characteristicId: characteristic.id,
      characteristic: {
        code: characteristic.code,
        name: characteristic.name,
        type: characteristic.type,
        unit: characteristic.unit,
        nominal: characteristic.nominal,
        usl: characteristic.usl,
        lsl: characteristic.lsl,
      },
      firstAt: rows.length ? toIso(rows[0].measuredAt) : null,
      lastAt: rows.length ? toIso(rows[rows.length - 1].measuredAt) : null,
      ...summary,
    };
  }

  private async recordLedger(
    characteristic: QualityCharacteristic,
    saved: QualityMeasurement[],
  ): Promise<void> {
    if (!this.ledger || !saved.length) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.QUALITY,
        action: 'QC_MEASUREMENTS_RECORDED',
        referenceType: 'QC_CHARACTERISTIC',
        referenceId: characteristic.id,
        metadata: {
          code: characteristic.code,
          count: saved.length,
          source: saved[0].source,
          reference: saved[0].reference,
          subgroupId: saved[0].subgroupId,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Ledger write skipped for measurements: ${(err as Error)?.message}`,
      );
    }
  }
}

function numeric(v: number | null | undefined): number | null {
  if (v === null || v === undefined || v === ('' as unknown)) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIso(v: Date | string): string {
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
}
