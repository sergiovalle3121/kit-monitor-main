import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { SfGenealogyLink } from './entities/sf-genealogy-link.entity';
import { SfGenealogyShipment } from './entities/sf-genealogy-shipment.entity';
import { SfConsumptionEvent } from '../operator-terminal/entities/sf-consumption-event.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { LinkShipmentDto, RecordLinkDto } from './dto/genealogy.dto';
import {
  aggregateWhereUsed,
  AsBuiltTree,
  buildAsBuiltTree,
  GenealogyLink,
  ShipmentLinkRow,
  WhereUsedResult,
} from './genealogy.derivation';

export interface GenealogyKpis {
  indexedLinks: number;
  serialsCovered: number;
  lotsTracked: number;
  reelsTracked: number;
  shipmentLinks: number;
  linksMissingLot: number;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

@Injectable()
export class GenealogyService {
  private readonly logger = new Logger(GenealogyService.name);

  constructor(
    @Inject(getTenantRepositoryToken(SfGenealogyLink))
    private readonly links: TenantScopedRepository<SfGenealogyLink>,
    @Inject(getTenantRepositoryToken(SfGenealogyShipment))
    private readonly shipments: TenantScopedRepository<SfGenealogyShipment>,
    @InjectRepository(SfConsumptionEvent)
    private readonly consumption: Repository<SfConsumptionEvent>,
    private readonly tenantCtx: TenantContextService,
    @Optional() private readonly ledger?: EventLedgerService,
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

  private scopeFields() {
    return {
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    };
  }

  // ── Collect normalized links (index + live consumption ledger) ───────────────
  /**
   * The single derivation path. UNIONs the additive `sf_genealogy_index` (which
   * carries lot/reel) with the live shop-floor consumption ledger (which does
   * not). An index row that enriches a specific consumption event supersedes the
   * live one (matched by `sourceEventId` + part) so nothing is double-counted. A
   * lot/reel filter excludes the live ledger entirely — honest, because the floor
   * terminal does not capture lot/reel yet.
   */
  private async collectLinks(filter: {
    serial?: string;
    lot?: string;
    reel?: string;
    part?: string;
  }): Promise<GenealogyLink[]> {
    const idxQb = this.links.createQueryBuilder('g');
    this.applyScope(idxQb, 'g');
    if (filter.serial) idxQb.andWhere('g.built_serial = :s', { s: filter.serial });
    if (filter.part) idxQb.andWhere('g.part = :p', { p: filter.part });
    if (filter.lot) idxQb.andWhere('g.lot = :lot', { lot: filter.lot });
    if (filter.reel) idxQb.andWhere('g.reel = :reel', { reel: filter.reel });
    const idxRows = await idxQb.getMany();

    const indexLinks: GenealogyLink[] = idxRows.map((r) => ({
      builtSerial: r.builtSerial,
      part: r.part,
      lot: r.lot,
      reel: r.reel,
      qty: Number(r.qty) || 0,
      woId: r.woId,
      woFolio: r.woFolio,
      model: r.model,
      station: r.station,
      operator: r.operatorEmail,
      consumedAt: toIso(r.consumedAt ?? r.created_at),
      source: r.source,
      sourceEventId: r.sourceEventId,
    }));

    const superseded = new Set(
      idxRows
        .filter((r) => r.sourceEventId)
        .map((r) => `${r.sourceEventId}::${r.part}`),
    );

    let liveLinks: GenealogyLink[] = [];
    if (!filter.lot && !filter.reel) {
      const cQb = this.consumption.createQueryBuilder('e');
      const tenant = this.tenantCtx.getTenantId();
      if (tenant) cQb.where('e.tenant_id = :t', { t: tenant });
      if (filter.serial) cQb.andWhere('e.unit_serial = :s', { s: filter.serial });
      if (filter.part) cQb.andWhere('e.part = :p', { p: filter.part });
      cQb.andWhere('e.unit_serial IS NOT NULL').andWhere('e.part IS NOT NULL');
      const events = await cQb.getMany();
      liveLinks = events
        .filter((e) => !superseded.has(`${e.id}::${e.part ?? ''}`))
        .map((e) => ({
          builtSerial: e.unitSerial as string,
          part: e.part as string,
          lot: null,
          reel: null,
          qty: Number(e.backflushQty) || 0,
          woId: e.woId,
          woFolio: e.woFolio,
          model: e.model,
          station: e.station,
          operator: e.operatorEmail,
          consumedAt: toIso(e.created_at),
          source: 'SF_CONSUMPTION',
          sourceEventId: e.id,
        }));
    }

    return [...indexLinks, ...liveLinks];
  }

  // ── AS-BUILT by serial (the inverse of where-used) ──────────────────────────
  /**
   * Cradle-to-grave for one serial: the tree of which lot/reel of each NP was
   * consumed, with operator / station / timestamp. Derived live from the
   * consumption ledger, enriched by the additive index.
   */
  async asBuiltBySerial(serial: string): Promise<AsBuiltTree> {
    const s = (serial ?? '').trim();
    if (!s) throw new BadRequestException('serial requerido.');
    const links = await this.collectLinks({ serial: s });
    return buildAsBuiltTree(s, links);
  }

  // ── WHERE-USED inverse of containment (the recall query) ────────────────────
  /**
   * Given a defective lot/reel → the serials that consumed it and the shipments
   * (and customers) that contain them. The query that scopes a recall.
   */
  async whereUsedByLot(q: {
    lot?: string;
    reel?: string;
    part?: string;
  }): Promise<WhereUsedResult> {
    const lot = q.lot?.trim() || null;
    const reel = q.reel?.trim() || null;
    const part = q.part?.trim() || null;
    if (!lot && !reel) {
      throw new BadRequestException('Indica al menos un lote o reel defectuoso.');
    }
    const links = await this.collectLinks({
      lot: lot ?? undefined,
      reel: reel ?? undefined,
      part: part ?? undefined,
    });
    const serials = Array.from(new Set(links.map((l) => l.builtSerial)));
    const shipmentLinks = await this.shipmentsForSerials(serials);
    return aggregateWhereUsed({ lot, reel, part }, links, shipmentLinks);
  }

  private async shipmentsForSerials(serials: string[]): Promise<ShipmentLinkRow[]> {
    if (serials.length === 0) return [];
    const qb = this.shipments.createQueryBuilder('s');
    this.applyScope(qb, 's');
    qb.andWhere('s.built_serial IN (:...serials)', { serials });
    const rows = await qb.getMany();
    return rows.map((r) => ({
      builtSerial: r.builtSerial,
      shipmentId: r.shipmentId,
      shipmentFolio: r.shipmentFolio,
      asn: r.asn,
      customerName: r.customerName,
      destination: r.destination,
      shippedAt: toIso(r.shippedAt),
    }));
  }

  // ── Forward capture hooks (additive; never touch source tables) ─────────────
  async recordLink(dto: RecordLinkDto): Promise<SfGenealogyLink> {
    const key =
      (dto.idempotencyKey && dto.idempotencyKey.trim()) ||
      `${dto.builtSerial}::${dto.part}::${dto.lot ?? ''}::${dto.reel ?? ''}::${dto.sourceEventId ?? ''}`;
    const existing = await this.links.findOne({ where: { idempotencyKey: key } });
    if (existing) return existing;
    const link = this.links.create({
      idempotencyKey: key,
      builtSerial: dto.builtSerial.trim(),
      parentSerial: dto.parentSerial?.trim() || null,
      part: dto.part.trim(),
      lot: dto.lot?.trim() || null,
      reel: dto.reel?.trim() || null,
      qty: dto.qty ?? 1,
      woId: dto.woId ?? null,
      woFolio: dto.woFolio ?? null,
      model: dto.model ?? null,
      station: dto.station ?? null,
      operatorEmail: dto.operatorEmail ?? this.tenantCtx.getUserEmail(),
      consumedAt: dto.consumedAt ? new Date(dto.consumedAt) : new Date(),
      source: dto.sourceEventId ? 'OPERATOR_TERMINAL' : 'MANUAL',
      sourceEventId: dto.sourceEventId ?? null,
      programId: dto.programId ?? null,
      ...this.scopeFields(),
    });
    let saved: SfGenealogyLink;
    try {
      saved = await this.links.save(link);
    } catch (err) {
      // Lost a race on the unique idempotency key — return the winner.
      const w = await this.links.findOne({ where: { idempotencyKey: key } });
      if (w) return w;
      throw err;
    }
    await this.record('SF_GENEALOGY_LINK_RECORDED', EventDomain.PRODUCTION, saved.id, {
      serial: saved.builtSerial,
      part: saved.part,
      lot: saved.lot,
      reel: saved.reel,
    });
    return saved;
  }

  async linkShipment(dto: LinkShipmentDto): Promise<SfGenealogyShipment> {
    const key =
      (dto.idempotencyKey && dto.idempotencyKey.trim()) ||
      `${dto.builtSerial}::${dto.shipmentId ?? dto.shipmentFolio ?? ''}`;
    const existing = await this.shipments.findOne({ where: { idempotencyKey: key } });
    if (existing) return existing;
    const row = this.shipments.create({
      idempotencyKey: key,
      builtSerial: dto.builtSerial.trim(),
      shipmentId: dto.shipmentId ?? null,
      shipmentFolio: dto.shipmentFolio ?? null,
      asn: dto.asn ?? null,
      customerName: dto.customerName ?? null,
      destination: dto.destination ?? null,
      shippedAt: dto.shippedAt ? new Date(dto.shippedAt) : new Date(),
      programId: dto.programId ?? null,
      ...this.scopeFields(),
    });
    let saved: SfGenealogyShipment;
    try {
      saved = await this.shipments.save(row);
    } catch (err) {
      const w = await this.shipments.findOne({ where: { idempotencyKey: key } });
      if (w) return w;
      throw err;
    }
    await this.record('SF_GENEALOGY_SHIPMENT_LINKED', EventDomain.SHIPPING, saved.id, {
      serial: saved.builtSerial,
      shipment: saved.shipmentFolio ?? saved.shipmentId,
      customer: saved.customerName,
    });
    return saved;
  }

  // ── Inspection / coverage ────────────────────────────────────────────────────
  async listLinks(filter: { serial?: string; part?: string; lot?: string } = {}): Promise<SfGenealogyLink[]> {
    const qb = this.links.createQueryBuilder('g');
    this.applyScope(qb, 'g');
    if (filter.serial) qb.andWhere('g.built_serial = :s', { s: filter.serial });
    if (filter.part) qb.andWhere('g.part = :p', { p: filter.part });
    if (filter.lot) qb.andWhere('g.lot = :lot', { lot: filter.lot });
    return qb.orderBy('g.created_at', 'DESC').getMany();
  }

  async kpis(): Promise<GenealogyKpis> {
    const idxQb = this.links.createQueryBuilder('g');
    this.applyScope(idxQb, 'g');
    const links = await idxQb.getMany();
    const shipQb = this.shipments.createQueryBuilder('s');
    this.applyScope(shipQb, 's');
    const shipmentLinks = await shipQb.getCount();
    return {
      indexedLinks: links.length,
      serialsCovered: new Set(links.map((l) => l.builtSerial)).size,
      lotsTracked: new Set(links.map((l) => l.lot).filter(Boolean)).size,
      reelsTracked: new Set(links.map((l) => l.reel).filter(Boolean)).size,
      shipmentLinks,
      linksMissingLot: links.filter((l) => !l.lot).length,
    };
  }

  private async record(
    action: string,
    domain: EventDomain,
    referenceId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain,
        action,
        referenceType: 'SF_GENEALOGY',
        referenceId,
        plant: this.tenantCtx.getPlantId() ?? undefined,
        metadata,
      });
    } catch (err) {
      this.logger.warn(`Ledger skipped for ${action}: ${(err as Error)?.message}`);
    }
  }
}
