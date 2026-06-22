import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { HrEmployee } from './entities/hr-employee.entity';
import { HrRequisition } from './entities/hr-requisition.entity';
import { HrCandidate } from './entities/hr-candidate.entity';
import { HrPerformanceReview } from './entities/hr-performance-review.entity';
import { HrAbsence } from './entities/hr-absence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { PeopleService } from '../people/people.service';
import {
  AdvanceCandidateDto,
  CreateAbsenceDto,
  CreateCandidateDto,
  CreateEmployeeDto,
  CreateRequisitionDto,
  CreateReviewDto,
  TerminateEmployeeDto,
  TransitionRequisitionDto,
  UpdateEmployeeDto,
  UpdateRequisitionDto,
  UpdateReviewDto,
} from './dto/hr.dto';
import {
  absenteeismRate,
  annualizedTurnover,
  directIndirectRatio,
  earlyAttritionRate,
  flightRiskScore,
  LaborType,
  mean,
  nineBoxCell,
  PotentialRating,
  round,
  spanOfControl,
  staffingRiskScore,
  tenureBand,
  TenureBand,
  tenureYears,
  timeToFillDays,
} from './hr-analytics';
import {
  ACTIVE_REQUISITION_STATES,
  canAdvanceCandidate,
  canTransitionRequisition,
  CandidateStage,
  RequisitionStatus,
} from './hr-lifecycle';

/** Standard scheduled hours per worked day for absenteeism normalization. */
const SHIFT_HOURS = 8;
/** Absence types that count as unplanned lost time (vacation/permits excluded). */
const LOST_TIME_TYPES = new Set(['ABSENCE', 'SICK', 'LATE', 'SUSPENSION']);

export interface WorkforceOverview {
  headcount: number;
  direct: number;
  indirect: number;
  directIndirectRatio: number;
  onLeave: number;
  byShift: { key: string; count: number }[];
  byArea: { key: string; count: number }[];
  tenureBands: { band: TenureBand; count: number }[];
  avgTenureYears: number;
  newHires90d: number;
  separations12m: number;
  turnoverPct: number;
  voluntaryPct: number;
  earlyAttritionPct: number;
  absenteeismPct: number;
  spanOfControl: number;
  openRequisitions: number;
  openOpenings: number;
  monthlyLaborCost: number;
}

export interface AttritionAnalysis {
  turnoverPct: number;
  voluntary: number;
  involuntary: number;
  earlyAttritionPct: number;
  byArea: { key: string; separations: number; headcount: number; turnoverPct: number }[];
  byShift: { key: string; separations: number; headcount: number; turnoverPct: number }[];
  topReasons: { reason: string; count: number }[];
  trend: { month: string; separations: number; hires: number }[];
}

export interface StaffingRiskCell {
  area: string;
  shift: string;
  headcount: number;
  openOpenings: number;
  attritionPct: number;
  absenteeismPct: number;
  skillCoveragePct: number;
  score: number;
  band: string;
  gapPct: number;
  recommendation: string;
  drivers: string[];
}

export interface RecruitingFunnel {
  openRequisitions: number;
  totalOpenings: number;
  filledOpenings: number;
  fillRatePct: number;
  avgTimeToFillDays: number | null;
  agingRequisitions: number;
  byStage: { stage: CandidateStage; count: number }[];
  offerAcceptPct: number | null;
  rampRequisitions: number;
}

export interface NineBoxResult {
  cells: {
    index: number;
    key: string;
    label: string;
    action: string;
    count: number;
    people: { name: string; area: string | null; score: number | null }[];
  }[];
  total: number;
  successionReadyNow: number;
}

export interface FlightRiskRow {
  id: string;
  name: string;
  employeeNumber: string | null;
  area: string | null;
  shift: string | null;
  tenureYears: number;
  score: number;
  band: string;
  drivers: string[];
}

@Injectable()
export class HrService {
  private readonly logger = new Logger(HrService.name);

  constructor(
    @InjectRepository(HrEmployee) private readonly empRepo: Repository<HrEmployee>,
    @InjectRepository(HrRequisition) private readonly reqRepo: Repository<HrRequisition>,
    @InjectRepository(HrCandidate) private readonly candRepo: Repository<HrCandidate>,
    @InjectRepository(HrPerformanceReview) private readonly reviewRepo: Repository<HrPerformanceReview>,
    @InjectRepository(HrAbsence) private readonly absRepo: Repository<HrAbsence>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    @Optional() private readonly ledger?: EventLedgerService,
    @Optional() private readonly people?: PeopleService,
  ) {}

  // ── scoping ────────────────────────────────────────────────────────────────

  private scope<T extends object>(qb: SelectQueryBuilder<T>, alias: string): SelectQueryBuilder<T> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  private baseFields() {
    return {
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    };
  }

  private async allocate(docType: string): Promise<string | null> {
    try {
      return await this.numbering.allocate(docType);
    } catch (err) {
      this.logger.warn(`Folio (${docType}) failed: ${(err as Error)?.message}`);
      return null;
    }
  }

  private async record(action: string, referenceType: string, referenceId: string, metadata: Record<string, unknown>) {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.SYSTEM,
        action,
        referenceType,
        referenceId,
        plant: this.tenantCtx.getPlantId() ?? undefined,
        metadata,
      });
    } catch (err) {
      this.logger.warn(`Ledger write skipped: ${(err as Error)?.message}`);
    }
  }

  // ── employees ────────────────────────────────────────────────────────────────

  async createEmployee(dto: CreateEmployeeDto): Promise<HrEmployee> {
    const folio = await this.allocate('EMPLOYEE');
    const entity = this.empRepo.create({
      ...this.baseFields(),
      folio,
      employeeNumber: dto.employeeNumber ?? null,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email ?? null,
      position: dto.position ?? null,
      area: dto.area ?? null,
      department: dto.department ?? null,
      costCenter: dto.costCenter ?? null,
      shift: dto.shift ?? null,
      line: dto.line ?? null,
      station: dto.station ?? null,
      laborType: (dto.laborType ?? 'DIRECT') as LaborType,
      employmentType: dto.employmentType ?? 'FULL_TIME',
      status: 'ACTIVE',
      hireDate: dto.hireDate ? new Date(dto.hireDate) : new Date(),
      birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
      gender: dto.gender ?? null,
      monthlyCost: dto.monthlyCost ?? null,
      supervisorName: dto.supervisorName ?? null,
      managerEmployeeNumber: dto.managerEmployeeNumber ?? null,
      engagementScore: dto.engagementScore ?? null,
    });
    const saved = await this.empRepo.save(entity);
    await this.record('HR_EMPLOYEE_HIRED', 'HR_EMPLOYEE', saved.id, {
      name: `${saved.firstName} ${saved.lastName}`,
      area: saved.area,
      laborType: saved.laborType,
    });
    return saved;
  }

  async listEmployees(filters: {
    status?: string;
    area?: string;
    shift?: string;
    laborType?: string;
    q?: string;
  } = {}): Promise<HrEmployee[]> {
    const qb = this.empRepo.createQueryBuilder('e');
    this.scope(qb, 'e');
    if (filters.status) qb.andWhere('e.status = :s', { s: filters.status });
    if (filters.area) qb.andWhere('e.area = :a', { a: filters.area });
    if (filters.shift) qb.andWhere('e.shift = :sh', { sh: filters.shift });
    if (filters.laborType) qb.andWhere('e.labor_type = :lt', { lt: filters.laborType });
    if (filters.q) {
      qb.andWhere(
        '(LOWER(e.first_name) LIKE :q OR LOWER(e.last_name) LIKE :q OR LOWER(e.employee_number) LIKE :q)',
        { q: `%${filters.q.toLowerCase()}%` },
      );
    }
    qb.orderBy('e.status', 'ASC').addOrderBy('e.last_name', 'ASC');
    return qb.getMany();
  }

  async getEmployee(id: string): Promise<HrEmployee> {
    const found = await this.empRepo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Colaborador no encontrado.');
    return found;
  }

  async updateEmployee(id: string, dto: UpdateEmployeeDto): Promise<HrEmployee> {
    const e = await this.getEmployee(id);
    Object.assign(e, {
      ...(dto.position !== undefined && { position: dto.position }),
      ...(dto.area !== undefined && { area: dto.area }),
      ...(dto.department !== undefined && { department: dto.department }),
      ...(dto.costCenter !== undefined && { costCenter: dto.costCenter }),
      ...(dto.shift !== undefined && { shift: dto.shift }),
      ...(dto.line !== undefined && { line: dto.line }),
      ...(dto.station !== undefined && { station: dto.station }),
      ...(dto.laborType !== undefined && { laborType: dto.laborType as LaborType }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.monthlyCost !== undefined && { monthlyCost: dto.monthlyCost }),
      ...(dto.supervisorName !== undefined && { supervisorName: dto.supervisorName }),
      ...(dto.engagementScore !== undefined && { engagementScore: dto.engagementScore }),
    });
    return this.empRepo.save(e);
  }

  async terminateEmployee(id: string, dto: TerminateEmployeeDto): Promise<HrEmployee> {
    const e = await this.getEmployee(id);
    if (e.status === 'TERMINATED') throw new BadRequestException('El colaborador ya está dado de baja.');
    e.status = 'TERMINATED';
    e.terminationType = dto.terminationType;
    e.terminationReason = dto.reason ?? null;
    e.terminationDate = dto.terminationDate ? new Date(dto.terminationDate) : new Date();
    const saved = await this.empRepo.save(e);
    await this.record('HR_EMPLOYEE_TERMINATED', 'HR_EMPLOYEE', saved.id, {
      name: `${saved.firstName} ${saved.lastName}`,
      type: saved.terminationType,
      reason: saved.terminationReason,
    });
    return saved;
  }

  // ── requisitions ─────────────────────────────────────────────────────────────

  async createRequisition(dto: CreateRequisitionDto): Promise<HrRequisition> {
    const folio = await this.allocate('HR_REQUISITION');
    const entity = this.reqRepo.create({
      ...this.baseFields(),
      folio,
      title: dto.title,
      area: dto.area ?? null,
      department: dto.department ?? null,
      costCenter: dto.costCenter ?? null,
      shift: dto.shift ?? null,
      line: dto.line ?? null,
      laborType: (dto.laborType ?? 'DIRECT') as LaborType,
      openings: dto.openings ?? 1,
      filledCount: 0,
      status: 'OPEN',
      priority: dto.priority ?? 'MEDIUM',
      reason: dto.reason ?? 'GROWTH',
      program: dto.program ?? null,
      customer: dto.customer ?? null,
      hiringManager: dto.hiringManager ?? null,
      openedDate: new Date(),
      targetFillDate: dto.targetFillDate ? new Date(dto.targetFillDate) : null,
    });
    const saved = await this.reqRepo.save(entity);
    await this.record('HR_REQUISITION_OPENED', 'HR_REQUISITION', saved.id, {
      title: saved.title,
      openings: saved.openings,
      reason: saved.reason,
    });
    return saved;
  }

  async listRequisitions(filters: { status?: string; area?: string } = {}): Promise<HrRequisition[]> {
    const qb = this.reqRepo.createQueryBuilder('r');
    this.scope(qb, 'r');
    if (filters.status) qb.andWhere('r.status = :s', { s: filters.status });
    if (filters.area) qb.andWhere('r.area = :a', { a: filters.area });
    qb.orderBy('r.status', 'ASC').addOrderBy('r.opened_date', 'DESC');
    return qb.getMany();
  }

  async getRequisition(id: string): Promise<HrRequisition> {
    const found = await this.reqRepo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Requisición no encontrada.');
    return found;
  }

  async updateRequisition(id: string, dto: UpdateRequisitionDto): Promise<HrRequisition> {
    const r = await this.getRequisition(id);
    Object.assign(r, {
      ...(dto.openings !== undefined && { openings: dto.openings }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
      ...(dto.hiringManager !== undefined && { hiringManager: dto.hiringManager }),
      ...(dto.targetFillDate !== undefined && {
        targetFillDate: dto.targetFillDate ? new Date(dto.targetFillDate) : null,
      }),
    });
    return this.reqRepo.save(r);
  }

  async transitionRequisition(id: string, dto: TransitionRequisitionDto): Promise<HrRequisition> {
    const r = await this.getRequisition(id);
    if (!canTransitionRequisition(r.status as RequisitionStatus, dto.to)) {
      throw new BadRequestException(`Transición inválida ${r.status} → ${dto.to}.`);
    }
    r.status = dto.to;
    if (dto.to === 'FILLED') r.filledDate = new Date();
    if (dto.to === 'OPEN') r.filledDate = null;
    const saved = await this.reqRepo.save(r);
    await this.record('HR_REQUISITION_TRANSITION', 'HR_REQUISITION', saved.id, { to: dto.to });
    return saved;
  }

  // ── candidates ─────────────────────────────────────────────────────────────

  async createCandidate(dto: CreateCandidateDto): Promise<HrCandidate> {
    let requisitionFolio: string | null = null;
    if (dto.requisitionId) {
      const req = await this.reqRepo.findOne({ where: { id: dto.requisitionId } });
      requisitionFolio = req?.folio ?? null;
    }
    const entity = this.candRepo.create({
      ...this.baseFields(),
      requisitionId: dto.requisitionId ?? null,
      requisitionFolio,
      name: dto.name,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      source: (dto.source as HrCandidate['source']) ?? null,
      stage: 'APPLIED',
      rating: dto.rating ?? null,
      appliedDate: new Date(),
      stageUpdatedDate: new Date(),
      notes: dto.notes ?? null,
    });
    return this.candRepo.save(entity);
  }

  async listCandidates(filters: { requisitionId?: string; stage?: string } = {}): Promise<HrCandidate[]> {
    const qb = this.candRepo.createQueryBuilder('c');
    this.scope(qb, 'c');
    if (filters.requisitionId) qb.andWhere('c.requisition_id = :r', { r: filters.requisitionId });
    if (filters.stage) qb.andWhere('c.stage = :s', { s: filters.stage });
    qb.orderBy('c.applied_date', 'DESC');
    return qb.getMany();
  }

  async advanceCandidate(id: string, dto: AdvanceCandidateDto): Promise<HrCandidate> {
    const c = await this.candRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Candidato no encontrado.');
    if (!canAdvanceCandidate(c.stage as CandidateStage, dto.to)) {
      throw new BadRequestException(`Transición inválida ${c.stage} → ${dto.to}.`);
    }
    c.stage = dto.to;
    c.stageUpdatedDate = new Date();
    if (dto.to === 'HIRED') {
      c.hiredDate = new Date();
      await this.onCandidateHired(c, dto.createEmployee === true);
    }
    const saved = await this.candRepo.save(c);
    await this.record('HR_CANDIDATE_STAGE', 'HR_CANDIDATE', saved.id, { to: dto.to });
    return saved;
  }

  private async onCandidateHired(c: HrCandidate, createEmployee: boolean): Promise<void> {
    if (c.requisitionId) {
      const req = await this.reqRepo.findOne({ where: { id: c.requisitionId } });
      if (req) {
        req.filledCount = (req.filledCount ?? 0) + 1;
        if (req.filledCount >= req.openings && ACTIVE_REQUISITION_STATES.includes(req.status as RequisitionStatus)) {
          req.status = 'FILLED';
          req.filledDate = new Date();
        }
        await this.reqRepo.save(req);
      }
      if (createEmployee) {
        const [firstName, ...rest] = c.name.trim().split(/\s+/);
        const req2 = req ?? null;
        await this.createEmployee({
          firstName: firstName || c.name,
          lastName: rest.join(' ') || '—',
          email: c.email ?? undefined,
          position: req2?.title,
          area: req2?.area ?? undefined,
          department: req2?.department ?? undefined,
          costCenter: req2?.costCenter ?? undefined,
          shift: req2?.shift ?? undefined,
          line: req2?.line ?? undefined,
          laborType: (req2?.laborType as LaborType) ?? undefined,
        });
      }
    }
  }

  // ── performance reviews ──────────────────────────────────────────────────────

  async createReview(dto: CreateReviewDto): Promise<HrPerformanceReview> {
    const folio = await this.allocate('PERFORMANCE_REVIEW');
    const nineBoxKey =
      dto.performanceScore != null && dto.potential
        ? nineBoxCell(dto.performanceScore, dto.potential as PotentialRating).key
        : null;
    const entity = this.reviewRepo.create({
      ...this.baseFields(),
      folio,
      employeeId: dto.employeeId ?? null,
      employeeNumber: dto.employeeNumber ?? null,
      employeeName: dto.employeeName,
      area: dto.area ?? null,
      department: dto.department ?? null,
      period: dto.period,
      reviewer: dto.reviewer ?? this.tenantCtx.getUserEmail(),
      performanceScore: dto.performanceScore ?? null,
      potential: (dto.potential as PotentialRating) ?? null,
      nineBoxKey,
      status: 'DRAFT',
      goalsMetPct: dto.goalsMetPct ?? null,
      successionReadiness: dto.successionReadiness ?? null,
      comments: dto.comments ?? null,
      reviewDate: new Date(),
    });
    return this.reviewRepo.save(entity);
  }

  async listReviews(filters: { period?: string; employeeId?: string } = {}): Promise<HrPerformanceReview[]> {
    const qb = this.reviewRepo.createQueryBuilder('v');
    this.scope(qb, 'v');
    if (filters.period) qb.andWhere('v.period = :p', { p: filters.period });
    if (filters.employeeId) qb.andWhere('v.employee_id = :e', { e: filters.employeeId });
    qb.orderBy('v.review_date', 'DESC');
    return qb.getMany();
  }

  async getReview(id: string): Promise<HrPerformanceReview> {
    const found = await this.reviewRepo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Evaluación no encontrada.');
    return found;
  }

  async updateReview(id: string, dto: UpdateReviewDto): Promise<HrPerformanceReview> {
    const v = await this.getReview(id);
    Object.assign(v, {
      ...(dto.performanceScore !== undefined && { performanceScore: dto.performanceScore }),
      ...(dto.potential !== undefined && { potential: dto.potential as PotentialRating }),
      ...(dto.goalsMetPct !== undefined && { goalsMetPct: dto.goalsMetPct }),
      ...(dto.successionReadiness !== undefined && { successionReadiness: dto.successionReadiness }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.comments !== undefined && { comments: dto.comments }),
    });
    if (v.performanceScore != null && v.potential) {
      v.nineBoxKey = nineBoxCell(v.performanceScore, v.potential as PotentialRating).key;
    }
    return this.reviewRepo.save(v);
  }

  // ── absences ─────────────────────────────────────────────────────────────────

  async createAbsence(dto: CreateAbsenceDto): Promise<HrAbsence> {
    const entity = this.absRepo.create({
      ...this.baseFields(),
      employeeId: dto.employeeId ?? null,
      employeeNumber: dto.employeeNumber ?? null,
      employeeName: dto.employeeName,
      area: dto.area ?? null,
      shift: dto.shift ?? null,
      line: dto.line ?? null,
      date: dto.date ? new Date(dto.date) : new Date(),
      type: dto.type ?? 'ABSENCE',
      justified: dto.justified ?? false,
      hours: dto.hours ?? SHIFT_HOURS,
      reason: dto.reason ?? null,
    });
    return this.absRepo.save(entity);
  }

  async listAbsences(filters: { employeeId?: string; type?: string } = {}): Promise<HrAbsence[]> {
    const qb = this.absRepo.createQueryBuilder('a');
    this.scope(qb, 'a');
    if (filters.employeeId) qb.andWhere('a.employee_id = :e', { e: filters.employeeId });
    if (filters.type) qb.andWhere('a.type = :t', { t: filters.type });
    qb.orderBy('a.date', 'DESC');
    return qb.getMany();
  }

  // ── analytics ────────────────────────────────────────────────────────────────

  private async allEmployees(): Promise<HrEmployee[]> {
    const qb = this.empRepo.createQueryBuilder('e');
    this.scope(qb, 'e');
    return qb.getMany();
  }

  private withinDays(date: Date | string | null, days: number, asOf: Date): boolean {
    if (!date) return false;
    const t = new Date(date).getTime();
    if (Number.isNaN(t)) return false;
    return asOf.getTime() - t <= days * 86_400_000 && t <= asOf.getTime();
  }

  async workforceOverview(): Promise<WorkforceOverview> {
    const asOf = new Date();
    const all = await this.allEmployees();
    const active = all.filter((e) => e.status !== 'TERMINATED');
    const direct = active.filter((e) => e.laborType === 'DIRECT').length;
    const indirect = active.filter((e) => e.laborType === 'INDIRECT').length;

    const byShift = this.groupCount(active, (e) => e.shift || 'Sin turno');
    const byArea = this.groupCount(active, (e) => e.area || 'Sin área');

    const tenures = active.map((e) => tenureYears(e.hireDate, asOf));
    const bandCounts = new Map<TenureBand, number>();
    for (const y of tenures) bandCounts.set(tenureBand(y), (bandCounts.get(tenureBand(y)) ?? 0) + 1);
    const tenureBands = (['<3m', '3-12m', '1-3y', '3-5y', '5y+'] as TenureBand[]).map((band) => ({
      band,
      count: bandCounts.get(band) ?? 0,
    }));

    const separations = all.filter((e) => e.status === 'TERMINATED' && this.withinDays(e.terminationDate, 365, asOf));
    const voluntary = separations.filter((e) => e.terminationType === 'VOLUNTARY').length;
    const avgHeadcount = active.length + separations.length / 2;
    const turnoverPct = annualizedTurnover(separations.length, avgHeadcount, 365);

    const hires12m = all.filter((e) => this.withinDays(e.hireDate, 365, asOf));
    const earlySeparations = separations.filter((e) => {
      const t = e.terminationDate && e.hireDate ? new Date(e.terminationDate).getTime() - new Date(e.hireDate).getTime() : Infinity;
      return t <= 90 * 86_400_000;
    });

    const absent30 = await this.lostHoursWindow(30, asOf);
    const workdays = (30 * 5) / 7;
    const scheduled = active.length * workdays * SHIFT_HOURS;

    const managers = new Set(active.map((e) => e.managerEmployeeNumber).filter(Boolean) as string[]);
    const reqs = await this.listRequisitions();
    const openReqs = reqs.filter((r) => ACTIVE_REQUISITION_STATES.includes(r.status as RequisitionStatus));
    const openOpenings = openReqs.reduce((s, r) => s + Math.max(0, r.openings - r.filledCount), 0);

    return {
      headcount: active.length,
      direct,
      indirect,
      directIndirectRatio: directIndirectRatio(direct, indirect),
      onLeave: active.filter((e) => e.status === 'ON_LEAVE').length,
      byShift,
      byArea,
      tenureBands,
      avgTenureYears: round(mean(tenures), 1),
      newHires90d: all.filter((e) => e.status !== 'TERMINATED' && this.withinDays(e.hireDate, 90, asOf)).length,
      separations12m: separations.length,
      turnoverPct,
      voluntaryPct: separations.length ? round((voluntary / separations.length) * 100, 1) : 0,
      earlyAttritionPct: earlyAttritionRate(earlySeparations.length, hires12m.length),
      absenteeismPct: absenteeismRate(absent30, scheduled),
      spanOfControl: spanOfControl(active.length, managers.size),
      openRequisitions: openReqs.length,
      openOpenings,
      monthlyLaborCost: round(
        active.reduce((s, e) => s + (e.monthlyCost ?? 0), 0),
        0,
      ),
    };
  }

  async attritionAnalysis(): Promise<AttritionAnalysis> {
    const asOf = new Date();
    const all = await this.allEmployees();
    const active = all.filter((e) => e.status !== 'TERMINATED');
    const separations = all.filter((e) => e.status === 'TERMINATED' && this.withinDays(e.terminationDate, 365, asOf));

    const headByArea = this.countMap(active, (e) => e.area || 'Sin área');
    const sepByArea = this.countMap(separations, (e) => e.area || 'Sin área');
    const byArea = [...new Set([...headByArea.keys(), ...sepByArea.keys()])].map((key) => {
      const headcount = headByArea.get(key) ?? 0;
      const sep = sepByArea.get(key) ?? 0;
      return { key, separations: sep, headcount, turnoverPct: annualizedTurnover(sep, headcount + sep / 2, 365) };
    }).sort((a, b) => b.turnoverPct - a.turnoverPct);

    const headByShift = this.countMap(active, (e) => e.shift || 'Sin turno');
    const sepByShift = this.countMap(separations, (e) => e.shift || 'Sin turno');
    const byShift = [...new Set([...headByShift.keys(), ...sepByShift.keys()])].map((key) => {
      const headcount = headByShift.get(key) ?? 0;
      const sep = sepByShift.get(key) ?? 0;
      return { key, separations: sep, headcount, turnoverPct: annualizedTurnover(sep, headcount + sep / 2, 365) };
    }).sort((a, b) => b.turnoverPct - a.turnoverPct);

    const reasonMap = this.countMap(separations.filter((e) => e.terminationReason), (e) => e.terminationReason as string);
    const topReasons = [...reasonMap.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const trend: { month: string; separations: number; hires: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(asOf.getFullYear(), asOf.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const sep = all.filter((e) => e.terminationDate && this.monthKey(e.terminationDate) === key).length;
      const hires = all.filter((e) => e.hireDate && this.monthKey(e.hireDate) === key).length;
      trend.push({ month: key, separations: sep, hires });
    }

    const hires12m = all.filter((e) => this.withinDays(e.hireDate, 365, asOf));
    const earlySeparations = separations.filter((e) => {
      const t = e.terminationDate && e.hireDate ? new Date(e.terminationDate).getTime() - new Date(e.hireDate).getTime() : Infinity;
      return t <= 90 * 86_400_000;
    });

    return {
      turnoverPct: annualizedTurnover(separations.length, active.length + separations.length / 2, 365),
      voluntary: separations.filter((e) => e.terminationType === 'VOLUNTARY').length,
      involuntary: separations.filter((e) => e.terminationType === 'INVOLUNTARY').length,
      earlyAttritionPct: earlyAttritionRate(earlySeparations.length, hires12m.length),
      byArea,
      byShift,
      topReasons,
      trend,
    };
  }

  async staffingRisk(): Promise<StaffingRiskCell[]> {
    const asOf = new Date();
    const all = await this.allEmployees();
    const active = all.filter((e) => e.status !== 'TERMINATED');
    const separations = all.filter((e) => e.status === 'TERMINATED' && this.withinDays(e.terminationDate, 365, asOf));
    const reqs = (await this.listRequisitions()).filter((r) =>
      ACTIVE_REQUISITION_STATES.includes(r.status as RequisitionStatus),
    );
    const absences = await this.listAbsences();
    const coverageByArea = await this.skillCoverageByArea();

    const cellKey = (area: string | null, shift: string | null) => `${area || 'Sin área'}␟${shift || 'Sin turno'}`;
    const cells = new Map<string, { area: string; shift: string }>();
    for (const e of active) {
      const k = cellKey(e.area, e.shift);
      if (!cells.has(k)) cells.set(k, { area: e.area || 'Sin área', shift: e.shift || 'Sin turno' });
    }
    for (const r of reqs) {
      const k = cellKey(r.area, r.shift);
      if (!cells.has(k)) cells.set(k, { area: r.area || 'Sin área', shift: r.shift || 'Sin turno' });
    }

    const workdays = (30 * 5) / 7;
    const out: StaffingRiskCell[] = [];
    for (const [k, { area, shift }] of cells.entries()) {
      const headcount = active.filter((e) => cellKey(e.area, e.shift) === k).length;
      const openOpenings = reqs
        .filter((r) => cellKey(r.area, r.shift) === k)
        .reduce((s, r) => s + Math.max(0, r.openings - r.filledCount), 0);
      const sep = separations.filter((e) => cellKey(e.area, e.shift) === k).length;
      const attritionPct = annualizedTurnover(sep, headcount + sep / 2, 365);
      const lost = absences
        .filter((a) => cellKey(a.area, a.shift) === k && LOST_TIME_TYPES.has(a.type) && this.withinDays(a.date, 30, asOf))
        .reduce((s, a) => s + (a.hours ?? 0), 0);
      const scheduled = headcount * workdays * SHIFT_HOURS;
      const absenteeismPct = absenteeismRate(lost, scheduled);
      const skillCoveragePct = coverageByArea.get(area) ?? 100;

      const risk = staffingRiskScore({
        headcount,
        openOpenings,
        attritionRatePct: attritionPct,
        absenteeismRatePct: absenteeismPct,
        skillCoveragePct,
      });
      out.push({
        area,
        shift,
        headcount,
        openOpenings,
        attritionPct,
        absenteeismPct,
        skillCoveragePct: round(skillCoveragePct, 0),
        score: risk.score,
        band: risk.band,
        gapPct: risk.gapPct,
        recommendation: risk.recommendation,
        drivers: risk.drivers,
      });
    }
    return out.sort((a, b) => b.score - a.score);
  }

  async recruitingFunnel(): Promise<RecruitingFunnel> {
    const asOf = new Date();
    const reqs = await this.listRequisitions();
    const openReqs = reqs.filter((r) => ACTIVE_REQUISITION_STATES.includes(r.status as RequisitionStatus));
    const totalOpenings = openReqs.reduce((s, r) => s + r.openings, 0);
    const filledOpenings = openReqs.reduce((s, r) => s + Math.min(r.filledCount, r.openings), 0);

    const filledReqs = reqs.filter((r) => r.status === 'FILLED' && r.filledDate && r.openedDate);
    const ttf = filledReqs.map((r) => timeToFillDays(r.openedDate, r.filledDate)).filter((d): d is number => d !== null);
    const avgTimeToFillDays = ttf.length ? round(mean(ttf), 0) : null;

    const agingRequisitions = openReqs.filter((r) => {
      const days = timeToFillDays(r.openedDate, asOf);
      return days !== null && days > 45;
    }).length;

    const candidates = await this.listCandidates();
    const stages: CandidateStage[] = ['APPLIED', 'SCREEN', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN'];
    const byStage = stages.map((stage) => ({ stage, count: candidates.filter((c) => c.stage === stage).length }));

    const offers = candidates.filter((c) => ['OFFER', 'HIRED'].includes(c.stage)).length;
    const hired = candidates.filter((c) => c.stage === 'HIRED').length;
    const offerAcceptPct = offers > 0 ? round((hired / offers) * 100, 0) : null;

    return {
      openRequisitions: openReqs.length,
      totalOpenings,
      filledOpenings,
      fillRatePct: totalOpenings > 0 ? round((filledOpenings / totalOpenings) * 100, 0) : 0,
      avgTimeToFillDays,
      agingRequisitions,
      byStage,
      offerAcceptPct,
      rampRequisitions: openReqs.filter((r) => r.reason === 'RAMP').length,
    };
  }

  async nineBox(period?: string): Promise<NineBoxResult> {
    const reviews = (await this.listReviews(period ? { period } : {})).filter(
      (v) => v.performanceScore != null && v.potential,
    );
    // Keep the latest review per employee (by name fallback).
    const latest = new Map<string, HrPerformanceReview>();
    for (const v of reviews) {
      const key = v.employeeId || v.employeeName;
      const prev = latest.get(key);
      if (!prev || (v.reviewDate && prev.reviewDate && new Date(v.reviewDate) > new Date(prev.reviewDate))) {
        latest.set(key, v);
      }
    }

    const buckets = new Map<number, NineBoxResult['cells'][number]>();
    let successionReadyNow = 0;
    for (const v of latest.values()) {
      const cell = nineBoxCell(v.performanceScore as number, v.potential as PotentialRating);
      const entry =
        buckets.get(cell.index) ??
        { index: cell.index, key: cell.key, label: cell.label, action: cell.action, count: 0, people: [] };
      entry.count += 1;
      entry.people.push({ name: v.employeeName, area: v.area, score: v.performanceScore });
      buckets.set(cell.index, entry);
      if (v.successionReadiness === 'READY_NOW') successionReadyNow += 1;
    }

    const cells: NineBoxResult['cells'] = [];
    for (let i = 1; i <= 9; i++) {
      cells.push(
        buckets.get(i) ?? {
          index: i,
          key: nineBoxCellByIndex(i).key,
          label: nineBoxCellByIndex(i).label,
          action: nineBoxCellByIndex(i).action,
          count: 0,
          people: [],
        },
      );
    }
    return { cells, total: latest.size, successionReadyNow };
  }

  async flightRisk(limit = 25): Promise<FlightRiskRow[]> {
    const asOf = new Date();
    const active = (await this.allEmployees()).filter((e) => e.status === 'ACTIVE');
    const absences = await this.listAbsences();
    const reviews = await this.listReviews();
    const reviewByKey = new Set(reviews.map((v) => v.employeeId || v.employeeName));

    const rows = active.map((e) => {
      const mine = absences.filter(
        (a) => (a.employeeId && a.employeeId === e.id) || (a.employeeNumber && a.employeeNumber === e.employeeNumber),
      );
      const absences90d = mine.filter((a) => a.type !== 'LATE' && this.withinDays(a.date, 90, asOf)).length;
      const lateCount90d = mine.filter((a) => a.type === 'LATE' && this.withinDays(a.date, 90, asOf)).length;
      const ty = tenureYears(e.hireDate, asOf);
      const risk = flightRiskScore({
        tenureYearsValue: ty,
        absences90d,
        lateCount90d,
        engagementScore: e.engagementScore,
        hadRecentReview: reviewByKey.has(e.id) || reviewByKey.has(`${e.firstName} ${e.lastName}`),
        laborType: e.laborType,
      });
      return {
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        employeeNumber: e.employeeNumber,
        area: e.area,
        shift: e.shift,
        tenureYears: ty,
        score: risk.score,
        band: risk.band,
        drivers: risk.drivers,
      };
    });
    return rows.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  async laborCost(): Promise<{
    monthlyDirect: number;
    monthlyIndirect: number;
    total: number;
    byCostCenter: { key: string; cost: number; headcount: number }[];
    byArea: { key: string; cost: number; headcount: number }[];
  }> {
    const active = (await this.allEmployees()).filter((e) => e.status !== 'TERMINATED');
    const sum = (arr: HrEmployee[]) => round(arr.reduce((s, e) => s + (e.monthlyCost ?? 0), 0), 0);
    const monthlyDirect = sum(active.filter((e) => e.laborType === 'DIRECT'));
    const monthlyIndirect = sum(active.filter((e) => e.laborType === 'INDIRECT'));

    const ccMap = this.groupBy(active, (e) => e.costCenter || 'Sin CC');
    const byCostCenter = [...ccMap.entries()]
      .map(([key, arr]) => ({ key, cost: sum(arr), headcount: arr.length }))
      .sort((a, b) => b.cost - a.cost);
    const areaMap = this.groupBy(active, (e) => e.area || 'Sin área');
    const byArea = [...areaMap.entries()]
      .map(([key, arr]) => ({ key, cost: sum(arr), headcount: arr.length }))
      .sort((a, b) => b.cost - a.cost);

    return { monthlyDirect, monthlyIndirect, total: monthlyDirect + monthlyIndirect, byCostCenter, byArea };
  }

  // ── analytics helpers ────────────────────────────────────────────────────────

  private async lostHoursWindow(days: number, asOf: Date): Promise<number> {
    const abs = await this.listAbsences();
    return abs
      .filter((a) => LOST_TIME_TYPES.has(a.type) && this.withinDays(a.date, days, asOf))
      .reduce((s, a) => s + (a.hours ?? 0), 0);
  }

  /** % of headcount in each area covered by a non-expired certification. */
  private async skillCoverageByArea(): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (!this.people) return out;
    try {
      const active = (await this.allEmployees()).filter((e) => e.status !== 'TERMINATED');
      const headByArea = this.countMap(active, (e) => e.area || 'Sin área');
      const certs = await this.people.list();
      const certifiedByArea = new Map<string, Set<string>>();
      for (const c of certs) {
        if (c.status === 'EXPIRED') continue;
        const area = c.area || 'Sin área';
        const set = certifiedByArea.get(area) ?? new Set<string>();
        set.add(c.employeeName);
        certifiedByArea.set(area, set);
      }
      for (const [area, head] of headByArea.entries()) {
        const covered = certifiedByArea.get(area)?.size ?? 0;
        out.set(area, head > 0 ? Math.min(100, round((covered / head) * 100, 0)) : 100);
      }
    } catch (err) {
      this.logger.warn(`skillCoverageByArea skipped: ${(err as Error)?.message}`);
    }
    return out;
  }

  private groupCount<T>(rows: T[], key: (r: T) => string): { key: string; count: number }[] {
    return [...this.countMap(rows, key).entries()]
      .map(([k, count]) => ({ key: k, count }))
      .sort((a, b) => b.count - a.count);
  }

  private countMap<T>(rows: T[], key: (r: T) => string): Map<string, number> {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = key(r);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }

  private groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const k = key(r);
      const arr = m.get(k) ?? [];
      arr.push(r);
      m.set(k, arr);
    }
    return m;
  }

  private monthKey(date: Date | string): string {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}

/** Lightweight 9-box metadata lookup by grid index (for empty cells). */
function nineBoxCellByIndex(index: number): { key: string; label: string; action: string } {
  const perf = Math.floor((index - 1) / 3); // 0..2
  const pot = (index - 1) % 3; // 0..2
  const score = perf === 2 ? 5 : perf === 1 ? 3 : 1;
  const potential: PotentialRating = pot === 2 ? 'HIGH' : pot === 1 ? 'MED' : 'LOW';
  const cell = nineBoxCell(score, potential);
  return { key: cell.key, label: cell.label, action: cell.action };
}
