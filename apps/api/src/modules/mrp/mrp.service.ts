import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BomTreeService } from '../bom-tree/bom-tree.service';
import { MaterialMasterService } from '../material-master/material-master.service';
import { InventoryPosition } from '../inventory/entities/inventory-position.entity';
import {
  computeNetting,
  MrpDemandLine,
  MrpRow,
  MrpSummary,
  MrpSupply,
} from './mrp';

export interface MrpResult {
  root: { materialId: string; partNumber: string; description: string; revision: string; qty: number };
  rows: MrpRow[];
  summary: MrpSummary;
}

@Injectable()
export class MrpService {
  constructor(
    private readonly bom: BomTreeService,
    private readonly materials: MaterialMasterService,
    @InjectRepository(InventoryPosition)
    private readonly positions: Repository<InventoryPosition>,
  ) {}

  /** Net requirements for building `qty` of a BOM assembly. Read-only. */
  async netting(
    bomNodeId: string,
    qty?: number,
    warehouseId?: string,
  ): Promise<MrpResult> {
    const exploded = await this.bom.explode(bomNodeId, qty); // scope + exists

    // make/buy by part number, from the material master.
    const all = await this.materials.list();
    const makeBuyByPart = new Map(
      all.map((m) => [m.partNumber.toUpperCase(), m.makeBuy]),
    );

    const demand: MrpDemandLine[] = exploded.flat.map((f) => ({
      partNumber: f.partNumber,
      description: f.description,
      uom: f.uom,
      grossQty: f.totalQty,
      unitCost: f.unitCost,
      makeBuy: makeBuyByPart.get(f.partNumber.toUpperCase()) ?? 'BUY',
    }));

    const supply = await this.supplyFor(
      demand.map((d) => d.partNumber),
      warehouseId,
    );

    const { rows, summary } = computeNetting(demand, supply);
    return {
      root: {
        materialId: exploded.root.materialId,
        partNumber: exploded.root.partNumber,
        description: exploded.root.description,
        revision: exploded.root.revision,
        qty: exploded.root.qty,
      },
      rows,
      summary,
    };
  }

  /** Aggregate available (on-hand − allocated, only 'available' hold) + in-transit. */
  private async supplyFor(
    partNumbers: string[],
    warehouseId?: string,
  ): Promise<Map<string, MrpSupply>> {
    const out = new Map<string, MrpSupply>();
    const pns = Array.from(new Set(partNumbers.filter(Boolean)));
    if (!pns.length) return out;

    const qb = this.positions
      .createQueryBuilder('p')
      .select('p.partNumber', 'partNumber')
      .addSelect(
        "SUM(CASE WHEN p.holdStatus = 'available' THEN p.onHand - p.allocated ELSE 0 END)",
        'available',
      )
      .addSelect('SUM(p.inTransit)', 'inTransit')
      .where('p.partNumber IN (:...pns)', { pns })
      .groupBy('p.partNumber');
    if (warehouseId) qb.andWhere('p.warehouseId = :wh', { wh: warehouseId });

    const raw = await qb.getRawMany<{
      partNumber: string;
      available: string | number | null;
      inTransit: string | number | null;
    }>();
    for (const r of raw) {
      out.set(r.partNumber, {
        available: Number(r.available ?? 0),
        inTransit: Number(r.inTransit ?? 0),
      });
    }
    return out;
  }
}
