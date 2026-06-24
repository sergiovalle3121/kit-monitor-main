import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';
import { money } from './money';

export type CostingMethod = 'standard' | 'moving_average' | 'fifo' | 'lifo';

/**
 * Per-material valuation state (MM). Drives COGS and inventory valuation.
 * `moving_average` keeps a running average; `fifo`/`lifo` value against the
 * layers in erp_valuation_layers; `standard` falls back to MaterialMaster.
 */
@Entity('erp_material_valuations')
export class ErpMaterialValuation {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  partNumber: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'varchar', length: 16, default: 'moving_average' })
  costingMethod: CostingMethod;

  @Column(money(6))
  movingAvgCost: number;

  @Column({ type: 'float', default: 0 })
  totalQty: number;

  @Column(money())
  totalValue: number;

  @Column(money(6))
  lastCost: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
