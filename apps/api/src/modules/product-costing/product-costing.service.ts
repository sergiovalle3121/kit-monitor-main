import { Injectable, Logger, Optional } from '@nestjs/common';
import { BomTreeService } from '../bom-tree/bom-tree.service';
import { RoutingService } from '../routing/routing.service';
import { MaterialMasterService } from '../material-master/material-master.service';
import { MmMaterial } from '../material-master/entities/mm-material.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { rollupRoutingTime } from '../routing/routing-logic';
import { computeStandardCost, CostResult } from './costing';
import type { ExplodedNode } from '../bom-tree/bom-explode';

const DEFAULT_LABOR_RATE = 30; // $/h
const DEFAULT_OVERHEAD_PCT = 15; // % of direct cost

export interface CostingOptions {
  laborRatePerHour?: number;
  overheadPct?: number;
}

export interface LaborDetail {
  materialId: string;
  partNumber: string;
  qty: number;
  minutes: number;
}

export interface CostRollupResult extends CostResult {
  root: { materialId: string; partNumber: string; description: string; revision: string };
  qty: number;
  laborRatePerHour: number;
  overheadPct: number;
  hasRouting: boolean;
  laborDetail: LaborDetail[];
  flat: Array<{ partNumber: string; description: string; totalQty: number; uom: string; extendedCost: number }>;
}

@Injectable()
export class ProductCostingService {
  private readonly logger = new Logger(ProductCostingService.name);

  constructor(
    private readonly bom: BomTreeService,
    private readonly routing: RoutingService,
    private readonly materials: MaterialMasterService,
    private readonly tenantCtx: TenantContextService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  async rollup(
    bomNodeId: string,
    qty?: number,
    opts: CostingOptions = {},
  ): Promise<CostRollupResult> {
    const node = await this.bom.getNode(bomNodeId); // scope + existence
    const buildQty = qty && qty > 0 ? qty : node.baseQuantity || 1;
    const exploded = await this.bom.explode(bomNodeId, buildQty);

    // Material cost = the BOM-explosion rolled-up cost.
    const materialCost = exploded.totalCost;

    // Collect every assembly in the tree with its accumulated extended qty.
    const assemblies = new Map<string, number>();
    const walk = (nodes: ExplodedNode[]) => {
      for (const n of nodes) {
        if (n.isAssembly) {
          assemblies.set(n.materialId, (assemblies.get(n.materialId) ?? 0) + n.extendedQty);
          walk(n.children);
        }
      }
    };
    walk(exploded.tree);

    const rootMaterialId = node.materialId;
    const matIds = [rootMaterialId, ...assemblies.keys()];
    const opsMap = await this.routing.operationsForMaterials(matIds);

    // Labor = root routing (for buildQty) + each sub-assembly routing (for its qty).
    let laborMinutes = 0;
    const laborDetail: LaborDetail[] = [];
    const addLabor = (materialId: string, q: number, partNumber: string) => {
      const ops = opsMap.get(materialId);
      if (!ops || !ops.length) return;
      const min = rollupRoutingTime(ops, q).totalForQtyMin;
      laborMinutes += min;
      laborDetail.push({ materialId, partNumber, qty: q, minutes: min });
    };
    addLabor(rootMaterialId, buildQty, node.material?.partNumber ?? '(root)');
    for (const [matId, q] of assemblies) {
      const pn = exploded.tree.length
        ? findPartNumber(exploded.tree, matId) ?? matId
        : matId;
      addLabor(matId, q, pn);
    }

    const laborRatePerHour = opts.laborRatePerHour ?? DEFAULT_LABOR_RATE;
    const overheadPct = opts.overheadPct ?? DEFAULT_OVERHEAD_PCT;

    const cost = computeStandardCost({
      materialCost,
      laborMinutes,
      laborRatePerHour,
      overheadPct,
      qty: buildQty,
    });

    return {
      ...cost,
      root: {
        materialId: rootMaterialId,
        partNumber: node.material?.partNumber ?? '(desconocido)',
        description: node.material?.description ?? '',
        revision: node.revision,
      },
      qty: buildQty,
      laborRatePerHour,
      overheadPct,
      hasRouting: laborDetail.length > 0,
      laborDetail,
      flat: exploded.flat.map((f) => ({
        partNumber: f.partNumber,
        description: f.description,
        totalQty: f.totalQty,
        uom: f.uom,
        extendedCost: f.extendedCost,
      })),
    };
  }

  /** Write the computed unit standard cost back onto the assembly material. */
  async applyStandardCost(
    bomNodeId: string,
    qty?: number,
    opts: CostingOptions = {},
  ): Promise<MmMaterial> {
    const result = await this.rollup(bomNodeId, qty, opts);
    const updated = await this.materials.update(result.root.materialId, {
      standardCost: result.unitCost,
    });
    await this.recordLedger(result);
    return updated;
  }

  private async recordLedger(result: CostRollupResult): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.ENGINEERING,
        action: 'STANDARD_COST_APPLIED',
        referenceType: 'MATERIAL',
        referenceId: result.root.materialId,
        plant: this.tenantCtx.getPlantId() ?? undefined,
        metadata: {
          partNumber: result.root.partNumber,
          unitCost: result.unitCost,
          material: result.materialCost,
          labor: result.laborCost,
          overhead: result.overheadCost,
        },
      });
    } catch (err) {
      this.logger.warn(`Ledger write skipped: ${(err as Error)?.message}`);
    }
  }
}

function findPartNumber(nodes: ExplodedNode[], materialId: string): string | null {
  for (const n of nodes) {
    if (n.materialId === materialId) return n.partNumber;
    const found = findPartNumber(n.children, materialId);
    if (found) return found;
  }
  return null;
}
