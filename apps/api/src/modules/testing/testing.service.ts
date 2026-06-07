import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { TestRecord } from './entities/test-record.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { CreateTestRecordDto } from './dto/testing.dto';

export interface ParetoBucket {
  failureCode: string;
  count: number;
  pct: number;
}

export interface TestingKpis {
  totalTests: number;
  pass: number;
  fail: number;
  /** Overall yield = pass / total (all attempts). */
  yieldPct: number | null;
  /** First-Pass Yield = serials whose first test passed / distinct serials. */
  firstPassYieldPct: number | null;
  distinctSerials: number;
  pareto: ParetoBucket[];
}

@Injectable()
export class TestingService {
  private readonly logger = new Logger(TestingService.name);

  constructor(
    @InjectRepository(TestRecord)
    private readonly repo: Repository<TestRecord>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  private applyScope(
    qb: SelectQueryBuilder<TestRecord>,
    alias: string,
  ): SelectQueryBuilder<TestRecord> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  async create(dto: CreateTestRecordDto): Promise<TestRecord> {
    let folio: string | null = null;
    try {
      folio = await this.numbering.allocate('TEST_RECORD');
    } catch (err) {
      this.logger.warn(`Folio allocation failed: ${(err as Error)?.message}`);
    }

    const entity = this.repo.create({
      folio,
      serialNumber: dto.serialNumber,
      result: dto.result,
      station: dto.station ?? 'FINAL',
      model: dto.model ?? null,
      failureCode: dto.result === 'FAIL' ? (dto.failureCode ?? 'UNKNOWN') : null,
      failureDescription: dto.failureDescription ?? null,
      operator: this.tenantCtx.getUserEmail(),
      programId: dto.programId ?? null,
      testedAt: dto.testedAt ? new Date(dto.testedAt) : new Date(),
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    const saved = await this.repo.save(entity);
    if (this.ledger) {
      try {
        await this.ledger.recordEvent({
          actorName: this.tenantCtx.getUserEmail(),
          domain: EventDomain.QUALITY,
          action: 'TEST_RECORD_CREATED',
          referenceType: 'TEST_RECORD',
          referenceId: saved.id,
          program: saved.programId ?? undefined,
          plant: saved.plant_id ?? undefined,
          context: { serial: saved.serialNumber },
          metadata: { result: saved.result, failureCode: saved.failureCode, station: saved.station },
        });
      } catch (err) {
        this.logger.warn(`Ledger write skipped: ${(err as Error)?.message}`);
      }
    }
    return saved;
  }

  async list(filters: {
    result?: string;
    station?: string;
    serialNumber?: string;
    model?: string;
  } = {}): Promise<TestRecord[]> {
    const qb = this.repo.createQueryBuilder('t').orderBy('t.tested_at', 'DESC');
    this.applyScope(qb, 't');
    if (filters.result) qb.andWhere('t.result = :r', { r: filters.result });
    if (filters.station) qb.andWhere('t.station = :s', { s: filters.station });
    if (filters.serialNumber)
      qb.andWhere('t.serial_number = :sn', { sn: filters.serialNumber });
    if (filters.model) qb.andWhere('t.model = :m', { m: filters.model });
    return qb.getMany();
  }

  async getOne(id: string): Promise<TestRecord> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Registro de prueba no encontrado.');
    return found;
  }

  /** Recent test records (capped) for the capture screen. */
  async recent(limit = 50): Promise<TestRecord[]> {
    const qb = this.repo
      .createQueryBuilder('t')
      .orderBy('t.tested_at', 'DESC')
      .limit(limit);
    this.applyScope(qb, 't');
    return qb.getMany();
  }

  async kpis(): Promise<TestingKpis> {
    const all = await this.list();
    const total = all.length;
    const pass = all.filter((t) => t.result === 'PASS').length;
    const fail = total - pass;

    // First-Pass Yield: group by serial, take the earliest test per serial.
    const firstBySerial = new Map<string, TestRecord>();
    for (const t of all) {
      const key = t.serialNumber;
      const prev = firstBySerial.get(key);
      const tTime = t.testedAt ? new Date(t.testedAt).getTime() : 0;
      const prevTime = prev?.testedAt ? new Date(prev.testedAt).getTime() : 0;
      if (!prev || tTime < prevTime) firstBySerial.set(key, t);
    }
    const distinctSerials = firstBySerial.size;
    const firstPass = [...firstBySerial.values()].filter(
      (t) => t.result === 'PASS',
    ).length;

    // Pareto of failure codes.
    const failCounts = new Map<string, number>();
    for (const t of all) {
      if (t.result === 'FAIL') {
        const code = t.failureCode || 'UNKNOWN';
        failCounts.set(code, (failCounts.get(code) ?? 0) + 1);
      }
    }
    const pareto: ParetoBucket[] = [...failCounts.entries()]
      .map(([failureCode, count]) => ({
        failureCode,
        count,
        pct: fail > 0 ? Math.round((count / fail) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalTests: total,
      pass,
      fail,
      yieldPct: total > 0 ? Math.round((pass / total) * 1000) / 10 : null,
      firstPassYieldPct:
        distinctSerials > 0
          ? Math.round((firstPass / distinctSerials) * 1000) / 10
          : null,
      distinctSerials,
      pareto,
    };
  }
}
