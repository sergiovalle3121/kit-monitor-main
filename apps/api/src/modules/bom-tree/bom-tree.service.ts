import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { BomNode } from './entities/bom-node.entity';
import { BomLine } from './entities/bom-line.entity';
import { MmMaterial } from '../material-master/entities/mm-material.entity';
import { MaterialMasterService } from '../material-master/material-master.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import {
  CreateBomLineDto,
  CreateBomNodeDto,
  UpdateBomLineDto,
  UpdateBomNodeDto,
} from './dto/bom.dto';
import { assertTransition, BomNodeStatus } from './bom-state';
import {
  ExplodeLine,
  ExplodeMaterial,
  explodeBom,
  ExplodeResult,
} from './bom-explode';

export interface WhereUsedEntry {
  bomNodeId: string;
  parentMaterialId: string;
  parentPartNumber: string;
  parentDescription: string;
  findNumber: string;
  quantity: number;
  uom: string;
  level: number; // 1 = direct parent, 2 = grandparent, …
}

@Injectable()
export class BomTreeService {
  private readonly logger = new Logger(BomTreeService.name);

  constructor(
    @Inject(getTenantRepositoryToken(BomNode))
    private readonly nodes: TenantScopedRepository<BomNode>,
    @Inject(getTenantRepositoryToken(BomLine))
    private readonly lines: TenantScopedRepository<BomLine>,
    private readonly materials: MaterialMasterService,
    private readonly tenantCtx: TenantContextService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  private applyScope<T extends { tenant_id?: string | null }>(
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
      organization_id: this.tenantCtx.getOrganizationId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    };
  }

  /** Scoped material lookup map (master data scale). */
  private async materialMap(): Promise<Map<string, MmMaterial>> {
    const all = await this.materials.list();
    return new Map(all.map((m) => [m.id, m]));
  }

  private toExplodeMaterial(m: MmMaterial): ExplodeMaterial {
    return {
      id: m.id,
      partNumber: m.partNumber,
      description: m.description,
      itemType: m.itemType,
      makeBuy: m.makeBuy,
      baseUom: m.baseUom,
      standardCost: m.standardCost ?? 0,
    };
  }

  // ── Nodes (BOM headers) ─────────────────────────────────────────────────────

  async listNodes(
    filters: { search?: string; status?: string } = {},
  ): Promise<Array<BomNode & { material?: MmMaterial | null; lineCount: number }>> {
    const qb = this.nodes.createQueryBuilder('n').orderBy('n.created_at', 'DESC');
    this.applyScope(qb, 'n');
    if (filters.status) qb.andWhere('n.status = :s', { s: filters.status });
    const rows = await qb.getMany();
    const mats = await this.materialMap();

    let filtered = rows;
    if (filters.search?.trim()) {
      const q = filters.search.trim().toLowerCase();
      filtered = rows.filter((n) => {
        const m = mats.get(n.materialId);
        return `${m?.partNumber ?? ''} ${m?.description ?? ''}`
          .toLowerCase()
          .includes(q);
      });
    }

    // line counts in one query
    const counts = await this.lineCountsByNode(filtered.map((n) => n.id));
    return filtered.map((n) => ({
      ...n,
      material: mats.get(n.materialId) ?? null,
      lineCount: counts.get(n.id) ?? 0,
    }));
  }

  private async lineCountsByNode(
    nodeIds: string[],
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (!nodeIds.length) return out;
    const qb = this.lines
      .createQueryBuilder('l')
      .select('l.bomNodeId', 'nodeId')
      .addSelect('COUNT(*)', 'cnt')
      .where('l.bomNodeId IN (:...ids)', { ids: nodeIds })
      .groupBy('l.bomNodeId');
    this.applyScope(qb, 'l');
    const raw = await qb.getRawMany<{ nodeId: string; cnt: string }>();
    for (const r of raw) out.set(r.nodeId, Number(r.cnt));
    return out;
  }

  async getNode(id: string): Promise<
    BomNode & {
      material?: MmMaterial | null;
      lines: Array<BomLine & { material?: MmMaterial | null }>;
    }
  > {
    const node = await this.nodes.findOne({ where: { id } });
    if (!node) throw new NotFoundException('BOM no encontrado.');
    const mats = await this.materialMap();
    const lineQb = this.lines
      .createQueryBuilder('l')
      .where('l.bomNodeId = :id', { id })
      .orderBy('l.findNumber', 'ASC')
      .addOrderBy('l.created_at', 'ASC');
    this.applyScope(lineQb, 'l');
    const lines = await lineQb.getMany();
    return {
      ...node,
      material: mats.get(node.materialId) ?? null,
      lines: lines.map((l) => ({ ...l, material: mats.get(l.materialId) ?? null })),
    };
  }

  /** The effective BOM node for a material (ACTIVE preferred, else latest). */
  async findNodeForMaterial(materialId: string): Promise<BomNode | null> {
    const qb = this.nodes
      .createQueryBuilder('n')
      .where('n.materialId = :m', { m: materialId })
      .orderBy("CASE WHEN n.status = 'ACTIVE' THEN 0 ELSE 1 END", 'ASC')
      .addOrderBy('n.updated_at', 'DESC');
    this.applyScope(qb, 'n');
    return qb.getOne();
  }

  /** Get the BOM node for a material+revision, creating it if absent (importers). */
  async findOrCreateNode(materialId: string, revision = '1.0'): Promise<BomNode> {
    const rev = revision?.trim() || '1.0';
    const qb = this.nodes
      .createQueryBuilder('n')
      .where('n.materialId = :m', { m: materialId })
      .andWhere('n.revision = :r', { r: rev });
    this.applyScope(qb, 'n');
    const existing = await qb.getOne();
    if (existing) return existing;
    return this.createNode({ materialId, revision: rev });
  }

  async createNode(dto: CreateBomNodeDto): Promise<BomNode> {
    const material = await this.materials.getOne(dto.materialId); // scope + exists
    const revision = dto.revision?.trim() || '1.0';
    if (await this.nodeExists(dto.materialId, revision)) {
      throw new BadRequestException(
        `Ya existe un BOM para ${material.partNumber} rev ${revision}.`,
      );
    }
    const entity = this.nodes.create({
      materialId: dto.materialId,
      revision,
      status: 'DRAFT' as BomNodeStatus,
      baseQuantity: dto.baseQuantity ?? 1,
      baseUom: dto.baseUom?.trim() || material.baseUom || 'EA',
      notes: dto.notes?.trim() || null,
      metadata: dto.metadata ?? null,
      ...this.scopeFields(),
    });
    const saved = await this.nodes.save(entity);
    await this.recordLedger('BOM_CREATED', saved.id, material.partNumber, {
      after: { materialId: dto.materialId, revision },
    });
    return saved;
  }

  private async nodeExists(materialId: string, revision: string): Promise<boolean> {
    const qb = this.nodes
      .createQueryBuilder('n')
      .where('n.materialId = :m', { m: materialId })
      .andWhere('n.revision = :r', { r: revision });
    this.applyScope(qb, 'n');
    return (await qb.getCount()) > 0;
  }

  async updateNode(id: string, dto: UpdateBomNodeDto): Promise<BomNode> {
    const node = await this.requireNode(id);
    Object.assign(node, {
      ...(dto.revision !== undefined && { revision: dto.revision.trim() || '1.0' }),
      ...(dto.baseQuantity !== undefined && { baseQuantity: dto.baseQuantity }),
      ...(dto.baseUom !== undefined && { baseUom: dto.baseUom.trim() || 'EA' }),
      ...(dto.notes !== undefined && { notes: dto.notes.trim() || null }),
      ...(dto.metadata !== undefined && { metadata: dto.metadata }),
    });
    return this.nodes.save(node);
  }

  async transitionNode(id: string, to: BomNodeStatus): Promise<BomNode> {
    const node = await this.requireNode(id);
    const from = node.status;
    try {
      assertTransition(from, to);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    node.status = to;
    const saved = await this.nodes.save(node);
    await this.recordLedger('BOM_TRANSITIONED', id, undefined, {
      before: { status: from },
      after: { status: to },
    });
    return saved;
  }

  async deleteNode(id: string): Promise<{ ok: true }> {
    const node = await this.requireNode(id);
    const lines = await this.lines.find({ where: { bomNodeId: id } });
    if (lines.length) await this.lines.remove(lines);
    await this.nodes.remove(node);
    return { ok: true };
  }

  private async requireNode(id: string): Promise<BomNode> {
    const node = await this.nodes.findOne({ where: { id } });
    if (!node) throw new NotFoundException('BOM no encontrado.');
    return node;
  }

  // ── Lines (components) ──────────────────────────────────────────────────────

  async addLine(nodeId: string, dto: CreateBomLineDto): Promise<BomLine> {
    const node = await this.requireNode(nodeId);
    if (dto.materialId === node.materialId) {
      throw new BadRequestException(
        'Un ensamble no puede contenerse a sí mismo como componente.',
      );
    }
    const component = await this.materials.getOne(dto.materialId); // scope + exists
    const entity = this.lines.create({
      bomNodeId: nodeId,
      materialId: dto.materialId,
      findNumber: dto.findNumber?.trim() || (await this.nextFindNumber(nodeId)),
      quantity: dto.quantity ?? 1,
      uom: dto.uom?.trim() || component.baseUom || 'EA',
      refDes: dto.refDes?.trim() || null,
      itemCategory: dto.itemCategory ?? 'STANDARD',
      scrapPct: dto.scrapPct ?? 0,
      makeBuy: dto.makeBuy ?? null,
      phantom: dto.phantom ?? component.itemType === 'PHANTOM',
      alternateGroup: dto.alternateGroup?.trim() || null,
      notes: dto.notes?.trim() || null,
      ...this.scopeFields(),
    });
    const saved = await this.lines.save(entity);
    await this.recordLedger('BOM_LINE_ADDED', nodeId, component.partNumber, {
      after: { component: component.partNumber, qty: saved.quantity },
    });
    return saved;
  }

  private async nextFindNumber(nodeId: string): Promise<string> {
    const qb = this.lines
      .createQueryBuilder('l')
      .where('l.bomNodeId = :id', { id: nodeId });
    this.applyScope(qb, 'l');
    const count = await qb.getCount();
    return String((count + 1) * 10).padStart(4, '0');
  }

  async updateLine(
    nodeId: string,
    lineId: string,
    dto: UpdateBomLineDto,
  ): Promise<BomLine> {
    const line = await this.requireLine(nodeId, lineId);
    Object.assign(line, {
      ...(dto.findNumber !== undefined && {
        findNumber: dto.findNumber.trim() || line.findNumber,
      }),
      ...(dto.quantity !== undefined && { quantity: dto.quantity }),
      ...(dto.uom !== undefined && { uom: dto.uom.trim() || 'EA' }),
      ...(dto.refDes !== undefined && { refDes: dto.refDes.trim() || null }),
      ...(dto.itemCategory !== undefined && { itemCategory: dto.itemCategory }),
      ...(dto.scrapPct !== undefined && { scrapPct: dto.scrapPct }),
      ...(dto.makeBuy !== undefined && { makeBuy: dto.makeBuy }),
      ...(dto.phantom !== undefined && { phantom: dto.phantom }),
      ...(dto.alternateGroup !== undefined && {
        alternateGroup: dto.alternateGroup.trim() || null,
      }),
      ...(dto.notes !== undefined && { notes: dto.notes.trim() || null }),
    });
    return this.lines.save(line);
  }

  async removeLine(nodeId: string, lineId: string): Promise<{ ok: true }> {
    const line = await this.requireLine(nodeId, lineId);
    await this.lines.remove(line);
    return { ok: true };
  }

  private async requireLine(nodeId: string, lineId: string): Promise<BomLine> {
    const line = await this.lines.findOne({ where: { id: lineId, bomNodeId: nodeId } });
    if (!line) throw new NotFoundException('Línea de BOM no encontrada.');
    return line;
  }

  // ── Explosion ───────────────────────────────────────────────────────────────

  async explode(
    nodeId: string,
    qty?: number,
  ): Promise<ExplodeResult & { root: { materialId: string; partNumber: string; description: string; revision: string; qty: number } }> {
    const root = await this.requireNode(nodeId);
    const mats = await this.materialMap();
    const rootMat = mats.get(root.materialId);

    // Effective node per material (ACTIVE preferred), with the requested root
    // node taking precedence for its own material/revision.
    const allNodes = await this.allNodes();
    const effectiveNode = new Map<string, string>(); // materialId -> nodeId
    for (const n of allNodes) {
      const existing = effectiveNode.get(n.materialId);
      if (!existing) {
        effectiveNode.set(n.materialId, n.id);
      } else {
        const ex = allNodes.find((x) => x.id === existing)!;
        if (n.status === 'ACTIVE' && ex.status !== 'ACTIVE') {
          effectiveNode.set(n.materialId, n.id);
        }
      }
    }
    effectiveNode.set(root.materialId, root.id); // honor the requested revision

    const linesByNode = await this.linesByNodes(
      Array.from(effectiveNode.values()),
    );

    const getLines = (materialId: string): ExplodeLine[] => {
      const nId = effectiveNode.get(materialId);
      if (!nId) return [];
      return (linesByNode.get(nId) ?? []).map((l) => ({
        materialId: l.materialId,
        quantity: l.quantity,
        scrapPct: l.scrapPct,
        findNumber: l.findNumber,
        refDes: l.refDes,
        phantom: l.phantom,
        uom: l.uom,
      }));
    };
    const getMaterial = (materialId: string): ExplodeMaterial | undefined => {
      const m = mats.get(materialId);
      return m ? this.toExplodeMaterial(m) : undefined;
    };

    const result = explodeBom(root.materialId, qty ?? root.baseQuantity ?? 1, getLines, getMaterial);
    return {
      ...result,
      root: {
        materialId: root.materialId,
        partNumber: rootMat?.partNumber ?? '(desconocido)',
        description: rootMat?.description ?? '',
        revision: root.revision,
        qty: qty ?? root.baseQuantity ?? 1,
      },
    };
  }

  private async allNodes(): Promise<BomNode[]> {
    const qb = this.nodes.createQueryBuilder('n');
    this.applyScope(qb, 'n');
    return qb.getMany();
  }

  private async linesByNodes(
    nodeIds: string[],
  ): Promise<Map<string, BomLine[]>> {
    const out = new Map<string, BomLine[]>();
    if (!nodeIds.length) return out;
    const qb = this.lines
      .createQueryBuilder('l')
      .where('l.bomNodeId IN (:...ids)', { ids: nodeIds })
      .orderBy('l.findNumber', 'ASC');
    this.applyScope(qb, 'l');
    const rows = await qb.getMany();
    for (const l of rows) {
      const arr = out.get(l.bomNodeId) ?? [];
      arr.push(l);
      out.set(l.bomNodeId, arr);
    }
    return out;
  }

  // ── Where-used ──────────────────────────────────────────────────────────────

  /** In which assemblies a material appears (direct + full ancestry). */
  async whereUsed(materialId: string): Promise<WhereUsedEntry[]> {
    const mats = await this.materialMap();
    const allNodes = await this.allNodes();
    const nodeById = new Map(allNodes.map((n) => [n.id, n]));
    const allLines = await this.linesByNodes(allNodes.map((n) => n.id));

    // Flatten lines for quick reverse lookup: childMaterial -> [parent usages].
    const usagesByChild = new Map<string, BomLine[]>();
    for (const arr of allLines.values()) {
      for (const l of arr) {
        const list = usagesByChild.get(l.materialId) ?? [];
        list.push(l);
        usagesByChild.set(l.materialId, list);
      }
    }

    const out: WhereUsedEntry[] = [];
    const seen = new Set<string>();

    const visit = (childMaterialId: string, level: number, path: Set<string>) => {
      const usages = usagesByChild.get(childMaterialId) ?? [];
      for (const l of usages) {
        const parentNode = nodeById.get(l.bomNodeId);
        if (!parentNode) continue;
        const key = `${l.bomNodeId}:${l.id}:${level}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const pm = mats.get(parentNode.materialId);
        out.push({
          bomNodeId: parentNode.id,
          parentMaterialId: parentNode.materialId,
          parentPartNumber: pm?.partNumber ?? '(desconocido)',
          parentDescription: pm?.description ?? '',
          findNumber: l.findNumber,
          quantity: l.quantity,
          uom: l.uom,
          level,
        });
        // Walk upward (multi-level where-used), guarding cycles.
        if (!path.has(parentNode.materialId)) {
          visit(parentNode.materialId, level + 1, new Set(path).add(parentNode.materialId));
        }
      }
    };

    visit(materialId, 1, new Set([materialId]));
    return out.sort((a, b) => a.level - b.level || a.parentPartNumber.localeCompare(b.parentPartNumber));
  }

  // ── Ledger ──────────────────────────────────────────────────────────────────

  private async recordLedger(
    action: string,
    referenceId: string,
    partNumber: string | undefined,
    states: { before?: unknown; after?: unknown },
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.ENGINEERING,
        action,
        referenceType: 'BOM',
        referenceId,
        plant: this.tenantCtx.getPlantId() ?? undefined,
        metadata: {
          partNumber,
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
