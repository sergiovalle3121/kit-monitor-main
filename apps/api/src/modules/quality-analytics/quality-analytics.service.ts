import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NCR } from '../ncr/entities/ncr.entity';
import { IQCInspection } from '../quality/entities/iqc-inspection.entity';
import { CAPA } from '../quality/entities/capa.entity';
import { FinalInspection } from '../quality/entities/final-inspection.entity';
import { Disposition } from '../quality/entities/disposition.entity';
import { DefectCode } from '../defect-codes/entities/defect-code.entity';
import { QualityCharacteristic } from '../quality/entities/quality-characteristic.entity';
import {
  FloorQualityService,
  type QualityKpis as FloorQualityKpis,
} from '../floor-quality/floor-quality.service';
import { RmaService, type RmaKpis } from '../rma/rma.service';
import {
  GenealogyService,
  type GenealogyKpis,
} from '../genealogy/genealogy.service';
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

export interface QualityCommandCenterLane {
  key: string;
  title: string;
  metric: number | null;
  metricLabel: string;
  risk: string;
  actions: string[];
  route: string;
}

export interface QualityCommandCenterItem {
  key: string;
  tone: 'danger' | 'warning' | 'neutral';
  title: string;
  body: string;
  route: string;
  cta: string;
}

export interface QualityCommandCenterDrilldown {
  key: string;
  type:
    | 'supplier'
    | 'line'
    | 'containment'
    | 'customer'
    | 'capa'
    | 'ctq';
  tone: 'danger' | 'warning' | 'neutral';
  title: string;
  metric: number | null;
  metricLabel: string;
  detail: string;
  route: string;
  actions: string[];
  blockers: string[];
}

export interface QualityCommandCenterBattleCard {
  key: string;
  title: string;
  metric: number;
  metricLabel: string;
  detail: string;
  route: string;
  priority: 'now' | 'today' | 'watch';
  actions: string[];
  blockers: string[];
}

export interface QualityCommandCenterActionPlan {
  key: string;
  title: string;
  intent: 'create_hold' | 'send_to_mrb' | 'supplier_scar' | 'recall_scope' | 'customer_8d';
  route: string;
  endpoint: string | null;
  method: 'GET' | 'POST' | 'PATCH';
  permission: string | null;
  sourceNcrId: number | null;
  payloadTemplate: Record<string, string | number | null>;
  prechecks: string[];
  auditTrail: string[];
}

export interface QualityCommandCenterAging {
  slaPolicies: Array<{
    key: string;
    label: string;
    sourceType: string;
    severity: string;
    dueDays: number;
  }>;
  buckets: Array<{
    label: string;
    minDays: number;
    maxDays: number | null;
    count: number;
    critical: number;
    units: number;
  }>;
  staleNcrs: Array<{
    id: number;
    ncrNumber: string;
    partNumber: string;
    daysOpen: number;
    severity: string;
    status: string;
    owner: string | null;
    route: string;
  }>;
  ownerEscalations: Array<{
    owner: string;
    count: number;
    maxDaysOpen: number;
    critical: number;
    route: string;
  }>;
  slaBreaches: Array<{
    id: number;
    ncrNumber: string;
    partNumber: string;
    daysOpen: number;
    dueDays: number;
    daysLate: number;
    severity: string;
    sourceType: string;
    owner: string | null;
    route: string;
  }>;
}

export interface QualityCommandCenterResult {
  generatedAt: string;
  analytics: QualityAnalyticsResult;
  lanes: QualityCommandCenterLane[];
  attention: QualityCommandCenterItem[];
  drilldowns: {
    supplierRisks: QualityCommandCenterDrilldown[];
    lineRisks: QualityCommandCenterDrilldown[];
    containmentCandidates: QualityCommandCenterDrilldown[];
    customerImpacts: QualityCommandCenterDrilldown[];
    capaWatch: QualityCommandCenterDrilldown[];
  };
  battleRhythm: {
    productionBlockers: QualityCommandCenterBattleCard[];
    shipmentBlockers: QualityCommandCenterBattleCard[];
    supplierContainment: QualityCommandCenterBattleCard[];
    releaseCandidates: QualityCommandCenterBattleCard[];
    ownerLoad: QualityCommandCenterBattleCard[];
  };
  actionPlan: {
    holdCandidates: QualityCommandCenterActionPlan[];
    mrbCandidates: QualityCommandCenterActionPlan[];
    scarCandidates: QualityCommandCenterActionPlan[];
    recallCandidates: QualityCommandCenterActionPlan[];
    customer8dCandidates: QualityCommandCenterActionPlan[];
  };
  aging: QualityCommandCenterAging;
  containment: {
    lots: string[];
    serials: string[];
    workOrders: string[];
    customers: string[];
    highRiskNcrs: Array<{
      id: number;
      ncrNumber: string;
      partNumber: string;
      severity: string;
      quantityAffected: number;
      scope: string | null;
      owner: string | null;
    }>;
  };
  mrb: {
    affectedUnits: number;
    dispositionedUnits: number;
    pendingUnits: number;
    floorKpis: FloorQualityKpis | null;
    playbook: Array<{ label: string; body: string }>;
  };
  customer: {
    rma: RmaKpis | null;
    genealogy: GenealogyKpis | null;
    traceabilityCoveragePct: number | null;
  };
  ctq: {
    active: number;
    critical: number;
    variable: number;
    withSpecWindow: number;
  };
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
    @InjectRepository(QualityCharacteristic)
    private readonly characteristicRepo: Repository<QualityCharacteristic>,
    private readonly testing: TestingService,
    private readonly floorQuality: FloorQualityService,
    private readonly rma: RmaService,
    private readonly genealogy: GenealogyService,
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

  async commandCenter(
    filters: QualityAnalyticsFilters,
  ): Promise<QualityCommandCenterResult> {
    const analytics = await this.summary(filters);
    const days = this.parseDays(filters.days);
    const since =
      days != null ? new Date(Date.now() - days * 86_400_000) : null;
    const model = (filters.model || '').trim() || null;
    const line = (filters.line || '').trim() || null;
    const [ncrs, characteristics, floorKpis, rmaKpis, genealogyKpis] =
      await Promise.all([
      this.loadNcrs(since, model, line),
      this.safe(
        () => this.characteristicRepo.find({ where: { active: true } }),
        [] as QualityCharacteristic[],
        'quality_characteristics',
      ),
      this.safe(() => this.floorQuality.kpis(), null, 'floor_quality_kpis'),
      this.safe(() => this.rma.kpis(), null, 'rma_kpis'),
      this.safe(() => this.genealogy.kpis(), null, 'genealogy_kpis'),
    ]);

    const open = ncrs.filter((n) => n.status !== 'closed');
    const incoming = open.filter(
      (n) => n.sourceType === 'incoming' || n.sourceType === 'supplier',
    );
    const process = open.filter((n) => n.sourceType === 'in-process');
    const customer = open.filter(
      (n) => n.sourceType === 'customer' || n.sourceType === 'outgoing',
    );
    const topSupplier = analytics.ppm.supplier[0];
    const topStation = analytics.yield.fpyByStation[0];
    const topDefect = analytics.defects.pareto[0];
    const activeCtq = characteristics.filter((c) => c.active);
    const criticalCtq = activeCtq.filter((c) => c.isCritical);
    const variableCtq = activeCtq.filter((c) => c.type === 'VARIABLE');
    const withSpecWindow = variableCtq.filter(
      (c) => c.lsl != null || c.usl != null || c.nominal != null,
    );
    const affectedUnits = open.reduce(
      (sum, n) => sum + (Number(n.quantityAffected) || 0),
      0,
    );
    const dispositionedUnits = analytics.dispositions.byType.reduce(
      (sum, d) => sum + (Number(d.units) || 0),
      0,
    );

    return {
      generatedAt: new Date().toISOString(),
      analytics,
      lanes: [
        {
          key: 'iqc',
          title: 'IQC / Supplier',
          metric: incoming.length,
          metricLabel: 'NCR abiertas',
          risk:
            topSupplier?.ppm != null
              ? `${topSupplier.supplierName}: ${topSupplier.ppm.toLocaleString()} PPM`
              : 'PPM proveedor pendiente',
          actions: [
            'Contener lote/reel recibido',
            'Abrir SCAR si hay recurrencia',
            'Validar incoming inspection y AQL',
          ],
          route: '/dashboard/quality/inspections',
        },
        {
          key: 'ipqc',
          title: 'IPQC / Línea',
          metric: process.length,
          metricLabel: 'NCR en proceso',
          risk:
            topStation?.fpy != null
              ? `${topStation.key}: FPY ${topStation.fpy.toFixed(1)}%`
              : 'FPY por estación pendiente',
          actions: [
            'Verificar estación/modelo con mayor fuga',
            'Separar retrabajo vs scrap',
            'Confirmar contención en WIP',
          ],
          route: '/dashboard/quality/analytics',
        },
        {
          key: 'mrb',
          title: 'MRB / Containment',
          metric: floorKpis?.openHolds ?? null,
          metricLabel: 'holds abiertos',
          risk: floorKpis
            ? `${floorKpis.overdue} overdue · ${floorKpis.scrapQty} scrap qty`
            : `${analytics.dispositions.byType.length} tipos de disposición activos`,
          actions: [
            'Priorizar overdue',
            'Definir use-as-is / rework / scrap / RTV',
            'Ejecutar where-used antes de liberar',
          ],
          route: '/dashboard/floor-quality',
        },
        {
          key: 'ctq',
          title: 'SPC / CTQ',
          metric: criticalCtq.length,
          metricLabel: 'CTQ críticas',
          risk: `${withSpecWindow.length}/${variableCtq.length} variables con ventana de especificación`,
          actions: [
            'Capturar mediciones faltantes',
            'Revisar out-of-spec',
            'Preparar Cpk/control chart',
          ],
          route: '/dashboard/quality/measurements',
        },
        {
          key: 'capa',
          title: 'CAPA / 8D',
          metric: analytics.capa.overdue,
          metricLabel: 'CAPA vencidas',
          risk: topDefect
            ? `${topDefect.label}: ${topDefect.count} casos`
            : 'Pareto pendiente',
          actions: [
            'Asignar owner',
            'Verificar root cause',
            'Cerrar efectividad con evidencia',
          ],
          route: '/dashboard/quality/analytics',
        },
        {
          key: 'customer',
          title: 'OQC / Customer',
          metric: rmaKpis?.open ?? customer.length,
          metricLabel: rmaKpis ? 'RMA abiertas' : 'NCR cliente/OQC',
          risk:
            genealogyKpis && genealogyKpis.indexedLinks > 0
              ? `${this.traceabilityCoverage(genealogyKpis)}% links con lote`
              : `${analytics.yield.oqc.failed} fallas OQC`,
          actions: [
            'Bloquear embarque si aplica',
            'Preparar 8D cliente',
            'Trazar seriales/lotes afectados',
          ],
          route: '/dashboard/rma',
        },
      ],
      attention: this.buildCommandAttention(open, analytics),
      drilldowns: this.buildCommandDrilldowns(open, analytics),
      battleRhythm: this.buildBattleRhythm(open),
      actionPlan: this.buildActionPlan(open),
      aging: this.buildAging(open),
      containment: {
        lots: unique(open.map((n) => n.lotNumber)),
        serials: unique(open.map((n) => n.serialNumber)),
        workOrders: unique(open.map((n) => n.workOrder)),
        customers: unique(open.map((n) => n.customer)),
        highRiskNcrs: open
          .filter(
            (n) => n.severity === 'critical' || Number(n.quantityAffected) > 0,
          )
          .slice(0, 10)
          .map((n) => ({
            id: n.id,
            ncrNumber: n.ncrNumber,
            partNumber: n.partNumber,
            severity: n.severity,
            quantityAffected: Number(n.quantityAffected) || 0,
            scope: n.lotNumber || n.serialNumber || n.workOrder || null,
            owner: n.owner || n.line || n.model || null,
          })),
      },
      mrb: {
        affectedUnits,
        dispositionedUnits,
        pendingUnits: Math.max(affectedUnits - dispositionedUnits, 0),
        floorKpis,
        playbook: [
          {
            label: 'Use-as-is',
            body: 'Solo con aprobación, desviación documentada y cliente si aplica.',
          },
          {
            label: 'Rework / Repair',
            body: 'Ruta preferente cuando preserva valor y hay instrucción validada.',
          },
          {
            label: 'Scrap',
            body: 'Aislar físicamente, registrar cantidad y bloquear consumo futuro.',
          },
          {
            label: 'RTV / Sort',
            body: 'Aplicar a proveedor cuando el riesgo está en lote/reel de incoming.',
          },
        ],
      },
      customer: {
        rma: rmaKpis,
        genealogy: genealogyKpis,
        traceabilityCoveragePct: genealogyKpis
          ? this.traceabilityCoverage(genealogyKpis)
          : null,
      },
      ctq: {
        active: activeCtq.length,
        critical: criticalCtq.length,
        variable: variableCtq.length,
        withSpecWindow: withSpecWindow.length,
      },
    };
  }

  private traceabilityCoverage(kpis: GenealogyKpis): number {
    if (kpis.indexedLinks <= 0) return 0;
    return Math.round(
      ((kpis.indexedLinks - kpis.linksMissingLot) / kpis.indexedLinks) * 100,
    );
  }

  private buildCommandAttention(
    open: NCR[],
    analytics: QualityAnalyticsResult,
  ): QualityCommandCenterItem[] {
    return [
      ...open
        .filter((n) => n.severity === 'critical')
        .slice(0, 3)
        .map((n) => ({
          key: `ncr-${n.id}`,
          tone: 'danger' as const,
          title: `${n.ncrNumber} crítica abierta`,
          body: `${n.partNumber} · ${n.category} · ${n.quantityAffected} u afectadas`,
          route: `/dashboard/quality/ncr/${n.id}`,
          cta: 'Abrir NCR',
        })),
      ...analytics.capa.overdueList.slice(0, 3).map((c) => ({
        key: `capa-${c.capaNumber}`,
        tone: 'warning' as const,
        title: `${c.capaNumber} vencida`,
        body: `${c.partNumber} · ${c.daysOverdue} días overdue · ${c.status}`,
        route: '/dashboard/quality/analytics',
        cta: 'Ver CAPA',
      })),
      ...open
        .filter((n) => n.status === 'open' || n.status === 'under_review')
        .slice(0, 4)
        .map((n) => ({
          key: `contain-${n.id}`,
          tone: 'neutral' as const,
          title: `${n.ncrNumber} requiere contención`,
          body: `${n.sourceType} · ${
            n.line || n.model || n.workOrder || 'sin contexto'
          }`,
          route: `/dashboard/quality/ncr/${n.id}`,
          cta: 'Contener',
        })),
    ].slice(0, 8);
  }

  private buildCommandDrilldowns(
    open: NCR[],
    analytics: QualityAnalyticsResult,
  ): QualityCommandCenterResult['drilldowns'] {
    const supplierRisks = analytics.ppm.supplier.slice(0, 5).map((supplier) => {
      const ppm = supplier.ppm ?? null;
      const related = open.filter(
        (n) =>
          n.sourceType === 'supplier' ||
          n.sourceType === 'incoming' ||
          (supplier.supplierName &&
            n.owner?.toLowerCase() === supplier.supplierName.toLowerCase()),
      );
      return {
        key: `supplier-${supplier.supplierId ?? supplier.supplierName}`,
        type: 'supplier' as const,
        tone: ppm != null && ppm >= 1000 ? ('danger' as const) : ('warning' as const),
        title: supplier.supplierName || 'Proveedor sin nombre',
        metric: ppm == null ? null : Math.round(ppm),
        metricLabel: 'PPM proveedor',
        detail: `${supplier.defects} defectos / ${supplier.inspected} piezas inspeccionadas`,
        route: '/dashboard/quality/analytics',
        actions: [
          'Revisar incoming defects y lotes recibidos',
          'Preparar contención de material en almacén',
          'Evaluar SCAR si el defecto es repetitivo',
        ],
        blockers: unique([
          ...related.map((n) => n.lotNumber),
          ...related.map((n) => n.partNumber),
        ]).slice(0, 4),
      };
    });

    const lineCounts = countOpenBy(open, (n) => n.line || n.model || null);
    const lineRisks = lineCounts.slice(0, 5).map((row) => {
      const station = analytics.yield.fpyByStation.find(
        (s) => s.key === row.key,
      );
      return {
        key: `line-${row.key}`,
        type: 'line' as const,
        tone: row.critical > 0 ? ('danger' as const) : ('warning' as const),
        title: row.key,
        metric: station?.fpy ?? row.count,
        metricLabel: station ? 'FPY estación' : 'NCR abiertas',
        detail: `${row.count} NCR abiertas · ${row.critical} críticas · ${row.units} unidades afectadas`,
        route: '/dashboard/quality/analytics',
        actions: [
          'Caminar línea y validar estación de escape',
          'Separar WIP sospechoso por WO/modelo',
          'Comparar scrap vs retrabajo antes de liberar',
        ],
        blockers: row.parts.slice(0, 4),
      };
    });

    const containmentCandidates = open
      .filter(
        (n) =>
          n.status === 'open' ||
          n.status === 'under_review' ||
          n.severity === 'critical',
      )
      .sort(
        (a, b) =>
          Number(b.severity === 'critical') - Number(a.severity === 'critical') ||
          (Number(b.quantityAffected) || 0) - (Number(a.quantityAffected) || 0),
      )
      .slice(0, 8)
      .map((n) => ({
        key: `containment-${n.id}`,
        type: 'containment' as const,
        tone: n.severity === 'critical' ? ('danger' as const) : ('warning' as const),
        title: `${n.ncrNumber} · ${n.partNumber}`,
        metric: Number(n.quantityAffected) || 0,
        metricLabel: 'unidades afectadas',
        detail: `${n.sourceType} · ${n.category} · ${n.status}`,
        route: `/dashboard/quality/ncr/${n.id}`,
        actions: [
          'Confirmar alcance físico y digital',
          'Crear/validar hold antes de liberar material',
          'Ejecutar where-used si hay lote o serial',
        ],
        blockers: unique([n.lotNumber, n.serialNumber, n.workOrder, n.customer]),
      }));

    const customerCounts = countOpenBy(open, (n) => n.customer || null);
    const customerImpacts = customerCounts.slice(0, 5).map((row) => ({
      key: `customer-${row.key}`,
      type: 'customer' as const,
      tone: row.critical > 0 ? ('danger' as const) : ('neutral' as const),
      title: row.key,
      metric: row.count,
      metricLabel: 'NCR abiertas',
      detail: `${row.units} unidades potencialmente afectadas · ${row.critical} críticas`,
      route: '/dashboard/genealogy',
      actions: [
        'Revisar seriales/lotes embarcados',
        'Preparar narrativa 8D si hay impacto externo',
        'Bloquear embarque hasta cerrar scope',
      ],
      blockers: row.parts.slice(0, 4),
    }));

    const capaWatch = analytics.capa.overdueList.slice(0, 6).map((capa) => ({
      key: `capa-watch-${capa.capaNumber}`,
      type: 'capa' as const,
      tone: capa.daysOverdue > 14 ? ('danger' as const) : ('warning' as const),
      title: capa.capaNumber,
      metric: capa.daysOverdue,
      metricLabel: 'días vencida',
      detail: `${capa.partNumber} · ${capa.status}`,
      route: '/dashboard/quality/analytics',
      actions: [
        'Confirmar owner y fecha comprometida',
        'Validar root cause vs defecto repetido',
        'Cerrar efectividad con evidencia objetiva',
      ],
      blockers: unique([capa.partNumber, capa.status]),
    }));

    return {
      supplierRisks,
      lineRisks,
      containmentCandidates,
      customerImpacts,
      capaWatch,
    };
  }

  private buildBattleRhythm(
    open: NCR[],
  ): QualityCommandCenterResult['battleRhythm'] {
    const productionBlockers = open
      .filter((n) => n.sourceType === 'in-process' || n.line || n.workOrder)
      .sort(byCriticalThenUnits)
      .slice(0, 6)
      .map((n) => this.ncrBattleCard(n, 'production', [
        'Confirmar WIP bloqueado por WO/línea',
        'Separar material sospechoso de material liberable',
        'Definir disposición MRB antes de continuar producción',
      ]));

    const shipmentBlockers = open
      .filter(
        (n) =>
          n.sourceType === 'outgoing' ||
          n.sourceType === 'customer',
      )
      .sort(byCriticalThenUnits)
      .slice(0, 6)
      .map((n) => this.ncrBattleCard(n, 'shipment', [
        'Bloquear embarque afectado hasta cerrar alcance',
        'Trazar serial/lote contra genealogy',
        'Preparar mensaje 8D si hay impacto cliente',
      ]));

    const supplierContainment = open
      .filter((n) => n.sourceType === 'incoming' || n.sourceType === 'supplier')
      .sort(byCriticalThenUnits)
      .slice(0, 6)
      .map((n) => this.ncrBattleCard(n, 'supplier', [
        'Contener lote/reel en receiving o almacén',
        'Validar si aplica sort 100%',
        'Preparar SCAR con evidencia del defecto',
      ]));

    const releaseCandidates = open
      .filter((n) => n.status === 'contained' || n.status === 'dispositioned')
      .sort((a, b) => Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0))
      .slice(0, 6)
      .map((n) => this.ncrBattleCard(n, 'release', [
        'Verificar evidencia de disposición',
        'Confirmar trazabilidad antes de liberar',
        'Cerrar NCR si efectividad y documentos están completos',
      ]));

    const ownerLoad = countOpenBy(open, (n) => n.owner || n.line || n.model || null)
      .slice(0, 6)
      .map((row) => ({
        key: `owner-${row.key}`,
        title: row.key,
        metric: row.count,
        metricLabel: 'NCR asignadas',
        detail: `${row.critical} críticas · ${row.units} unidades afectadas`,
        route: '/dashboard/quality',
        priority: row.critical > 0 ? ('now' as const) : ('today' as const),
        actions: [
          'Rebalancear owner si hay sobrecarga',
          'Asegurar fecha comprometida por NCR',
          'Escalar críticas sin progreso',
        ],
        blockers: row.parts.slice(0, 4),
      }));

    return {
      productionBlockers,
      shipmentBlockers,
      supplierContainment,
      releaseCandidates,
      ownerLoad,
    };
  }

  private ncrBattleCard(
    n: NCR,
    prefix: string,
    actions: string[],
  ): QualityCommandCenterBattleCard {
    return {
      key: `${prefix}-${n.id}`,
      title: `${n.ncrNumber} · ${n.partNumber}`,
      metric: Number(n.quantityAffected) || 0,
      metricLabel: 'unidades afectadas',
      detail: `${n.severity} · ${n.status} · ${n.line || n.customer || n.model || n.sourceType}`,
      route: `/dashboard/quality/ncr/${n.id}`,
      priority: n.severity === 'critical' ? 'now' : n.status === 'open' ? 'today' : 'watch',
      actions,
      blockers: unique([n.lotNumber, n.serialNumber, n.workOrder, n.customer]),
    };
  }

  private buildActionPlan(open: NCR[]): QualityCommandCenterResult['actionPlan'] {
    const needsHold = open
      .filter((n) => n.status === 'open' || n.status === 'under_review')
      .sort(byCriticalThenUnits)
      .slice(0, 6)
      .map((n) =>
        this.ncrActionPlan(n, {
          intent: 'create_hold',
          title: `Crear hold para ${n.ncrNumber}`,
          route: '/dashboard/quality/holds',
          endpoint: '/quality/holds',
          method: 'POST',
          permission: 'QUALITY_WRITE',
          payloadTemplate: {
            partNumber: n.partNumber,
            level: n.serialNumber ? 'SERIAL' : n.lotNumber ? 'LOT' : 'PART',
            levelValue: n.serialNumber || n.lotNumber || n.partNumber,
            reason: `NCR ${n.ncrNumber}: ${n.category}`,
            heldBy: n.owner || 'QA',
          },
          prechecks: [
            'Confirmar ubicación física del material',
            'Validar lote/serial/WO antes de bloquear',
            'Notificar producción y almacén',
          ],
          auditTrail: ['NCR', 'Quality hold', 'Quarantine transfer si aplica'],
        }),
      );

    const mrbCandidates = open
      .filter((n) => n.status === 'contained' || Number(n.quantityAffected) > 0)
      .sort(byCriticalThenUnits)
      .slice(0, 6)
      .map((n) =>
        this.ncrActionPlan(n, {
          intent: 'send_to_mrb',
          title: `Preparar MRB para ${n.ncrNumber}`,
          route: '/dashboard/floor-quality',
          endpoint: '/floor-quality/holds/:id/mrb',
          method: 'POST',
          permission: 'quality:hold',
          payloadTemplate: {
            ncrNumber: n.ncrNumber,
            partNumber: n.partNumber,
            quantityAffected: Number(n.quantityAffected) || 0,
            dispositionNeeded: 'USE_AS_IS | REWORK | REPAIR | SCRAP | RTV | SORT',
          },
          prechecks: [
            'Hold creado y material físicamente segregado',
            'Evidencia del defecto adjunta',
            'Where-used ejecutado para lote/serial crítico',
          ],
          auditTrail: ['NCR', 'Floor hold', 'MRB disposition', 'Electronic signature'],
        }),
      );

    const scarCandidates = open
      .filter((n) => n.sourceType === 'incoming' || n.sourceType === 'supplier')
      .sort(byCriticalThenUnits)
      .slice(0, 6)
      .map((n) =>
        this.ncrActionPlan(n, {
          intent: 'supplier_scar',
          title: `Evaluar SCAR para ${n.ncrNumber}`,
          route: '/dashboard/quality/analytics',
          endpoint: null,
          method: 'POST',
          permission: null,
          payloadTemplate: {
            supplierContext: n.owner || null,
            partNumber: n.partNumber,
            lotNumber: n.lotNumber || null,
            defect: n.category,
            evidence: `NCR ${n.ncrNumber}`,
          },
          prechecks: [
            'Confirmar recurrencia o severidad',
            'Anexar fotos/medición/inspección incoming',
            'Definir contención de material en tránsito',
          ],
          auditTrail: ['NCR', 'IQC evidence', 'Supplier response', 'Effectiveness check'],
        }),
      );

    const recallCandidates = open
      .filter((n) => Boolean(n.lotNumber || n.serialNumber || n.customer))
      .sort(byCriticalThenUnits)
      .slice(0, 6)
      .map((n) =>
        this.ncrActionPlan(n, {
          intent: 'recall_scope',
          title: `Scope de recall para ${n.ncrNumber}`,
          route: '/dashboard/genealogy',
          endpoint: '/genealogy',
          method: 'GET',
          permission: 'quality:read',
          payloadTemplate: {
            lotNumber: n.lotNumber || null,
            serialNumber: n.serialNumber || null,
            workOrder: n.workOrder || null,
            customer: n.customer || null,
          },
          prechecks: [
            'Validar as-built y where-used',
            'Separar seriales embarcados vs WIP',
            'Confirmar clientes/shipments impactados',
          ],
          auditTrail: ['NCR', 'Genealogy query', 'Affected serial list', 'Customer notification if needed'],
        }),
      );

    const customer8dCandidates = open
      .filter((n) => n.sourceType === 'customer' || n.sourceType === 'outgoing')
      .sort(byCriticalThenUnits)
      .slice(0, 6)
      .map((n) =>
        this.ncrActionPlan(n, {
          intent: 'customer_8d',
          title: `Preparar 8D cliente para ${n.ncrNumber}`,
          route: '/dashboard/rma',
          endpoint: null,
          method: 'POST',
          permission: null,
          payloadTemplate: {
            customer: n.customer || null,
            partNumber: n.partNumber,
            serialNumber: n.serialNumber || null,
            problemStatement: n.description,
          },
          prechecks: [
            'Contención inmediata documentada',
            'Root cause owner asignado',
            'Evidencia de efectividad definida',
          ],
          auditTrail: ['NCR', 'RMA/customer complaint', '8D', 'CAPA effectiveness'],
        }),
      );

    return {
      holdCandidates: needsHold,
      mrbCandidates,
      scarCandidates,
      recallCandidates,
      customer8dCandidates,
    };
  }

  private ncrActionPlan(
    n: NCR,
    plan: Omit<QualityCommandCenterActionPlan, 'key' | 'sourceNcrId'>,
  ): QualityCommandCenterActionPlan {
    return {
      key: `${plan.intent}-${n.id}`,
      sourceNcrId: n.id,
      ...plan,
    };
  }

  private buildAging(open: NCR[]): QualityCommandCenterAging {
    const now = Date.now();
    const rows = open.map((n) => ({
      n,
      daysOpen: daysBetween(n.createdAt, now),
      dueDays: slaDueDays(n),
    }));
    const bucketDefs = [
      { label: '0–2 días', minDays: 0, maxDays: 2 },
      { label: '3–7 días', minDays: 3, maxDays: 7 },
      { label: '8–14 días', minDays: 8, maxDays: 14 },
      { label: '15+ días', minDays: 15, maxDays: null },
    ];
    const buckets = bucketDefs.map((bucket) => {
      const inBucket = rows.filter((row) =>
        row.daysOpen >= bucket.minDays &&
        (bucket.maxDays == null || row.daysOpen <= bucket.maxDays),
      );
      return {
        ...bucket,
        count: inBucket.length,
        critical: inBucket.filter((row) => row.n.severity === 'critical').length,
        units: inBucket.reduce(
          (sum, row) => sum + (Number(row.n.quantityAffected) || 0),
          0,
        ),
      };
    });

    const staleNcrs = rows
      .filter((row) => row.daysOpen > row.dueDays || row.n.severity === 'critical')
      .sort(
        (a, b) =>
          Number(b.n.severity === 'critical') - Number(a.n.severity === 'critical') ||
          b.daysOpen - a.daysOpen,
      )
      .slice(0, 8)
      .map((row) => ({
        id: row.n.id,
        ncrNumber: row.n.ncrNumber,
        partNumber: row.n.partNumber,
        daysOpen: row.daysOpen,
        severity: row.n.severity,
        status: row.n.status,
        owner: row.n.owner || row.n.line || row.n.model || null,
        route: `/dashboard/quality/ncr/${row.n.id}`,
      }));

    const ownerMap = new Map<
      string,
      { owner: string; count: number; maxDaysOpen: number; critical: number; route: string }
    >();
    for (const row of rows) {
      const owner = row.n.owner || row.n.line || row.n.model || 'Sin owner';
      const current =
        ownerMap.get(owner) ??
        { owner, count: 0, maxDaysOpen: 0, critical: 0, route: '/dashboard/quality' };
      current.count += 1;
      current.maxDaysOpen = Math.max(current.maxDaysOpen, row.daysOpen);
      current.critical += row.n.severity === 'critical' ? 1 : 0;
      ownerMap.set(owner, current);
    }

    return {
      slaPolicies: QUALITY_SLA_POLICIES,
      buckets,
      staleNcrs,
      ownerEscalations: Array.from(ownerMap.values())
        .filter((row) => row.maxDaysOpen >= 8 || row.critical > 0 || row.count >= 3)
        .sort(
          (a, b) =>
            b.critical - a.critical ||
            b.maxDaysOpen - a.maxDaysOpen ||
            b.count - a.count,
        )
        .slice(0, 6),
      slaBreaches: rows
        .filter((row) => row.daysOpen > row.dueDays)
        .sort(
          (a, b) =>
            b.daysOpen - b.dueDays - (a.daysOpen - a.dueDays) ||
            Number(b.n.severity === 'critical') - Number(a.n.severity === 'critical'),
        )
        .slice(0, 8)
        .map((row) => ({
          id: row.n.id,
          ncrNumber: row.n.ncrNumber,
          partNumber: row.n.partNumber,
          daysOpen: row.daysOpen,
          dueDays: row.dueDays,
          daysLate: row.daysOpen - row.dueDays,
          severity: row.n.severity,
          sourceType: row.n.sourceType,
          owner: row.n.owner || row.n.line || row.n.model || null,
          route: `/dashboard/quality/ncr/${row.n.id}`,
        })),
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

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((v) => v?.trim()).filter(Boolean) as string[]),
  ).sort();
}

function byCriticalThenUnits(a: NCR, b: NCR): number {
  return (
    Number(b.severity === 'critical') - Number(a.severity === 'critical') ||
    (Number(b.quantityAffected) || 0) - (Number(a.quantityAffected) || 0)
  );
}

function daysBetween(date: Date | string | null | undefined, now: number): number {
  if (!date) return 0;
  const ts = new Date(date).getTime();
  if (!Number.isFinite(ts)) return 0;
  return Math.max(Math.floor((now - ts) / 86_400_000), 0);
}

const QUALITY_SLA_POLICIES = [
  { key: 'critical-any', label: 'Crítica · cualquier origen', sourceType: '*', severity: 'critical', dueDays: 1 },
  { key: 'customer-major', label: 'Cliente/OQC · major', sourceType: 'customer,outgoing', severity: 'major', dueDays: 2 },
  { key: 'process-major', label: 'Proceso · major', sourceType: 'in-process', severity: 'major', dueDays: 3 },
  { key: 'supplier-major', label: 'Proveedor/IQC · major', sourceType: 'incoming,supplier', severity: 'major', dueDays: 5 },
  { key: 'minor-any', label: 'Minor · cualquier origen', sourceType: '*', severity: 'minor', dueDays: 10 },
];

function slaDueDays(ncr: NCR): number {
  if (ncr.severity === 'critical') return 1;
  if (
    ncr.severity === 'major' &&
    (ncr.sourceType === 'customer' || ncr.sourceType === 'outgoing')
  ) {
    return 2;
  }
  if (ncr.severity === 'major' && ncr.sourceType === 'in-process') return 3;
  if (
    ncr.severity === 'major' &&
    (ncr.sourceType === 'incoming' || ncr.sourceType === 'supplier')
  ) {
    return 5;
  }
  if (ncr.severity === 'minor') return 10;
  return 7;
}

function countOpenBy(
  ncrs: NCR[],
  getKey: (ncr: NCR) => string | null | undefined,
): Array<{
  key: string;
  count: number;
  critical: number;
  units: number;
  parts: string[];
}> {
  const map = new Map<
    string,
    { key: string; count: number; critical: number; units: number; parts: Set<string> }
  >();
  for (const ncr of ncrs) {
    const key = getKey(ncr)?.trim();
    if (!key) continue;
    const row =
      map.get(key) ??
      {
        key,
        count: 0,
        critical: 0,
        units: 0,
        parts: new Set<string>(),
      };
    row.count += 1;
    row.critical += ncr.severity === 'critical' ? 1 : 0;
    row.units += Number(ncr.quantityAffected) || 0;
    if (ncr.partNumber) row.parts.add(ncr.partNumber);
    map.set(key, row);
  }
  return Array.from(map.values())
    .map((row) => ({ ...row, parts: Array.from(row.parts).sort() }))
    .sort((a, b) => b.critical - a.critical || b.units - a.units || b.count - a.count);
}
