import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Certification } from './entities/certification.entity';
import { SkillCatalog } from './entities/skill-catalog.entity';
import { HrEmployee } from '../hr/entities/hr-employee.entity';
import { isOwnerEmail } from '../auth/rbac';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import {
  CreateCertificationDto,
  CreateSkillDto,
  UpdateCertificationDto,
  UpdateSkillDto,
} from './dto/people.dto';
import { certStatus, CertStatus, daysToExpiry } from './cert-status';

export type SerializedCertification = Certification & {
  status: CertStatus;
  daysToExpiry: number | null;
};

export interface PeopleKpis {
  total: number;
  valid: number;
  expiring30: number;
  expiring60: number;
  expiring90: number;
  expired: number;
  employees: number;
  skills: number;
  coverage: { skill: string; count: number }[];
}

/** Lowercased gate status for the operator↔station certification check. */
export type GateStatus = 'valid' | 'expiring' | 'expired' | 'none';

/** Read-only verdict consumed by the operator↔station warning gate. */
export interface CertificationCheck {
  certified: boolean;
  status: GateStatus;
  expiresDate: string | null;
  daysToExpiry: number | null;
  matchedCertId: string | null;
  employeeName: string | null;
  skill: string | null;
  station: string | null;
}

/** Trim + collapse internal whitespace; preserves case for display. */
function normText(v?: string | null): string {
  return (v ?? '').trim().replace(/\s+/g, ' ');
}

/** Case-insensitive comparison key (for matching skills/stations/names). */
function matchKey(v?: string | null): string {
  return normText(v).toUpperCase();
}

@Injectable()
export class PeopleService {
  private readonly logger = new Logger(PeopleService.name);

  constructor(
    @InjectRepository(Certification)
    private readonly repo: Repository<Certification>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    @Optional()
    @InjectRepository(SkillCatalog)
    private readonly skillRepo?: Repository<SkillCatalog>,
    @Optional() private readonly ledger?: EventLedgerService,
    @Optional()
    @InjectRepository(HrEmployee)
    private readonly hrRepo?: Repository<HrEmployee>,
  ) {}

  private applyScope(
    qb: SelectQueryBuilder<Certification>,
    alias: string,
  ): SelectQueryBuilder<Certification> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  /** ¿El solicitante ve todas las áreas? Admin / dirección / owner. */
  private seesAllAreas(): boolean {
    const role = (this.tenantCtx.getRole() || '').toLowerCase();
    return (
      role === 'admin' ||
      role === 'executive' ||
      isOwnerEmail(this.tenantCtx.getUserEmail())
    );
  }

  /** Área del solicitante, resuelta desde hr_employees por su email. */
  private async requesterArea(): Promise<string | null> {
    if (!this.hrRepo) return null;
    const email = this.tenantCtx.getUserEmail();
    if (!email || email === 'anonymous') return null;
    const emp = await this.hrRepo.findOne({ where: { email } });
    return emp?.area ?? null;
  }

  /**
   * Scope DURO por área por rol — additivo y OFF por defecto. Con
   * ENFORCE_AREA_SCOPE=true, un no-admin queda restringido a las certs de SU área
   * (resuelta por email vía hr_employees). Fail-open si no se resuelve el área —
   * nunca deja a nadie sin datos por un email que no cuadra. Resuelve el follow-up
   * sin requerir un claim de área en el JWT. El owner lo enciende cuando su mapeo
   * rol↔área lo soporta.
   */
  private async applyAreaScope(
    qb: SelectQueryBuilder<Certification>,
    alias: string,
  ): Promise<void> {
    if (process.env.ENFORCE_AREA_SCOPE !== 'true') return;
    if (this.seesAllAreas()) return;
    const area = await this.requesterArea();
    if (area) {
      qb.andWhere(`LOWER(${alias}.area) = LOWER(:reqArea)`, { reqArea: area });
    }
  }

  private serialize(c: Certification): SerializedCertification {
    return {
      ...c,
      status: c.active ? certStatus(c.expiresDate) : 'EXPIRED',
      daysToExpiry: daysToExpiry(c.expiresDate),
    };
  }

  async create(dto: CreateCertificationDto): Promise<SerializedCertification> {
    let folio: string | null = null;
    try {
      folio = await this.numbering.allocate('CERTIFICATION');
    } catch (err) {
      this.logger.warn(`Folio allocation failed: ${(err as Error)?.message}`);
    }

    const entity = this.repo.create({
      folio,
      // Additive: liga a empleado real cuando el alta lo provee; se conserva el
      // nombre denormalizado para compatibilidad con certificaciones viejas.
      employeeId: dto.employeeId?.trim() || null,
      employeeName: normText(dto.employeeName),
      employeeEmail: dto.employeeEmail?.trim() || null,
      // Sin catálogo de skills aún: normalizamos texto (trim + colapsa espacios)
      // para que la matriz agrupe consistentemente. Catálogo = follow-up.
      skill: normText(dto.skill),
      area: dto.area ? normText(dto.area) : null,
      station: dto.station ? normText(dto.station) : null,
      certifiedBy: dto.certifiedBy ?? this.tenantCtx.getUserEmail(),
      active: true,
      issuedDate: dto.issuedDate ? new Date(dto.issuedDate) : new Date(),
      expiresDate: dto.expiresDate ? new Date(dto.expiresDate) : null,
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    const saved = await this.repo.save(entity);
    if (this.ledger) {
      try {
        await this.ledger.recordEvent({
          actorName: this.tenantCtx.getUserEmail(),
          domain: EventDomain.SYSTEM,
          action: 'CERTIFICATION_CREATED',
          referenceType: 'CERTIFICATION',
          referenceId: saved.id,
          plant: saved.plant_id ?? undefined,
          metadata: { employee: saved.employeeName, skill: saved.skill },
        });
      } catch (err) {
        this.logger.warn(`Ledger write skipped: ${(err as Error)?.message}`);
      }
    }
    return this.serialize(saved);
  }

  async list(filters: {
    skill?: string;
    employeeName?: string;
    area?: string;
  } = {}): Promise<SerializedCertification[]> {
    const qb = this.repo
      .createQueryBuilder('c')
      .orderBy('c.expires_date', 'ASC');
    this.applyScope(qb, 'c');
    await this.applyAreaScope(qb, 'c');
    if (filters.skill) qb.andWhere('c.skill = :s', { s: filters.skill });
    if (filters.employeeName)
      qb.andWhere('c.employee_name = :e', { e: filters.employeeName });
    if (filters.area) qb.andWhere('c.area = :a', { a: filters.area });
    const rows = await qb.getMany();
    return rows.map((c) => this.serialize(c));
  }

  async getOne(id: string): Promise<SerializedCertification> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Certificación no encontrada.');
    return this.serialize(found);
  }

  async update(
    id: string,
    dto: UpdateCertificationDto,
  ): Promise<SerializedCertification> {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Certificación no encontrada.');
    Object.assign(c, {
      ...(dto.employeeId !== undefined && { employeeId: dto.employeeId?.trim() || null }),
      ...(dto.employeeName !== undefined && { employeeName: normText(dto.employeeName) }),
      ...(dto.employeeEmail !== undefined && { employeeEmail: dto.employeeEmail?.trim() || null }),
      ...(dto.skill !== undefined && { skill: normText(dto.skill) }),
      ...(dto.area !== undefined && { area: dto.area ? normText(dto.area) : null }),
      ...(dto.station !== undefined && { station: dto.station ? normText(dto.station) : null }),
      ...(dto.certifiedBy !== undefined && { certifiedBy: dto.certifiedBy }),
      ...(dto.active !== undefined && { active: dto.active }),
      ...(dto.issuedDate !== undefined && {
        issuedDate: dto.issuedDate ? new Date(dto.issuedDate) : null,
      }),
      ...(dto.expiresDate !== undefined && {
        expiresDate: dto.expiresDate ? new Date(dto.expiresDate) : null,
      }),
    });
    const saved = await this.repo.save(c);
    return this.serialize(saved);
  }

  async kpis(): Promise<PeopleKpis> {
    const all = await this.list();
    let valid = 0;
    let expiring30 = 0;
    let expiring60 = 0;
    let expiring90 = 0;
    let expired = 0;
    const employees = new Set<string>();
    const skillCounts = new Map<string, number>();

    for (const c of all) {
      employees.add(c.employeeName);
      skillCounts.set(c.skill, (skillCounts.get(c.skill) ?? 0) + 1);

      if (c.status === 'EXPIRED') {
        expired += 1;
        continue;
      }
      // Not expired (VALID / EXPIRING / NO_EXPIRY) counts as currently valid.
      valid += 1;
      const d = c.daysToExpiry;
      if (d !== null) {
        if (d <= 30) expiring30 += 1;
        else if (d <= 60) expiring60 += 1;
        else if (d <= 90) expiring90 += 1;
      }
    }

    const coverage = [...skillCounts.entries()]
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    return {
      total: all.length,
      valid,
      expiring30,
      expiring60,
      expiring90,
      expired,
      employees: employees.size,
      skills: skillCounts.size,
      coverage,
    };
  }

  /**
   * Gate operador↔estación — MODO ADVERTENCIA (read-only, NO bloquea).
   *
   * Responde si un operador (por `employeeId` o por nombre, para datos viejos)
   * tiene certificación vigente para una estación. La Uic del MES / muro del
   * operador / Skills consume este verdicto y pinta la advertencia; la lógica
   * de asignación del MES NO se toca: sigue permitiendo asignar.
   *
   * PREPARADO (pero NO activado) el modo bloqueo duro: para endurecerlo a futuro,
   * el flujo de creación de asignaciones podría llamar este check y rechazar
   * cuando `!certified`, gobernado por un flag de config, p.ej.:
   *
   *   // const ENFORCE_CERT_GATE = process.env.ENFORCE_CERT_GATE === 'true';
   *   // if (ENFORCE_CERT_GATE && !check.certified) {
   *   //   throw new ForbiddenException('Operador no certificado para la estación');
   *   // }
   *
   * Se deja como TODO del owner — NO se activa en este PR (additivo y seguro).
   */
  async certificationCheck(params: {
    employeeId?: string;
    employee?: string;
    station?: string;
  }): Promise<CertificationCheck> {
    const empId = (params.employeeId ?? '').trim();
    const empNameKey = matchKey(params.employee);
    const stationKey = matchKey(params.station);

    const none: CertificationCheck = {
      certified: false,
      status: 'none',
      expiresDate: null,
      daysToExpiry: null,
      matchedCertId: null,
      employeeName: normText(params.employee) || null,
      skill: null,
      station: normText(params.station) || null,
    };

    // Necesitamos identificar al operador y la estación para evaluar el gate.
    if ((!empId && !empNameKey) || !stationKey) return none;

    const all = await this.list();
    const matches = all.filter((c) => {
      if (matchKey(c.station) !== stationKey) return false;
      const idOk = !!empId && !!c.employeeId && c.employeeId === empId;
      const nameOk = !!empNameKey && matchKey(c.employeeName) === empNameKey;
      return idOk || nameOk;
    });
    if (matches.length === 0) return none;

    // Mejor candidato por bucket: vigente (incl. sin vencimiento) > por vencer >
    // vencido. Dentro del bucket, el de mayor margen (días a vencer).
    const rank = (s: CertStatus): number =>
      s === 'VALID' || s === 'NO_EXPIRY' ? 3 : s === 'EXPIRING' ? 2 : 1;
    const best = matches.reduce((a, b) => {
      const ra = rank(a.status);
      const rb = rank(b.status);
      if (rb !== ra) return rb > ra ? b : a;
      const da = a.daysToExpiry ?? Number.POSITIVE_INFINITY;
      const db = b.daysToExpiry ?? Number.POSITIVE_INFINITY;
      return db > da ? b : a;
    });

    const status: GateStatus =
      best.status === 'VALID' || best.status === 'NO_EXPIRY'
        ? 'valid'
        : best.status === 'EXPIRING'
          ? 'expiring'
          : 'expired';

    return {
      // Por vencer sigue contando como certificado (sólo advierte recertificar).
      certified: status === 'valid' || status === 'expiring',
      status,
      expiresDate: best.expiresDate
        ? new Date(best.expiresDate).toISOString().slice(0, 10)
        : null,
      daysToExpiry: best.daysToExpiry,
      matchedCertId: best.id,
      employeeName: best.employeeName,
      skill: best.skill,
      station: best.station,
    };
  }

  // ── Skill catalog (vocabulario curado de skills) ───────────────────────────
  private scopeSkills(
    qb: SelectQueryBuilder<SkillCatalog>,
    alias: string,
  ): SelectQueryBuilder<SkillCatalog> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  async listSkills(includeInactive = false): Promise<SkillCatalog[]> {
    if (!this.skillRepo) return [];
    const qb = this.skillRepo.createQueryBuilder('s');
    this.scopeSkills(qb, 's');
    if (!includeInactive) qb.andWhere('s.active = :a', { a: true });
    qb.orderBy('s.name', 'ASC');
    return qb.getMany();
  }

  async createSkill(dto: CreateSkillDto): Promise<SkillCatalog> {
    if (!this.skillRepo) throw new NotFoundException('Catálogo no disponible.');
    const name = normText(dto.name);
    // Dedupe case-insensitive within scope — reusa en vez de duplicar.
    const existing = (await this.listSkills(true)).find(
      (s) => matchKey(s.name) === matchKey(name),
    );
    if (existing) {
      if (!existing.active) {
        existing.active = true;
        return this.skillRepo.save(existing);
      }
      return existing;
    }
    const entity = this.skillRepo.create({
      name,
      category: dto.category ? normText(dto.category) : null,
      area: dto.area ? normText(dto.area) : null,
      defaultValidityMonths: dto.defaultValidityMonths ?? null,
      description: dto.description?.trim() || null,
      active: true,
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    return this.skillRepo.save(entity);
  }

  async updateSkill(id: string, dto: UpdateSkillDto): Promise<SkillCatalog> {
    if (!this.skillRepo) throw new NotFoundException('Catálogo no disponible.');
    const s = await this.skillRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Skill no encontrado.');
    Object.assign(s, {
      ...(dto.name !== undefined && { name: normText(dto.name) }),
      ...(dto.category !== undefined && {
        category: dto.category ? normText(dto.category) : null,
      }),
      ...(dto.area !== undefined && { area: dto.area ? normText(dto.area) : null }),
      ...(dto.defaultValidityMonths !== undefined && {
        defaultValidityMonths: dto.defaultValidityMonths,
      }),
      ...(dto.description !== undefined && {
        description: dto.description?.trim() || null,
      }),
      ...(dto.active !== undefined && { active: dto.active }),
    });
    return this.skillRepo.save(s);
  }
}
