import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { MaterialMasterService } from '../material-master/material-master.service';
import { MmMaterial } from '../material-master/entities/mm-material.entity';
import { BomTreeService } from '../bom-tree/bom-tree.service';
import { RoutingService } from '../routing/routing.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import {
  EXTERNAL_FEED_ADAPTER,
  type ExternalFeedAdapter,
} from './external-feed.token';
import {
  FIELD_SPECS,
  FieldSpec,
  ImportTarget,
  PreviewSummary,
  suggestMapping,
  validateRows,
  ValidatedRow,
} from './import-logic';
import { CommitImportDto, PreviewImportDto } from './dto/import.dto';

export interface ImportPreview {
  target: ImportTarget;
  source: string;
  fields: FieldSpec[];
  mapping: Record<string, string>;
  summary: PreviewSummary;
  rows: ValidatedRow[];
}

export interface ImportReport {
  target: ImportTarget;
  source: string;
  summary: PreviewSummary;
  result: {
    created: number;
    updated: number;
    skipped: number;
    rowErrors: Array<{ rowIndex: number; message: string }>;
  };
}

@Injectable()
export class ImportDataService {
  private readonly logger = new Logger(ImportDataService.name);

  constructor(
    private readonly materials: MaterialMasterService,
    private readonly bom: BomTreeService,
    private readonly routing: RoutingService,
    private readonly tenantCtx: TenantContextService,
    @Inject(EXTERNAL_FEED_ADAPTER) private readonly feed: ExternalFeedAdapter,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  fields(target: ImportTarget) {
    return FIELD_SPECS[target];
  }

  suggest(target: ImportTarget, headers: string[]) {
    return suggestMapping(target, headers ?? []);
  }

  private async resolveRows(dto: PreviewImportDto): Promise<Record<string, any>[]> {
    if (dto.source === 'IDOC_API') {
      return this.feed.fetchRows(dto.target, dto.feedConfig);
    }
    return Array.isArray(dto.rows) ? dto.rows : [];
  }

  async preview(dto: PreviewImportDto): Promise<ImportPreview> {
    const rows = await this.resolveRows(dto);
    const { rows: validated, summary } = validateRows(dto.target, rows, dto.mapping);
    return {
      target: dto.target,
      source: dto.source,
      fields: FIELD_SPECS[dto.target],
      mapping: dto.mapping,
      summary,
      rows: validated.slice(0, 1000),
    };
  }

  async commit(dto: CommitImportDto): Promise<ImportReport> {
    const rows = await this.resolveRows(dto);
    const { rows: validated, summary } = validateRows(dto.target, rows, dto.mapping);

    const rowErrors: Array<{ rowIndex: number; message: string }> = [];
    for (const v of validated) {
      if (!v.valid) {
        rowErrors.push({
          rowIndex: v.rowIndex,
          message: v.errors.map((e) => e.message).join(' '),
        });
      }
    }
    const valid = validated.filter((v) => v.valid);

    let result: ImportReport['result'];
    if (dto.target === 'MATERIAL') {
      result = await this.commitMaterials(valid, rowErrors);
    } else if (dto.target === 'BOM') {
      result = await this.commitBom(valid, !!dto.createMissingMaterials, rowErrors);
    } else {
      result = await this.commitRouting(valid, !!dto.createMissingMaterials, rowErrors);
    }

    await this.recordLedger(dto.target, dto.source, summary, result);
    return { target: dto.target, source: dto.source, summary, result };
  }

  // ── Material ────────────────────────────────────────────────────────────────
  private async commitMaterials(
    rows: ValidatedRow[],
    rowErrors: Array<{ rowIndex: number; message: string }>,
  ): Promise<ImportReport['result']> {
    let created = 0;
    let updated = 0;
    for (const v of rows) {
      const d = v.data;
      try {
        const existing = await this.materials.findByPartNumber(d.partNumber);
        if (existing) {
          await this.materials.update(existing.id, {
            description: d.description,
            itemType: d.itemType,
            category: d.category,
            baseUom: d.baseUom,
            makeBuy: d.makeBuy,
            standardCost: d.standardCost,
            weight: d.weight,
            notes: d.notes,
          });
          updated++;
        } else {
          await this.materials.create({
            partNumber: d.partNumber,
            description: d.description,
            itemType: d.itemType,
            category: d.category,
            baseUom: d.baseUom,
            makeBuy: d.makeBuy,
            standardCost: d.standardCost,
            weight: d.weight,
            notes: d.notes,
          });
          created++;
        }
      } catch (err) {
        rowErrors.push({ rowIndex: v.rowIndex, message: (err as Error).message });
      }
    }
    return { created, updated, skipped: 0, rowErrors };
  }

  // ── Material resolution (shared by BOM/Routing) ──────────────────────────────
  private async resolveMaterial(
    partNumber: string,
    stubType: 'MANUFACTURED' | 'PURCHASED',
    createMissing: boolean,
  ): Promise<MmMaterial | null> {
    const found = await this.materials.findByPartNumber(partNumber);
    if (found) return found;
    if (!createMissing) return null;
    return this.materials.create({
      partNumber,
      description: partNumber,
      itemType: stubType,
    });
  }

  // ── BOM ─────────────────────────────────────────────────────────────────────
  private async commitBom(
    rows: ValidatedRow[],
    createMissing: boolean,
    rowErrors: Array<{ rowIndex: number; message: string }>,
  ): Promise<ImportReport['result']> {
    let created = 0;
    let skipped = 0;
    const cache = new Map<string, { nodeId: string; lineKeys: Set<string> }>();

    for (const v of rows) {
      const d = v.data;
      const rev = d.revision || '1.0';
      try {
        const parent = await this.resolveMaterial(d.parentPartNumber, 'MANUFACTURED', createMissing);
        if (!parent) {
          rowErrors.push({ rowIndex: v.rowIndex, message: `Ensamble ${d.parentPartNumber} no existe en el maestro.` });
          continue;
        }
        const component = await this.resolveMaterial(d.componentPartNumber, 'PURCHASED', createMissing);
        if (!component) {
          rowErrors.push({ rowIndex: v.rowIndex, message: `Componente ${d.componentPartNumber} no existe en el maestro.` });
          continue;
        }

        const ck = `${parent.id}|${rev}`;
        if (!cache.has(ck)) {
          const node = await this.bom.findOrCreateNode(parent.id, rev);
          const detail = await this.bom.getNode(node.id);
          const lineKeys = new Set(detail.lines.map((l) => `${l.findNumber}|${l.materialId}`));
          cache.set(ck, { nodeId: node.id, lineKeys });
        }
        const c = cache.get(ck)!;

        const lineKey = `${d.findNumber ?? ''}|${component.id}`;
        if (d.findNumber && c.lineKeys.has(lineKey)) {
          skipped++;
          continue;
        }
        await this.bom.addLine(c.nodeId, {
          materialId: component.id,
          findNumber: d.findNumber,
          quantity: d.quantity,
          uom: d.uom,
          refDes: d.refDes,
          itemCategory: d.itemCategory,
          scrapPct: d.scrapPct,
          phantom: d.phantom,
        });
        c.lineKeys.add(lineKey);
        created++;
      } catch (err) {
        rowErrors.push({ rowIndex: v.rowIndex, message: (err as Error).message });
      }
    }
    return { created, updated: 0, skipped, rowErrors };
  }

  // ── Routing ─────────────────────────────────────────────────────────────────
  private async commitRouting(
    rows: ValidatedRow[],
    createMissing: boolean,
    rowErrors: Array<{ rowIndex: number; message: string }>,
  ): Promise<ImportReport['result']> {
    let created = 0;
    let skipped = 0;
    const cache = new Map<string, { routingId: string; seqs: Set<number> }>();

    for (const v of rows) {
      const d = v.data;
      const rev = d.revision || '1.0';
      try {
        const asm = await this.resolveMaterial(d.assemblyPartNumber, 'MANUFACTURED', createMissing);
        if (!asm) {
          rowErrors.push({ rowIndex: v.rowIndex, message: `Ensamble ${d.assemblyPartNumber} no existe en el maestro.` });
          continue;
        }
        const ck = `${asm.id}|${rev}`;
        if (!cache.has(ck)) {
          const routing = await this.routing.findOrCreateRouting(asm.id, rev);
          const detail = await this.routing.getRouting(routing.id);
          cache.set(ck, { routingId: routing.id, seqs: new Set(detail.operations.map((o) => o.sequence)) });
        }
        const c = cache.get(ck)!;
        const seq = Math.trunc(d.sequence);
        if (c.seqs.has(seq)) {
          skipped++;
          continue;
        }
        await this.routing.addOperation(c.routingId, {
          name: d.operationName,
          sequence: seq,
          workCenter: d.workCenter,
          setupTimeMin: d.setupTimeMin,
          runTimePerUnitMin: d.runTimePerUnitMin,
          description: d.description,
          visualAidRef: d.visualAidRef,
        });
        c.seqs.add(seq);
        created++;
      } catch (err) {
        rowErrors.push({ rowIndex: v.rowIndex, message: (err as Error).message });
      }
    }
    return { created, updated: 0, skipped, rowErrors };
  }

  private async recordLedger(
    target: string,
    source: string,
    summary: PreviewSummary,
    result: ImportReport['result'],
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.SYSTEM,
        action: 'IMPORT_COMMITTED',
        referenceType: 'IMPORT',
        referenceId: `${target}:${Date.now()}`,
        plant: this.tenantCtx.getPlantId() ?? undefined,
        metadata: {
          target,
          source,
          total: summary.total,
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
          errors: result.rowErrors.length,
        },
      });
    } catch (err) {
      this.logger.warn(`Ledger write skipped for import: ${(err as Error)?.message}`);
    }
  }
}
