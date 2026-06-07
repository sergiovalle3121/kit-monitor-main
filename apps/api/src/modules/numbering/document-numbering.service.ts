import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { DocumentSequence } from './entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { CreateSequenceDto, UpdateSequenceDto } from './dto/numbering.dto';
import {
  ResetPolicy,
  computePeriodKey,
  formatDocumentNumber,
  validatePattern,
} from './numbering.format';
import { resolveDefault } from './numbering.defaults';

export interface PreviewResult {
  docType: string;
  next: string;
  current: number;
  resetPolicy: ResetPolicy;
  pattern: string;
  configured: boolean;
}

export interface NumberingKpis {
  totalTypes: number;
  activeTypes: number;
  totalIssued: number;
  issuedThisPeriod: number;
  mostActive: { docType: string; name: string; totalIssued: number } | null;
}

interface Scope {
  tenant_id: string | null;
  plant_id: string | null;
}

/**
 * DocumentNumberingService — the platform's single source of folios.
 *
 * Any module obtains its document number with `allocate('PURCHASE_ORDER')`.
 * Counters are scoped per tenant + plant, configurable (prefix / pattern /
 * padding / reset policy) and created lazily from sensible defaults.
 */
@Injectable()
export class DocumentNumberingService {
  private readonly logger = new Logger(DocumentNumberingService.name);

  constructor(
    @InjectRepository(DocumentSequence)
    private readonly repo: Repository<DocumentSequence>,
    private readonly dataSource: DataSource,
    private readonly tenantCtx: TenantContextService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  // ── Scope helpers ─────────────────────────────────────────────────────────

  private scope(): Scope {
    return {
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
    };
  }

  private applyScope(
    qb: SelectQueryBuilder<DocumentSequence>,
    alias: string,
    scope: Scope,
  ): SelectQueryBuilder<DocumentSequence> {
    if (scope.tenant_id) {
      qb.andWhere(`${alias}.tenant_id = :tenantId`, { tenantId: scope.tenant_id });
    } else {
      qb.andWhere(`${alias}.tenant_id IS NULL`);
    }
    if (scope.plant_id) {
      qb.andWhere(`${alias}.plant_id = :plantId`, { plantId: scope.plant_id });
    } else {
      qb.andWhere(`${alias}.plant_id IS NULL`);
    }
    return qb;
  }

  private normalizeType(docType: string): string {
    const type = (docType ?? '').toUpperCase().trim();
    if (type.length < 2) {
      throw new BadRequestException('docType inválido.');
    }
    return type;
  }

  // ── Allocation (consumes numbers) ─────────────────────────────────────────

  /** Reserve and return the next folio for a document type. */
  async allocate(docType: string, count = 1): Promise<string> {
    const [first] = await this.allocateNumbers(docType, count);
    return first;
  }

  /** Reserve a contiguous block of folios (e.g. for serializing N units). */
  async allocateBlock(docType: string, count: number): Promise<string[]> {
    return this.allocateNumbers(docType, Math.max(1, count));
  }

  private async allocateNumbers(
    docType: string,
    count: number,
  ): Promise<string[]> {
    const type = this.normalizeType(docType);
    const n = Math.min(Math.max(1, Math.trunc(count || 1)), 1000);
    const scope = this.scope();
    const usePgLock = this.dataSource.options.type === 'postgres';

    return this.dataSource.transaction(async (manager: EntityManager) => {
      const repo = manager.getRepository(DocumentSequence);

      const qb = repo
        .createQueryBuilder('seq')
        .where('seq.doc_type = :type', { type });
      this.applyScope(qb, 'seq', scope);
      if (usePgLock) qb.setLock('pessimistic_write');

      let seq = await qb.getOne();
      if (!seq) {
        seq = await this.createDefault(repo, type, scope);
      }

      // Roll the counter over if the reset window changed.
      const now = new Date();
      const desiredPeriod = computePeriodKey(seq.resetPolicy, now);
      if (seq.resetPolicy !== 'NEVER' && seq.periodKey !== desiredPeriod) {
        seq.nextValue = 1;
        seq.periodKey = desiredPeriod;
      }

      const numbers: string[] = [];
      for (let i = 0; i < n; i++) {
        numbers.push(
          formatDocumentNumber({
            pattern: seq.pattern,
            prefix: seq.prefix,
            seq: seq.nextValue,
            padding: seq.padding,
            date: now,
          }),
        );
        seq.nextValue += 1;
        seq.totalIssued = (seq.totalIssued ?? 0) + 1;
      }

      await repo.save(seq);
      return numbers;
    });
  }

  private async createDefault(
    repo: Repository<DocumentSequence>,
    type: string,
    scope: Scope,
  ): Promise<DocumentSequence> {
    const def = resolveDefault(type);
    const entity = repo.create({
      docType: type,
      name: def.name,
      prefix: def.prefix,
      pattern: def.pattern,
      padding: def.padding,
      resetPolicy: def.resetPolicy,
      description: def.description ?? null,
      nextValue: 1,
      totalIssued: 0,
      periodKey: computePeriodKey(def.resetPolicy, new Date()),
      active: true,
      tenant_id: scope.tenant_id,
      plant_id: scope.plant_id,
      created_by: this.tenantCtx.getUserEmail(),
    });
    this.logger.log(`Auto-provisioned sequence for docType=${type}`);
    return repo.save(entity);
  }

  // ── Preview (no consumption) ──────────────────────────────────────────────

  async preview(docType: string): Promise<PreviewResult> {
    const type = this.normalizeType(docType);
    const seq = await this.findScoped(type);
    const now = new Date();

    if (!seq) {
      const def = resolveDefault(type);
      return {
        docType: type,
        next: formatDocumentNumber({
          pattern: def.pattern,
          prefix: def.prefix,
          seq: 1,
          padding: def.padding,
          date: now,
        }),
        current: 1,
        resetPolicy: def.resetPolicy,
        pattern: def.pattern,
        configured: false,
      };
    }

    const desiredPeriod = computePeriodKey(seq.resetPolicy, now);
    const effective =
      seq.resetPolicy !== 'NEVER' && seq.periodKey !== desiredPeriod
        ? 1
        : seq.nextValue;
    return {
      docType: type,
      next: formatDocumentNumber({
        pattern: seq.pattern,
        prefix: seq.prefix,
        seq: effective,
        padding: seq.padding,
        date: now,
      }),
      current: effective,
      resetPolicy: seq.resetPolicy,
      pattern: seq.pattern,
      configured: true,
    };
  }

  // ── Admin CRUD ────────────────────────────────────────────────────────────

  async list(): Promise<DocumentSequence[]> {
    const qb = this.repo.createQueryBuilder('seq').orderBy('seq.doc_type', 'ASC');
    this.applyScope(qb, 'seq', this.scope());
    return qb.getMany();
  }

  private async findScoped(type: string): Promise<DocumentSequence | null> {
    const qb = this.repo
      .createQueryBuilder('seq')
      .where('seq.doc_type = :type', { type });
    this.applyScope(qb, 'seq', this.scope());
    return qb.getOne();
  }

  async getByType(docType: string): Promise<DocumentSequence> {
    const seq = await this.findScoped(this.normalizeType(docType));
    if (!seq) throw new NotFoundException(`Secuencia ${docType} no configurada.`);
    return seq;
  }

  async create(dto: CreateSequenceDto): Promise<DocumentSequence> {
    const type = this.normalizeType(dto.docType);
    const existing = await this.findScoped(type);
    if (existing) {
      throw new BadRequestException(
        `Ya existe una secuencia para ${type} en este alcance.`,
      );
    }
    const def = resolveDefault(type);
    const pattern = dto.pattern ?? def.pattern;
    this.assertPattern(pattern);
    const resetPolicy = dto.resetPolicy ?? def.resetPolicy;

    const scope = this.scope();
    const entity = this.repo.create({
      docType: type,
      name: dto.name ?? def.name,
      prefix: dto.prefix ?? def.prefix,
      pattern,
      padding: dto.padding ?? def.padding,
      resetPolicy,
      description: dto.description ?? def.description ?? null,
      nextValue: dto.startAt ?? 1,
      totalIssued: 0,
      periodKey: computePeriodKey(resetPolicy, new Date()),
      active: true,
      tenant_id: scope.tenant_id,
      plant_id: scope.plant_id,
      created_by: this.tenantCtx.getUserEmail(),
    });
    const saved = await this.repo.save(entity);
    await this.recordLedger('DOCUMENT_SEQUENCE_CREATED', saved, { after: saved });
    return saved;
  }

  async update(id: string, dto: UpdateSequenceDto): Promise<DocumentSequence> {
    const seq = await this.repo.findOne({ where: { id } });
    if (!seq) throw new NotFoundException('Secuencia no encontrada.');

    const before = { ...seq };
    if (dto.pattern !== undefined) {
      this.assertPattern(dto.pattern);
      seq.pattern = dto.pattern;
    }
    if (dto.name !== undefined) seq.name = dto.name;
    if (dto.prefix !== undefined) seq.prefix = dto.prefix;
    if (dto.padding !== undefined) seq.padding = dto.padding;
    if (dto.resetPolicy !== undefined) {
      seq.resetPolicy = dto.resetPolicy;
      seq.periodKey = computePeriodKey(dto.resetPolicy, new Date());
    }
    if (dto.active !== undefined) seq.active = dto.active;
    if (dto.description !== undefined) seq.description = dto.description;
    if (dto.nextValue !== undefined) {
      if (dto.nextValue < seq.nextValue) {
        // Guard against reuse/collision: never silently move a counter backwards.
        throw new BadRequestException(
          `El siguiente valor (${dto.nextValue}) no puede ser menor al actual (${seq.nextValue}); reutilizaría folios ya emitidos.`,
        );
      }
      seq.nextValue = dto.nextValue;
    }

    const saved = await this.repo.save(seq);
    await this.recordLedger('DOCUMENT_SEQUENCE_UPDATED', saved, {
      before,
      after: saved,
    });
    return saved;
  }

  async kpis(): Promise<NumberingKpis> {
    const seqs = await this.list();
    const totalIssued = seqs.reduce((a, s) => a + Number(s.totalIssued ?? 0), 0);
    const issuedThisPeriod = seqs.reduce(
      (a, s) => a + Math.max(0, Number(s.nextValue ?? 1) - 1),
      0,
    );
    const mostActive = seqs
      .slice()
      .sort((a, b) => Number(b.totalIssued ?? 0) - Number(a.totalIssued ?? 0))[0];
    return {
      totalTypes: seqs.length,
      activeTypes: seqs.filter((s) => s.active).length,
      totalIssued,
      issuedThisPeriod,
      mostActive:
        mostActive && Number(mostActive.totalIssued ?? 0) > 0
          ? {
              docType: mostActive.docType,
              name: mostActive.name,
              totalIssued: Number(mostActive.totalIssued),
            }
          : null,
    };
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private assertPattern(pattern: string): void {
    const res = validatePattern(pattern);
    if (!res.valid) throw new BadRequestException(res.error);
  }

  private async recordLedger(
    action: string,
    seq: DocumentSequence,
    states: { before?: unknown; after?: unknown },
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.SYSTEM,
        action,
        referenceType: 'DOCUMENT_SEQUENCE',
        referenceId: seq.id,
        plant: seq.plant_id ?? undefined,
        metadata: {
          docType: seq.docType,
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
