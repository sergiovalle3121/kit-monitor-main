import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { money } from './money';

export type CostCenterType =
  | 'production'
  | 'overhead'
  | 'sales'
  | 'admin'
  | 'logistics';

/** Cost / responsibility center for controlling (CO) postings and budget control. */
@Entity('erp_cost_centers')
export class ErpCostCenter {
  @PrimaryColumn({ type: 'varchar', length: 24 })
  code: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 24, default: 'overhead' })
  type: CostCenterType;

  @Column({ type: 'varchar', length: 64, nullable: true })
  buildingId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  programId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  manager: string | null;

  @Column(money())
  budgetAmount: number;

  @Column(money())
  actualAmount: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
