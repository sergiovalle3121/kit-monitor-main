import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { SCAR, ScarStatus } from './entities/scar.entity';
import { SupplierCertification } from './entities/supplier-certification.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';

const DAY_MS = 86_400_000;
const CERT_EXPIRING_DAYS = 90;

/**
 * Supplier watch-dog: turns the things an SQE must not miss — a certification
 * lapsing, a SCAR sitting open past its due date, a single-source supplier
 * sliding into the red — into inbox notifications for the supplier's owner
 * (SQE / buyer via `ownerEmail`). Dedupe is one alert per entity per day.
 *
 * Best-effort and read-only against quality/procurement: it only reads supplier,
 * SCAR and certification records and writes to the notification inbox.
 */
@Injectable()
export class SuppliersAlertsService {
  constructor(
    @InjectRepository(Supplier) private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(SCAR) private readonly scarRepo: Repository<SCAR>,
    @InjectRepository(SupplierCertification) private readonly certRepo: Repository<SupplierCertification>,
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
  ) {}

  private certStatus(expiresAt?: Date | null): string {
    if (!expiresAt) return 'VALID';
    const days = (new Date(expiresAt).getTime() - Date.now()) / DAY_MS;
    if (days < 0) return 'EXPIRED';
    if (days <= CERT_EXPIRING_DAYS) return 'EXPIRING';
    return 'VALID';
  }

  /** Resolve the supplier owner's user id from their email (null if unknown). */
  private async ownerUserId(ownerEmail?: string | null): Promise<string | null> {
    if (!ownerEmail) return null;
    const user = await this.users.findOneByEmail(ownerEmail).catch(() => null);
    return user?.id ?? null;
  }

  async scanAndNotify(): Promise<{ scanned: number; notified: number }> {
    const suppliers = await this.supplierRepo.find();
    const byId = new Map(suppliers.map((s) => [s.id, s]));
    const day = new Date().toISOString().slice(0, 10);
    let notified = 0;

    const ownerCache = new Map<number, string | null>();
    const owner = async (s: Supplier): Promise<string | null> => {
      if (!ownerCache.has(s.id)) ownerCache.set(s.id, await this.ownerUserId(s.ownerEmail));
      return ownerCache.get(s.id) ?? null;
    };

    // 1) Certifications expiring / expired.
    const certs = await this.certRepo.find();
    for (const c of certs) {
      const st = c.status === 'REVOKED' ? 'REVOKED' : this.certStatus(c.expiresAt);
      if (st !== 'EXPIRING' && st !== 'EXPIRED') continue;
      const s = byId.get(c.supplierId);
      if (!s) continue;
      const userId = await owner(s);
      if (!userId) continue;
      const expired = st === 'EXPIRED';
      await this.notifications.create({
        userId,
        kind: 'supplier',
        severity: expired ? 'high' : 'medium',
        domain: 'suppliers',
        source: 'suppliers:cert',
        title: `${expired ? 'Certificación vencida' : 'Certificación por vencer'} · ${s.name}`,
        body: `${c.standard}${c.certNumber ? ` (${c.certNumber})` : ''} ${expired ? 'venció' : 'vence'} el ${c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('es-MX') : 's/f'}.`,
        href: `/dashboard/suppliers/${s.id}`,
        dedupeKey: `supplier-cert:${c.id}:${day}`,
      });
      notified += 1;
    }

    // 2) SCARs open past their due date.
    const openScars = await this.scarRepo.createQueryBuilder('scar')
      .leftJoinAndSelect('scar.supplier', 'supplier')
      .where('scar.status != :c', { c: ScarStatus.CLOSED })
      .andWhere('scar.dueDate IS NOT NULL')
      .getMany();
    const now = Date.now();
    for (const scar of openScars) {
      if (!scar.dueDate || new Date(scar.dueDate).getTime() >= now) continue;
      const s = scar.supplier ? byId.get(scar.supplier.id) : undefined;
      if (!s) continue;
      const userId = await owner(s);
      if (!userId) continue;
      const daysLate = Math.floor((now - new Date(scar.dueDate).getTime()) / DAY_MS);
      await this.notifications.create({
        userId,
        kind: 'supplier',
        severity: scar.severity === 'critical' ? 'critical' : 'high',
        domain: 'suppliers',
        source: 'suppliers:scar',
        title: `SCAR vencida · ${scar.scarNumber}`,
        body: `${s.name} — parte ${scar.partNumber}. ${daysLate} día(s) sin respuesta cerrada.`,
        href: `/dashboard/suppliers/${s.id}`,
        dedupeKey: `supplier-scar-overdue:${scar.id}:${day}`,
      });
      notified += 1;
    }

    // 3) Single-source suppliers sliding into the red.
    for (const s of suppliers) {
      if (!s.singleSource) continue;
      const red = s.riskLevel === 'HIGH' || (s.otdPct != null && s.otdPct < 85);
      if (!red) continue;
      const userId = await owner(s);
      if (!userId) continue;
      await this.notifications.create({
        userId,
        kind: 'supplier',
        severity: 'high',
        domain: 'suppliers',
        source: 'suppliers:risk',
        title: `Sole-source en riesgo · ${s.name}`,
        body: `Proveedor de fuente única con desempeño en rojo (riesgo ${s.riskLevel}${s.otdPct != null ? `, OTD ${s.otdPct}%` : ''}). Evalúa contingencia / segunda fuente.`,
        href: `/dashboard/suppliers/${s.id}`,
        dedupeKey: `supplier-risk:${s.id}:${day}`,
      });
      notified += 1;
    }

    return { scanned: suppliers.length, notified };
  }
}
