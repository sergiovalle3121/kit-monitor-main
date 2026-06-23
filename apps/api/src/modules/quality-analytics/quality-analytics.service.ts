import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NCR } from '../ncr/entities/ncr.entity';
import { IQCInspection } from '../quality/entities/iqc-inspection.entity';
import { CAPA } from '../quality/entities/capa.entity';
import { FinalInspection } from '../quality/entities/final-inspection.entity';
import { Disposition } from '../quality/entities/disposition.entity';
import { DefectCode } from '../defect-codes/entities/defect-code.entity';
import { TestingService } from '../testing/testing.service';
import {
  buildDefectPareto,
  computeCapaStats,
  computeDispositionUnits,
  computeFpyByGroup,
  computeIqcPpmTrend,
  computeOqcYield,
  computeProcessPpmTrend,
  computeSupplierPpm,
  countBy,
  type CapaStats,
  type CountRow,
  type DefectParetoRow,
  type DispositionUnits,
  type FpyGroup,
  type OqcYield,
  type PpmPoint,
  type SupplierPpm,
  type TestRecordLike,
} from './quality-analytics.util';

export interface QualityAnalyticsFilters {
  days?: number | string;
  model?: string;
  line?: string;
  supplier?: string;
}

export interface QualityAnalyticsResult {
  generatedAt: string;
  filters: {
    days: number | null;
    model: string | null;
    line: string | null;
    supplier: string | null;
  };
  meta: {
    totalNcrs: number;
    classifiedNcrs: number;
    unclassifiedNcrs: number;
    catalogSize: number;
  };
  defects: {
    pareto: DefectParetoRow[];
  };
  ppm: {
    supplier: SupplierPpm[];
    supplierOverall: number | null;
    supplierTrend: PpmPoint[];
    processOverall: number | null;
    processTrend: PpmPoint[];
    /** DPMO clásico requiere «oportunidades por unidad», que no se captura aún. */
    dpmoAvailable: false;
  };
  yield: {
    fpyOverall: number | null;
    serials: number;
    fpyByModel: FpyGroup[];
    fpyByStation: FpyGroup[];
    oqc: OqcYield;
  };
  cuts: {
    byModel: CountRow[];
    byLine: CountRow[];
    bySupplier: SupplierPpm[];
  };
  capa: CapaStats;
  dispositions: {
    /** UNIDADES dispuestas por tipo (scrap/retrabajo/…). Base real para una COPQ futura. */
    byType: DispositionUnits[];
    /** Costo de no-calidad (COPQ) en dinero: follow-up, no hay costo unitario en disposiciones. */
    costAvailable: false;
  };
}

@Injectable()
export class QualityAnalyticsService {
  private readonly logger = new Logger(QualityAnalyticsService.name);

  constructor(
    @InjectRepository(NCR) private readonly ncrRepo: Repository<NCR>,
    @InjectRepository(IQCInspection)
    private readonly iqcRepo: Repository<IQCInspection>,
    @InjectRepository(CAPA) private readonly capaRepo: Repository<CAPA>,
    @InjectRepository(FinalInspection)
    private readonly oqcRepo: Repository<FinalInspection>,
    @InjectRepository(Disposition)
    private readonly dispoRepo: Repository<Disposition>,
    @InjectRepository(DefectCode)
    private readonly defectRepo: Repository<DefectCode>,
    private readonly testing: TestingService,
  ) {}

  async summary(
    filters: QualityAnalyticsFilters,
  ): Promise<QualityAnalyticsResult> {
    const days = this.parseDays(filters.days);
    const since =
      days != null ? new Date(Date.now() - days * 86_400_000) : null;
    const model = (filters.model || '').trim() || null;
    const line = (filters.line || '').trim() || null;
    const supplier = (filters.supplier || '').trim() || null;

    const [ncrs, codes, iqc, capas, oqc, dispositions, testRecords] =
      await Promise.all([
        this.loadNcrs(since, model, line),
        this.loadCodes(),
        this.loadIqc(since, supplier),
        this.safe(
          () => this.capaRepo.find({ order: { createdAt: 'DESC' } }),
          [] as CAPA[],
          'capas',
        ),
        this.safe(
          () => this.loadOqc(since),
          [] as FinalInspection[],
          'final_inspections',
        ),
        this.safe(
          () => this.loadDispositions(since),
          [] as Disposition[],
          'dispositions',
        ),
        this.loadTestRecords(since, model),
      ]);

    const codeById = new Map<number, DefectCode>(codes.map((c) => [c.id, c]));
    const classified = ncrs.filter((n) => n.defectCodeId != null).length;

    // PPM
    const supplierPpm = computeSupplierPpm(iqc);
    const totInspected = iqc.reduce(
      (s, r) => s + (Number(r.sampleSize) || 0),
      0,
    );
    const totDefects = iqc.reduce(
      (s, r) => s + (Number(r.defectsFound) || 0),
      0,
    );
    const supplierOverall =
      totInspected > 0
        ? Math.round((totDefects / totInspected) * 1_000_000)
        : null;
    const processTrend = computeProcessPpmTrend(testRecords);
    const totUnits = testRecords.length;
    const totFails = testRecords.filter(
      (t) => String(t.result).toUpperCase() === 'FAIL',
    ).length;
    const processOverall =
      totUnits > 0 ? Math.round((totFails / totUnits) * 1_000_000) : null;

    // FPY
    const fpyByModel = computeFpyByGroup(
      testRecords,
      (r) => r.model || 'Sin modelo',
    );
    const fpyByStation = computeFpyByGroup(
      testRecords,
      (r) => r.station || 'Sin estación',
    );
    const fpyAll = computeFpyByGroup(testRecords, () => 'all')[0];

    return {
      generatedAt: new Date().toISOString(),
      filters: { days, model, line, supplier },
      meta: {
        totalNcrs: ncrs.length,
        classifiedNcrs: classified,
        unclassifiedNcrs: ncrs.length - classified,
        catalogSize: codes.length,
      },
      defects: {
        pareto: buildDefectPareto(ncrs, codeById),
      },
      ppm: {
        supplier: supplierPpm,
        supplierOverall,
        supplierTrend: computeIqcPpmTrend(iqc),
        processOverall,
        processTrend,
        dpmoAvailable: false,
      },
      yield: {
        fpyOverall: fpyAll?.fpy ?? null,
        serials: fpyAll?.serials ?? 0,
        fpyByModel,
        fpyByStation,
        oqc: computeOqcYield(oqc),
      },
      cuts: {
        byModel: countBy(ncrs, (n) => n.model, 'Sin modelo'),
        byLine: countBy(ncrs, (n) => n.line, 'Sin línea'),
        bySupplier: supplierPpm,
      },
      capa: computeCapaStats(capas),
      dispositions: {
        byType: computeDispositionUnits(dispositions),
        costAvailable: false,
      },
    };
  }

  // ── loaders ────────────────────────────────────────────────────────────────
  private async loadNcrs(
    since: Date | null,
    model: string | null,
    line: string | null,
  ): Promise<NCR[]> {
    return this.safe(
      () => {
        const qb = this.ncrRepo.createQueryBuilder('ncr');
        if (since) qb.andWhere('ncr.createdAt >= :since', { since });
        if (model) qb.andWhere('ncr.model = :model', { model });
        if (line) qb.andWhere('ncr.line = :line', { line });
        return qb.orderBy('ncr.createdAt', 'DESC').getMany();
      },
      [] as NCR[],
      'ncrs',
    );
  }

  private async loadCodes(): Promise<DefectCode[]> {
    return this.safe(
      () => this.defectRepo.find(),
      [] as DefectCode[],
      'defect_codes',
    );
  }

  private async loadIqc(
    since: Date | null,
    supplier: string | null,
  ): Promise<IQCInspection[]> {
    return this.safe(
      () => {
        const qb = this.iqcRepo
          .createQueryBuilder('iqc')
          .leftJoinAndSelect('iqc.supplier', 'supplier');
        if (since) qb.andWhere('iqc.createdAt >= :since', { since });
        if (supplier) qb.andWhere('supplier.id = :sid', { sid: supplier });
        return qb.orderBy('iqc.createdAt', 'DESC').getMany();
      },
      [] as IQCInspection[],
      'iqc_inspections',
    );
  }

  private async loadOqc(since: Date | null): Promise<FinalInspection[]> {
    const qb = this.oqcRepo.createQueryBuilder('oqc');
    if (since) qb.andWhere('oqc.createdAt >= :since', { since });
    return qb.orderBy('oqc.createdAt', 'DESC').getMany();
  }

  private async loadDispositions(since: Date | null): Promise<Disposition[]> {
    const qb = this.dispoRepo.createQueryBuilder('d');
    if (since) qb.andWhere('d.createdAt >= :since', { since });
    return qb.orderBy('d.createdAt', 'DESC').getMany();
  }

  private async loadTestRecords(
    since: Date | null,
    model: string | null,
  ): Promise<TestRecordLike[]> {
    return this.safe(
      async () => {
        const all = await this.testing.list(model ? { model } : {});
        return all.filter((r) => {
          if (!since) return true;
          const t = r.testedAt ? new Date(r.testedAt).getTime() : 0;
          return t === 0 || t >= since.getTime();
        });
      },
      [] as TestRecordLike[],
      'test_records',
    );
  }

  private parseDays(raw: number | string | undefined): number | null {
    if (raw == null || raw === '' || raw === 'all') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 365;
  }

  /** Cualquier fuente puede estar vacía o no disponible; degrada en vez de romper. */
  private async safe<T>(
    fn: () => Promise<T>,
    fallback: T,
    label: string,
  ): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      this.logger.warn(
        `Analítica: fuente '${label}' no disponible (${(err as Error)?.message}).`,
      );
      return fallback;
    }
  }
}
